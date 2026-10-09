import { z } from "zod";

// One step of an approver chain.
const stepSpec = z.discriminatedUnion("rule", [
  z.object({ rule: z.literal("MANAGER") }),
  z.object({ rule: z.literal("ROLE"), role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }),
  z.object({ rule: z.literal("PERSON"), userId: z.string().uuid() }),
]);

// Used by other modules (in code), never accepted from the outside world.
export const createApprovalSchema = z.object({
  module: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "module must be lowercase letters, digits or _"),
  type: z.string().regex(/^[a-z][a-z0-9_.-]{0,59}$/, "type must be lowercase letters, digits, _ . or -"),
  subjectEntity: z.string().min(1).max(60),
  subjectId: z.string().min(1).max(100),
  summary: z.string().trim().min(1).max(300),
  steps: z.array(stepSpec).min(1).max(10),
});
export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;

export const decideSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.decision === "reject" && (!body.reason || body.reason.length < 3)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required when rejecting (at least 3 characters).",
      });
    }
  });
export type DecideInput = z.infer<typeof decideSchema>;

export const myRequestsQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MyRequestsQuery = z.infer<typeof myRequestsQuery>;