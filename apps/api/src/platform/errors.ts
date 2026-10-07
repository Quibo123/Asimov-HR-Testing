import { z } from "zod";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// Validate input; a bad input becomes a clean 400 instead of a 500.
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    throw new AppError(400, message);
  }
  return result.data;
}