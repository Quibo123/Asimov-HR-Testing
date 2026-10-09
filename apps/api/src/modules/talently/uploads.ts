import { randomUUID } from "node:crypto";
import { prisma } from "../../platform/prisma.js";
import { AppError } from "../../platform/errors.js";
import { presignUpload } from "../../platform/r2.js";
import {
  MAX_RESUME_BYTES,
  RESUME_EXT,
  UPLOAD_URL_TTL_SECONDS,
  type UploadUrlBody,
} from "./application-schemas.js";

// PUBLIC route: the visitor is not signed in, so there is no tenant to filter by.
// A job is found only by its unguessable UUID and only while PUBLISHED.
export async function createUploadUrl(jobId: string, body: UploadUrlBody) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!job) throw new AppError(404, "This job is not open for applications.");

  // The key is built here, never from the visitor's file name.
  const key = `resumes/${job.id}/${randomUUID()}.${RESUME_EXT[body.contentType]}`;

  const uploadUrl = await presignUpload({
    key,
    contentType: body.contentType,
    size: body.size,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    uploadUrl,
    method: "PUT" as const,
    headers: { "Content-Type": body.contentType },
    key, // send this back in the apply request as the answer to the file question
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_RESUME_BYTES,
  };
}