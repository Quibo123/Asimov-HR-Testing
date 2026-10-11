import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

export type HttpError = { statusCode: number; error: string; message: string };

const NAMES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

function http(statusCode: number, message: string): HttpError {
  return { statusCode, error: NAMES[statusCode] ?? (statusCode >= 500 ? "Server Error" : "Request Error"), message };
}

// Database problems that are temporary, so the caller should simply try again.
const TEMPORARY_DB_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2028"]);

// Errors from Fastify or plugins (bad JSON, body too large, rate limit...) carry a 4xx statusCode.
function clientStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("statusCode" in err)) return null;
  const status = (err as { statusCode: unknown }).statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : null;
}

export function toHttpError(err: unknown): HttpError {
  // Errors we threw on purpose (404 not found, 403 not allowed, 409 conflict, ...).
  if (err instanceof AppError) return http(err.statusCode, err.message);

  if (err instanceof ZodError) {
    return http(400, err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return http(404, "The item was not found.");
    if (err.code === "P2002") return http(409, "That already exists.");
    if (err.code === "P2003") {
      return http(409, "That item is still in use, or it refers to something that does not exist.");
    }
    if (TEMPORARY_DB_CODES.has(err.code)) {
      return http(503, "The service is busy or temporarily unavailable. Please try again in a moment.");
    }
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return http(503, "The service is busy or temporarily unavailable. Please try again in a moment.");
  }

  const status = clientStatus(err);
  if (status !== null) {
    const message = (err as { message?: unknown }).message;
    return http(status, typeof message === "string" && message ? message : "The request could not be processed.");
  }

  // Anything else is a bug. Never show its details to the caller.
  return http(500, "Something went wrong on our side.");
}