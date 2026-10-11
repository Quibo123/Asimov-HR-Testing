import { z } from "zod";
import { isSensitiveKey } from "../../../platform/notifications/guard.js";
import { isValidTimeZone } from "../../../platform/timeZones.js";
import { isRealDate } from "./pure.js";

// ---------- Locations ----------

const weekendDays = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Choose at least one weekend day (1 = Monday ... 7 = Sunday).")
  .max(3, "Choose at most three weekend days.")
  .refine((days) => new Set(days).size === days.length, "Weekend days cannot repeat.");

const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country must be a 2-letter code, like IN or AE.");

// A location without a valid IANA time zone is refused (400).
const timeZone = z
  .string()
  .refine(isValidTimeZone, "timeZone must be a valid IANA time zone, like Asia/Kolkata or Asia/Dubai.");

export const locationCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  country,
  timeZone,
  weekendDays,
});
export type LocationCreate = z.infer<typeof locationCreateSchema>;

export const locationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    country: country.optional(),
    timeZone: timeZone.optional(),
    weekendDays: weekendDays.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), "Send at least one field to change.");
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

// ---------- Departments and designations ----------

export const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });
export type NameInput = z.infer<typeof nameSchema>;

// ---------- Employees ----------

export const EMPLOYEE_STATUSES = ["ONBOARDING", "ACTIVE", "NOTICE", "LEFT"] as const;

const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/, "code: letters, digits, . _ - only, up to 30 characters.");
const phone = z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, "Phone number is not valid.");
const joiningDate = z.string().refine(isRealDate, "joiningDate must be a real date like 2026-10-11.");
const optionalId = z.string().uuid().nullable().optional();

// Custom fields are flat and simple. Bank and ID data is refused here: it belongs in the sensitive section.
const customFields = z
  .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
  .superRefine((fields, ctx) => {
    const keys = Object.keys(fields);
    if (keys.length > 50) ctx.addIssue({ code: "custom", message: "At most 50 custom fields." });
    for (const key of keys) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `"${key}" is not a valid field name (letters, digits and _, starting with a letter, up to 40 characters).`,
        });
      } else if (isSensitiveKey(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `"${key}" looks like bank or ID data. Put it in the sensitive section, not in custom fields.`,
        });
      }
    }
  });

export const employeeCreateSchema = z.object({
  code,
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: phone.nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid(),
  departmentId: optionalId,
  designationId: optionalId,
  managerId: optionalId,
  joiningDate,
  status: z.enum(EMPLOYEE_STATUSES).default("ONBOARDING"),
  customFields: customFields.default({}),
});
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;

// On update, a missing field is left alone and null clears an optional field.
export const employeeUpdateSchema = z
  .object({
    code: code.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    phone: phone.nullable().optional(),
    userId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().optional(),
    departmentId: optionalId,
    designationId: optionalId,
    managerId: optionalId,
    joiningDate: joiningDate.optional(),
    status: z.enum(EMPLOYEE_STATUSES).optional(),
    customFields: customFields.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), "Send at least one field to change.");
export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});
export type ListQuery = z.infer<typeof listQuery>;

// ---------- Sensitive details (HR only) ----------

const plain = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^[A-Za-z0-9 -]{${min},${max}}$`), `Use ${min} to ${max} letters, digits, spaces or hyphens.`);

export const sensitiveSchema = z
  .object({
    bankAccountHolder: z.string().trim().min(1).max(120).nullable().optional(),
    bankAccountNumber: plain(6, 34).nullable().optional(),
    bankCode: plain(4, 20).nullable().optional(),
    governmentIdType: z
      .enum(["AADHAAR", "PAN", "PASSPORT", "EMIRATES_ID", "DRIVING_LICENCE", "OTHER"])
      .nullable()
      .optional(),
    governmentIdNumber: plain(4, 30).nullable().optional(),
    taxIdNumber: plain(4, 30).nullable().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), "Send at least one field to change.");
export type SensitiveInput = z.infer<typeof sensitiveSchema>;