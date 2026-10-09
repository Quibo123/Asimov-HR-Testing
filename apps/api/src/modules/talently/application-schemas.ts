import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_URL_TTL_SECONDS = 300;       // the signed URL lives 5 minutes

export const RESUME_EXT = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export const uploadUrlSchema = z.object({
  contentType: z.enum(
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    { message: "Upload a PDF, DOC or DOCX file." },
  ),
  size: z
    .number()
    .int()
    .min(1, "The file is empty.")
    .max(MAX_RESUME_BYTES, "The resume must be 5 MB or smaller."),
});
export type UploadUrlBody = z.infer<typeof uploadUrlSchema>;

export const applyBodySchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number."),
  consent: z
    .boolean()
    .default(false)
    .refine((v) => v === true, "You must accept the privacy consent to apply."),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), value: z.unknown() }))
    .max(100),
});
export type ApplyBody = z.infer<typeof applyBodySchema>;