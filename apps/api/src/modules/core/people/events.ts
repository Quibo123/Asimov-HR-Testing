export type EmployeeEventType = "employee.created" | "employee.updated";

export type EmployeeEvent = {
  id: string; // unique per event: consumers can use it to skip a repeat
  type: EmployeeEventType;
  tenantId: string;
  employeeId: string;
  occurredAt: string; // ISO 8601, UTC
  data: unknown; // { employee: {...}, changes?: {...} }. Never contains bank or ID details.
};

export type EmployeeEventHandler = (event: EmployeeEvent) => Promise<void>;

const handlers = new Map<EmployeeEventType, EmployeeEventHandler[]>();

// A module registers its handler once, in the worker process:
//   onEmployeeEvent("employee.created", async (event) => { ... });
// Delivery is at least once, so a handler must tolerate seeing the same event id twice.
export function onEmployeeEvent(type: EmployeeEventType, handler: EmployeeEventHandler) {
  handlers.set(type, [...(handlers.get(type) ?? []), handler]);
}

export async function dispatchEmployeeEvent(event: EmployeeEvent) {
  const list = handlers.get(event.type) ?? [];
  // One log line per event (ids only, no personal details).
  console.log(
    JSON.stringify({
      msg: event.type,
      eventId: event.id,
      employeeId: event.employeeId,
      tenantId: event.tenantId,
      handlers: list.length,
    }),
  );
  for (const handler of list) {
    await handler(event);
  }
}