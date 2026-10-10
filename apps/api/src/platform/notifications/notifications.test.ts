import { describe, expect, it } from "vitest";
import { assertSafeText, isSensitiveKey } from "./guard.js";
import { NOTIFICATION_TYPES, TEMPLATES, renderNotice, type NotificationType } from "./templates.js";
import {
  DEFAULT_COLOUR,
  buildAppLink,
  renderEmail,
  safeColour,
  safeLogoUrl,
  safeSenderName,
  type Brand,
} from "./emailTemplate.js";

// Sample values for every template. Adding a template without a sample here fails a test.
const SAMPLE: Record<NotificationType, Record<string, string>> = {
  "approval.requested": { requester: "Asha K", summary: "Leave request, 3 days from Monday" },
  "approval.decided": { summary: "Leave request, 3 days from Monday", status: "approved" },
  "demo.notice": { message: "Hello from Asimov" },
};

describe("templates carry no sensitive fields", () => {
  it("every template has sample data in this test", () => {
    expect(Object.keys(SAMPLE).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it.each(NOTIFICATION_TYPES)("%s uses only safe variable names", (type) => {
    for (const name of TEMPLATES[type].variables) {
      expect(isSensitiveKey(name)).toBe(false);
    }
  });

  it.each(NOTIFICATION_TYPES)("%s renders without sensitive content", (type) => {
    expect(() => renderNotice(type, SAMPLE[type])).not.toThrow();
  });
});

describe("the guard", () => {
  it("refuses salary, bank and ID details", () => {
    expect(() => assertSafeText("Your salary was updated")).toThrow();
    expect(() => assertSafeText("Send it to bank account number 12345")).toThrow();
    expect(() => assertSafeText("Ref 123456789012")).toThrow();
    expect(() => assertSafeText("ID 1234 5678 9012")).toThrow();
    expect(() => assertSafeText("PAN ABCDE1234F")).toThrow();
    expect(() => assertSafeText("IBAN GB82WEST12345698765432")).toThrow();
  });

  it("allows normal text and dates", () => {
    expect(() => assertSafeText("Leave request, 3 days from Monday 12 Oct 2026")).not.toThrow();
    expect(() => assertSafeText("Submitted on 2026-10-12 09:30")).not.toThrow();
  });

  it("recognises sensitive variable names but not normal ones", () => {
    for (const key of ["salary", "bankAccount", "pan", "ssn", "iban", "aadhaar", "passport_number"]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
    for (const key of ["summary", "requester", "message", "status", "company"]) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });
});

describe("renderNotice", () => {
  it("builds the title and body from the template", () => {
    expect(renderNotice("approval.decided", { summary: "Leave request", status: "approved" })).toEqual({
      title: "Your request was approved",
      body: "Leave request",
    });
  });

  it("rejects variables the template does not allow", () => {
    expect(() => renderNotice("demo.notice", { message: "x", other: "y" })).toThrow("not an allowed variable");
  });

  it("rejects sensitive variable names and values", () => {
    expect(() => renderNotice("demo.notice", { message: "x", salary: "10" })).toThrow();
    expect(() => renderNotice("demo.notice", { message: "Your salary is 5000" })).toThrow();
  });

  it("requires every variable", () => {
    expect(() => renderNotice("demo.notice", {})).toThrow("required");
  });

  it("cleans control characters and extra spaces", () => {
    expect(renderNotice("demo.notice", { message: "Hi\u0000  there" }).body).toBe("Hi there");
  });
});

describe("the email shows the tenant brand", () => {
  const brand: Brand = {
    tenantName: "Acme Ltd",
    senderName: "Acme HR",
    colour: "#E4572E",
    logoUrl: "https://cdn.example.com/logo.png",
  };
  const url = "https://app.example.com/approvals/abc?tenant=t-1";

  it("carries the logo, colour, tenant name and link", () => {
    const email = renderEmail({ brand, title: "Approval needed", body: "Please review", url });
    expect(email.html).toContain("#E4572E");
    expect(email.html).toContain("https://cdn.example.com/logo.png");
    expect(email.html).toContain("Acme Ltd");
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.subject).toBe("Approval needed");
  });

  it("shows the tenant name when there is no logo", () => {
    const email = renderEmail({ brand: { ...brand, logoUrl: null }, title: "T", body: "B", url });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("Acme Ltd");
  });

  it("escapes HTML in the content", () => {
    const email = renderEmail({ brand, title: "T", body: "<script>alert(1)</script>", url });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("falls back to safe defaults for bad brand values", () => {
    expect(safeColour("red")).toBe(DEFAULT_COLOUR);
    expect(safeColour("#12345G")).toBe(DEFAULT_COLOUR);
    expect(safeColour("#abcdef")).toBe("#abcdef");
    expect(safeLogoUrl("http://example.com/a.png")).toBeNull();
    expect(safeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(safeLogoUrl('https://example.com/a"b.png')).toBeNull();
    expect(safeLogoUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(safeSenderName('Bad "Name" <x@y>, z', "Acme")).not.toMatch(/["<>,@]/);
    expect(safeSenderName(null, "Acme")).toBe("Acme");
  });
});

describe("links open the right tenant and item", () => {
  it("adds the tenant and keeps the path", () => {
    const link = buildAppLink("https://app.example.com", "t-1", "/approvals/abc");
    expect(link).toBe("https://app.example.com/approvals/abc?tenant=t-1");
  });

  it("keeps an existing query", () => {
    expect(buildAppLink("https://app.example.com", "t-1", "/approvals/abc?tab=1")).toContain("tenant=t-1");
  });

  it("refuses links that leave the app", () => {
    expect(() => buildAppLink("https://app.example.com", "t-1", "//evil.com")).toThrow();
    expect(() => buildAppLink("https://app.example.com", "t-1", "https://evil.com")).toThrow();
  });
});