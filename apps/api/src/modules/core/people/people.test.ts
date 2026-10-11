import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "../../../platform/timeZones.js";
import { computeChanges, formatDateOnly, isRealDate, parseDateOnly, stableJson } from "./pure.js";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  locationCreateSchema,
  locationUpdateSchema,
  sensitiveSchema,
} from "./schemas.js";

describe("time zones", () => {
  it("accepts real IANA zones", () => {
    for (const zone of ["Asia/Kolkata", "Asia/Dubai", "UTC", "Europe/London", "America/New_York"]) {
      expect(isValidTimeZone(zone)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const zone of ["Mars/Phobos", "India", "asia/kolkata", "IST", "GMT+5", "", " Asia/Kolkata", "Asia/Kolkata "]) {
      expect(isValidTimeZone(zone)).toBe(false);
    }
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(5)).toBe(false);
  });
});

describe("location input", () => {
  const good = { name: "Chennai", country: "in", timeZone: "Asia/Kolkata", weekendDays: [7] };

  it("accepts a good location and uppercases the country", () => {
    const result = locationCreateSchema.safeParse(good);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country).toBe("IN");
  });

  it("refuses a location without a time zone", () => {
    const { timeZone: _omit, ...withoutZone } = good;
    expect(locationCreateSchema.safeParse(withoutZone).success).toBe(false);
  });

  it("refuses a made-up time zone", () => {
    const result = locationCreateSchema.safeParse({ ...good, timeZone: "Mars/Phobos" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("IANA");
  });

  it("checks the weekend days", () => {
    expect(locationCreateSchema.safeParse({ ...good, weekendDays: [] }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...good, weekendDays: [8] }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...good, weekendDays: [6, 6] }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...good, weekendDays: [6, 7] }).success).toBe(true);
  });

  it("needs at least one field to change", () => {
    expect(locationUpdateSchema.safeParse({}).success).toBe(false);
    expect(locationUpdateSchema.safeParse({ timeZone: "Asia/Dubai" }).success).toBe(true);
    expect(locationUpdateSchema.safeParse({ timeZone: "Nowhere/City" }).success).toBe(false);
  });
});

describe("employee input", () => {
  const good = {
    code: "E-1001",
    name: "Asha K",
    email: "Asha@Example.com",
    locationId: "11111111-1111-4111-8111-111111111111",
    joiningDate: "2026-10-11",
  };

  it("accepts a good employee, lowercases the email and defaults the status", () => {
    const result = employeeCreateSchema.safeParse(good);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
      expect(result.data.status).toBe("ONBOARDING");
      expect(result.data.customFields).toEqual({});
    }
  });

  it("checks code and date", () => {
    expect(employeeCreateSchema.safeParse({ ...good, code: "bad code!" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...good, joiningDate: "2026-02-30" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...good, joiningDate: "11/10/2026" }).success).toBe(false);
  });

  it("keeps bank and ID data out of custom fields", () => {
    expect(employeeCreateSchema.safeParse({ ...good, customFields: { shirtSize: "M" } }).success).toBe(true);
    const bad = employeeCreateSchema.safeParse({ ...good, customFields: { bankAccount: "123456789" } });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toContain("sensitive");
    expect(employeeCreateSchema.safeParse({ ...good, customFields: { "bad key": "x" } }).success).toBe(false);
  });

  it("an update needs at least one field, and null clears an optional one", () => {
    expect(employeeUpdateSchema.safeParse({}).success).toBe(false);
    const clear = employeeUpdateSchema.safeParse({ managerId: null });
    expect(clear.success).toBe(true);
  });
});

describe("sensitive input", () => {
  it("accepts valid details and refuses short or odd ones", () => {
    expect(sensitiveSchema.safeParse({ bankAccountNumber: "123456789012", bankCode: "HDFC0001234" }).success).toBe(true);
    expect(sensitiveSchema.safeParse({ bankAccountNumber: "123" }).success).toBe(false);
    expect(sensitiveSchema.safeParse({ governmentIdType: "NOT_A_TYPE" }).success).toBe(false);
    expect(sensitiveSchema.safeParse({}).success).toBe(false);
  });
});

describe("helpers", () => {
  it("dates", () => {
    expect(isRealDate("2026-10-11")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(formatDateOnly(parseDateOnly("2026-10-11"))).toBe("2026-10-11");
  });

  it("stableJson ignores key order", () => {
    expect(stableJson({ a: 1, b: 2 })).toBe(stableJson({ b: 2, a: 1 }));
  });

  it("computeChanges lists only what really changed", () => {
    const before = { name: "A", phone: null, customFields: { x: 1, y: 2 } };
    const same = { name: "A", phone: null, customFields: { y: 2, x: 1 } };
    expect(computeChanges(before, same)).toEqual({});
    expect(computeChanges(before, { ...same, name: "B" })).toEqual({ name: { from: "A", to: "B" } });
  });
});