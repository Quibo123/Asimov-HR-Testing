import { describe, expect, it } from "vitest";
import { findResumeFile, looksLikePdf, parseResumeCsv, pickJob, rowSchema, type JobRef } from "./helpers.js";
import { renderEmail, type Brand } from "../../../platform/notifications/emailTemplate.js";

describe("parseResumeCsv", () => {
  it("reads rows, lower-cases headers and numbers rows from 2", () => {
    const rows = parseResumeCsv("Name,Email,Phone,Job\nAsha K,asha@example.com,9876543210,Support Engineer\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      name: "Asha K",
      email: "asha@example.com",
      job: "Support Engineer",
      file: "",
    });
  });

  it("handles quoted commas, a BOM and blank lines", () => {
    const text = '\uFEFFname,email,phone,job,file\n"Khan, Asha",a@example.com,9876543210,"Engineer, Support",a.pdf\n\n';
    const rows = parseResumeCsv(text);
    expect(rows[0].name).toBe("Khan, Asha");
    expect(rows[0].job).toBe("Engineer, Support");
    expect(rows[0].file).toBe("a.pdf");
  });

  it("explains missing columns", () => {
    expect(() => parseResumeCsv("name,email\nA,a@example.com\n")).toThrow("missing these columns: phone, job");
  });

  it("refuses an empty file", () => {
    expect(() => parseResumeCsv("name,email,phone,job\n")).toThrow("no rows");
  });
});

describe("rowSchema", () => {
  const good = { name: " Asha K ", email: " Asha@Example.com ", phone: "+91 98765 43210", job: "Support Engineer", file: "" };

  it("accepts and cleans a good row", () => {
    const result = rowSchema.safeParse(good);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
      expect(result.data.name).toBe("Asha K");
    }
  });

  it("explains a bad email and a bad phone number", () => {
    const result = rowSchema.safeParse({ ...good, email: "nope", phone: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const text = result.error.issues.map((i) => i.message).join(" ");
      expect(text).toContain("Email");
      expect(text).toContain("Phone");
    }
  });
});

describe("findResumeFile", () => {
  const files = ["Asha K.pdf", "ravi@example.com.pdf", "Two.pdf", "two.PDF"];

  it("matches by name, ignoring case, spaces and punctuation", () => {
    expect(findResumeFile(files, { name: "asha k", email: "x@example.com" })).toEqual({ file: "Asha K.pdf" });
  });

  it("matches by email first", () => {
    expect(findResumeFile(files, { name: "Ravi M", email: "ravi@example.com" })).toEqual({
      file: "ravi@example.com.pdf",
    });
  });

  it("uses the file column when it is given", () => {
    expect(findResumeFile(files, { name: "x", email: "x@example.com", file: "ASHA K.PDF" })).toEqual({
      file: "Asha K.pdf",
    });
  });

  it("explains a missing file", () => {
    const result = findResumeFile(files, { name: "Nobody", email: "nobody@example.com" });
    expect("error" in result).toBe(true);
  });

  it("refuses to guess when two files match", () => {
    const result = findResumeFile(files, { name: "Two", email: "x@example.com" });
    expect("error" in result && result.error).toContain("More than one");
  });

  it("never matches a file outside the folder", () => {
    const result = findResumeFile(files, { name: "x", email: "x@example.com", file: "..\\secret.pdf" });
    expect("error" in result).toBe(true);
  });
});

describe("pickJob", () => {
  const jobs: JobRef[] = [
    { id: "11111111-1111-4111-8111-111111111111", title: "Support Engineer", status: "PUBLISHED" },
    { id: "22222222-2222-4222-8222-222222222222", title: "Sales  Lead", status: "DRAFT" },
    { id: "33333333-3333-4333-8333-333333333333", title: "sales lead", status: "PUBLISHED" },
  ];

  it("finds a job by id", () => {
    expect(pickJob(jobs, "11111111-1111-4111-8111-111111111111")).toEqual({ job: jobs[0] });
  });

  it("finds a job by title, ignoring case", () => {
    expect(pickJob(jobs, "support engineer")).toEqual({ job: jobs[0] });
  });

  it("refuses an ambiguous title", () => {
    const result = pickJob(jobs, "SALES LEAD");
    expect("error" in result && result.error).toContain("More than one");
  });

  it("explains an unknown job", () => {
    const result = pickJob(jobs, "Nonexistent Job");
    expect("error" in result && result.error).toContain("No job");
  });
});

describe("looksLikePdf", () => {
  it("accepts a PDF header and rejects everything else", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.4 test"))).toBe(true);
    expect(looksLikePdf(Buffer.from("hello world"))).toBe(false);
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
  });
});

describe("the invite email", () => {
  it("uses its own button and footer", () => {
    const brand: Brand = { tenantName: "Acme Ltd", senderName: "Acme HR", colour: "#E4572E", logoUrl: null };
    const email = renderEmail({
      brand,
      title: "Complete your application",
      body: "Hi Asha",
      url: "https://app.example.com/portal/jobs/1",
      buttonLabel: "Complete the questionnaire",
      footer: "Acme Ltd has your resume on file.",
    });
    expect(email.html).toContain("Complete the questionnaire");
    expect(email.html).toContain("has your resume on file");
    expect(email.html).not.toContain("a member of");
    expect(email.text).toContain("Complete the questionnaire");
  });
});