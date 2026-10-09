import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "./errors.js";

let client: S3Client | null = null;

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new AppError(503, "Resume upload is not configured on this server.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export async function presignUpload(opts: {
  key: string;
  contentType: string;
  size: number;
  expiresInSeconds: number;
}) {
  const cfg = getConfig();

  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // R2 does not accept the SDK's newer default checksum parameters in signed URLs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.size,
  });

  // Content-Type and Content-Length are part of the signature, so R2 rejects an
  // upload whose type or size differs from what was requested.
  return getSignedUrl(client, command, {
    expiresIn: opts.expiresInSeconds,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}