import { NotificationContentError, assertSafeKeys, assertSafeText, cleanText } from "./guard.js";

export type TemplateData = Record<string, string>;

type TemplateDef = {
  variables: readonly string[]; // the ONLY values a caller may pass
  title: (d: TemplateData) => string;
  body: (d: TemplateData) => string;
};

export const NOTIFICATION_TYPES = [
  "approval.requested",
  "approval.decided",
  "demo.notice", // for testing
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TEMPLATES = {
  "approval.requested": {
    variables: ["requester", "summary"],
    title: () => "Approval needed",
    body: (d) => `${d.requester} asked for your approval: ${d.summary}`,
  },
  "approval.decided": {
    variables: ["summary", "status"],
    title: (d) => `Your request was ${d.status}`,
    body: (d) => d.summary,
  },
  "demo.notice": {
    variables: ["message"],
    title: () => "Test notification",
    body: (d) => d.message,
  },
} as const satisfies Record<NotificationType, TemplateDef>;

// Turns an event into the title and body. Throws if anything is not allowed or looks sensitive.
export function renderNotice(type: NotificationType, data: TemplateData) {
  const def: TemplateDef = TEMPLATES[type];

  assertSafeKeys(Object.keys(data));

  const allowed = new Set(def.variables);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      throw new NotificationContentError(`"${key}" is not an allowed variable for ${type}.`);
    }
  }

  const clean: TemplateData = {};
  for (const name of def.variables) {
    const value = data[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new NotificationContentError(`The variable "${name}" is required for ${type}.`);
    }
    clean[name] = cleanText(value);
  }

  const title = def.title(clean);
  const body = def.body(clean);
  assertSafeText(title);
  assertSafeText(body);
  return { title, body };
}