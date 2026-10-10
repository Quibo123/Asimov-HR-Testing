import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  client ??= new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<string | null> {
  const address = process.env.RESEND_FROM_ADDRESS;
  if (!address) throw new Error("RESEND_FROM_ADDRESS is not set.");

  // The idempotency key makes Resend ignore a repeated send of the same notification.
  const { data, error } = await getClient().emails.send(
    {
      from: `${opts.fromName} <${address}>`,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    },
    { idempotencyKey: opts.idempotencyKey },
  );

  // The Resend library returns an error instead of throwing, so throw it here to trigger the retry.
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
  return data?.id ?? null;
}