import { z } from "zod";
import { prisma, Prisma } from "../prisma.js";
import { forTenant } from "../for-tenant.js";
import { AppError } from "../errors.js";
import type { Ctx } from "../ctx.js";
import { enqueueNotificationEmail } from "../queue.js";
import { assertSafeText } from "./guard.js";
import { NOTIFICATION_TYPES, renderNotice } from "./templates.js";
import { buildAppLink, isSafeAppPath, renderEmail } from "./emailTemplate.js";
import { getBrand } from "./brand.js";
import { sendEmail } from "./resend.js";

// ======================= notify() =======================

const eventSchema = z.object({
  // Same eventId + same person = one notice, ever. Use a stable id, like "approval.decided:<requestId>".
  eventId: z.string().trim().min(1).max(200),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(), // the recipient
  type: z.enum(NOTIFICATION_TYPES),
  data: z.record(z.string(), z.string()), // only the variables the template allows
  link: z.string().refine(isSafeAppPath, "link must be a path inside the app, like /approvals/123"),
});
export type NotifyEvent = z.input<typeof eventSchema>;

async function queueEmail(notificationId: string) {
  try {
    await enqueueNotificationEmail(notificationId);
  } catch (err) {
    // The notice is saved. The 10-minute sweep queues the email again.
    console.error(JSON.stringify({ msg: "notification.queue_failed", notificationId, error: String(err) }));
  }
}

// Writes the in-app notice and queues exactly one email. Throws if the content is not allowed
// (salary, bank or ID details): callers should catch and log so a notification problem
// never breaks the business action.
export async function notify(event: NotifyEvent): Promise<{ notificationId: string; duplicate: boolean }> {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) {
    throw new AppError(
      400,
      parsed.error.issues.map((i) => `${i.path.join(".") || "event"}: ${i.message}`).join("; "),
    );
  }
  const e = parsed.data;

  const { title, body } = renderNotice(e.type, e.data); // throws if anything is sensitive or not allowed

  const member = await prisma.membership.findFirst({
    where: { userId: e.userId, ...forTenant(e.tenantId) },
    select: { id: true },
  });
  if (!member) throw new AppError(400, "The recipient is not a member of this organisation.");

  let notificationId: string;
  try {
    const created = await prisma.notification.create({
      data: {
        ...forTenant(e.tenantId),
        userId: e.userId,
        eventId: e.eventId,
        type: e.type,
        title,
        body,
        link: e.link,
      },
      select: { id: true },
    });
    notificationId = created.id;
  } catch (err) {
    // The database refused a second notice for the same event and person: that is the dedupe.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.notification.findFirstOrThrow({
        where: { ...forTenant(e.tenantId), userId: e.userId, eventId: e.eventId },
        select: { id: true },
      });
      return { notificationId: existing.id, duplicate: true };
    }
    throw err;
  }

  await queueEmail(notificationId);
  return { notificationId, duplicate: false };
}

// ======================= The email worker (runs in pg-boss) =======================

export async function sendNotificationEmail(notificationId: string) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!n) return;
  if (n.emailStatus === "SENT" || n.emailStatus === "SKIPPED") return; // a repeated job does nothing

  try {
    const user = await prisma.user.findUnique({ where: { id: n.userId }, select: { email: true } });
    if (!user) {
      await prisma.notification.update({
        where: { id: n.id, ...forTenant(n.tenantId) },
        data: { emailStatus: "SKIPPED", emailLastError: "The recipient no longer exists." },
      });
      return;
    }

    // Last line of defence: re-check what is stored, even though notify() already checked it.
    assertSafeText(n.title);
    assertSafeText(n.body);

    const brand = await getBrand(n.tenantId);
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
    const email = renderEmail({
      brand,
      title: n.title,
      body: n.body,
      url: buildAppLink(baseUrl, n.tenantId, n.link),
    });

    const providerId = await sendEmail({
      fromName: brand.senderName,
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `notification-${n.id}`,
    });

    await prisma.notification.update({
      where: { id: n.id, ...forTenant(n.tenantId) },
      data: {
        emailStatus: "SENT",
        emailSentAt: new Date(),
        emailLastError: null,
        providerMessageId: providerId,
        emailAttempts: { increment: 1 },
      },
    });
    console.log(JSON.stringify({ msg: "notification.email_sent", notificationId: n.id, type: n.type }));
  } catch (err) {
    // Step 6: log the failure and keep it on the row, then throw so pg-boss retries later.
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await prisma.notification
      .update({
        where: { id: n.id, ...forTenant(n.tenantId) },
        data: { emailStatus: "FAILED", emailLastError: message, emailAttempts: { increment: 1 } },
      })
      .catch(() => undefined);
    console.error(
      JSON.stringify({ msg: "notification.email_failed", notificationId: n.id, type: n.type, error: message }),
    );
    throw err;
  }
}

// If a notice was saved but its email job never got queued (for example the server stopped),
// queue it again. Emails that already failed after all retries are NOT re-sent automatically.
export async function requeueStuckEmails() {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  // Cross-tenant on purpose: this is a system job.
  const stuck = await prisma.notification.findMany({
    where: { emailStatus: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  for (const item of stuck) {
    await queueEmail(item.id);
  }
}

// ======================= In-app reading =======================

const publicFields = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} as const;

export async function listNotifications(ctx: Ctx, opts: { unreadOnly: boolean; limit: number }) {
  const mine = { ...forTenant(ctx.tenantId), userId: ctx.actorId };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { ...mine, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      select: publicFields,
    }),
    prisma.notification.count({ where: { ...mine, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(ctx: Ctx, id: string) {
  const mine = { id, ...forTenant(ctx.tenantId), userId: ctx.actorId };
  await prisma.notification.updateMany({ where: { ...mine, readAt: null }, data: { readAt: new Date() } });
  const item = await prisma.notification.findFirst({ where: mine, select: publicFields });
  if (!item) throw new AppError(404, "Notification not found.");
  return item;
}

export async function markAllRead(ctx: Ctx) {
  const result = await prisma.notification.updateMany({
    where: { ...forTenant(ctx.tenantId), userId: ctx.actorId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}