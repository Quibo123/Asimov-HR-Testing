import { z } from "zod";

const text = z.string().trim().min(1);

const shapes = {
  common: { DATABASE_URL: text, DIRECT_URL: text },
  web: {
    SUPABASE_URL: z.string().trim().url(),
    SUPABASE_SERVICE_ROLE_KEY: text,
    CORS_ORIGINS: text,
    R2_ACCOUNT_ID: text,
    R2_ACCESS_KEY_ID: text,
    R2_SECRET_ACCESS_KEY: text,
    R2_BUCKET: text,
  },
  worker: {
    RESEND_API_KEY: text,
    RESEND_FROM_ADDRESS: z.string().trim().email(),
    APP_BASE_URL: z.string().trim().url(),
  },
};

// In production a problem stops the start-up. Locally it only prints a warning.
export function assertEnv(role: "web" | "worker", opts: { alsoWorker?: boolean } = {}) {
  const shape = {
    ...shapes.common,
    ...(role === "web" ? shapes.web : shapes.worker),
    ...(role === "web" && opts.alsoWorker ? shapes.worker : {}),
  };

  const problems: string[] = [];
  const result = z.object(shape).safeParse(process.env);
  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${String(issue.path[0])} is missing or not valid`);
    }
  }

  // An allowed origin is just the address: no path and no trailing slash.
  for (const origin of (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      if (new URL(origin).origin !== origin) {
        problems.push(`CORS_ORIGINS: "${origin}" must be only the address, like ${new URL(origin).origin} (no path, no trailing slash)`);
      }
    } catch {
      problems.push(`CORS_ORIGINS: "${origin}" is not a valid address`);
    }
  }

  if (problems.length === 0) return;
  const message = `Configuration problems (${role}):\n- ${problems.join("\n- ")}`;
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(message);
}

// TRUST_PROXY: "false" (default), "true", or a number of proxy hops, like "1".
export function parseTrustProxy(value: string | undefined): boolean | number {
  if (!value || value === "false") return false;
  if (value === "true") return true;
  const hops = Number(value);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}