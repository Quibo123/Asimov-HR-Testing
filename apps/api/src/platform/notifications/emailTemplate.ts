export type Brand = {
  tenantName: string;
  senderName: string;
  colour: string; // "#RRGGBB"
  logoUrl: string | null; // https only
};

export const DEFAULT_COLOUR = "#2563EB";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand values come from tenant settings, so they are checked before they go into an email.
export function safeColour(value: string | null | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_COLOUR;
}

export function safeLogoUrl(value: string | null | undefined): string | null {
  if (!value || /[\s"'<>]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Used in the "From" header, so quotes, angle brackets, commas and @ are removed.
export function safeSenderName(value: string | null | undefined, fallback: string): string {
  const strip = (s: string) => s.replace(/[\u0000-\u001f"<>,;@]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return strip(value ?? "") || strip(fallback) || "Notifications";
}

// Links are paths inside the app: they must start with one "/" and use plain characters.
export function isSafeAppPath(path: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\/_\-.?=&%~]*$/.test(path) && !path.includes("..");
}

// The link in the email opens the right tenant (?tenant=...) and the right item (the path).
export function buildAppLink(baseUrl: string, tenantId: string, path: string): string {
  if (!isSafeAppPath(path)) throw new Error("Unsafe link path.");
  const url = new URL(path, baseUrl);
  url.searchParams.set("tenant", tenantId);
  return url.toString();
}

export function renderEmail(input: { brand: Brand; title: string; body: string; url: string }) {
  const { brand, title, body, url } = input;
  const name = escapeHtml(brand.tenantName);

  const header = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${name}" height="40" style="display:block;border:0;height:40px;">`
    : `<span style="font-size:20px;font-weight:bold;color:#111827;">${name}</span>`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:20px 28px;">${header}</td></tr>
<tr><td style="height:4px;background:${brand.colour};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${escapeHtml(body)}</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:${brand.colour};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;font-size:15px;">Open in ${name}</a>
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#6b7280;">You are receiving this because you are a member of ${name}.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${title}\n\n${body}\n\nOpen: ${url}\n\nYou are receiving this because you are a member of ${brand.tenantName}.`;

  return { subject: title, html, text };
}