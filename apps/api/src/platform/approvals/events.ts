export type ApprovalDecidedEvent = {
  requestId: string;
  tenantId: string;
  module: string; // the module that asked for the approval
  type: string;
  subjectEntity: string;
  subjectId: string;
  requesterId: string;
  status: "APPROVED" | "REJECTED" | "WITHDRAWN";
  decidedAt: string; // ISO 8601, UTC
};

export type ApprovalHandler = (event: ApprovalDecidedEvent) => Promise<void>;

const handlers = new Map<string, ApprovalHandler[]>();

// A module registers its handler once at start-up:
//   onApprovalDecided("time", async (event) => { ... });
// Delivery is at least once, so a handler must tolerate seeing the same requestId twice.
export function onApprovalDecided(module: string, handler: ApprovalHandler) {
  handlers.set(module, [...(handlers.get(module) ?? []), handler]);
}

export async function dispatchApprovalDecided(event: ApprovalDecidedEvent) {
  const list = handlers.get(event.module) ?? [];
  // One log line per event, so you can see it arrive while testing.
  console.log(JSON.stringify({ msg: "approval.decided", handlers: list.length, ...event }));
  for (const handler of list) {
    await handler(event);
  }
}