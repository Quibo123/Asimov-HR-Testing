import { prisma, Prisma, type Tx } from "../../../platform/prisma.js";
import { forTenant } from "../../../platform/for-tenant.js";
import { audit } from "../../../platform/audit.js";
import { AppError } from "../../../platform/errors.js";
import { can } from "../../../platform/permissions.js";
import { enqueueEmployeeEvent } from "../../../platform/queue.js";
import type { Ctx } from "../../../platform/ctx.js";
import { dispatchEmployeeEvent, type EmployeeEvent, type EmployeeEventType } from "./events.js";
import { computeChanges, formatDateOnly, parseDateOnly } from "./pure.js";
import type {
  EmployeeCreate,
  EmployeeUpdate,
  ListQuery,
  LocationCreate,
  LocationUpdate,
  NameInput,
  SensitiveInput,
} from "./schemas.js";

// HR can do everything. Everyone else only sees their own record and their direct reports.
const isHr = (ctx: Ctx) => can(ctx.role, "core.employees.manage");

// ======================= Locations =======================

const locationSelect = {
  id: true,
  name: true,
  country: true,
  timeZone: true,
  weekendDays: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listLocations(tenantId: string) {
  return prisma.location.findMany({
    where: { ...forTenant(tenantId) },
    select: locationSelect,
    orderBy: { name: "asc" },
  });
}

export async function createLocation(ctx: Ctx, input: LocationCreate) {
  return prisma.$transaction(async (tx) => {
    const same = await tx.location.findFirst({
      where: { ...forTenant(ctx.tenantId), name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (same) throw new AppError(409, `A location called "${input.name}" already exists.`);

    const row = await tx.location.create({
      data: {
        ...forTenant(ctx.tenantId),
        name: input.name,
        country: input.country,
        timeZone: input.timeZone,
        weekendDays: [...input.weekendDays].sort((a, b) => a - b),
      },
      select: locationSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "location.created",
      entity: "Location",
      entityId: row.id,
      after: row,
    });
    return row;
  });
}

export async function updateLocation(ctx: Ctx, id: string, input: LocationUpdate) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.location.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: locationSelect,
    });
    if (!before) throw new AppError(404, "Location not found.");

    if (input.name && input.name.toLowerCase() !== before.name.toLowerCase()) {
      const same = await tx.location.findFirst({
        where: {
          ...forTenant(ctx.tenantId),
          id: { not: id },
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (same) throw new AppError(409, `A location called "${input.name}" already exists.`);
    }

    const after = await tx.location.update({
      where: { id, ...forTenant(ctx.tenantId) },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
        ...(input.weekendDays !== undefined
          ? { weekendDays: [...input.weekendDays].sort((a, b) => a - b) }
          : {}),
      },
      select: locationSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "location.updated",
      entity: "Location",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function deleteLocation(ctx: Ctx, id: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.location.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: locationSelect,
    });
    if (!before) throw new AppError(404, "Location not found.");

    const inUse = await tx.employee.count({ where: { ...forTenant(ctx.tenantId), locationId: id } });
    if (inUse > 0) {
      throw new AppError(409, `${inUse} employee(s) still work at this location. Move them first.`);
    }

    await tx.location.delete({ where: { id, ...forTenant(ctx.tenantId) } });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "location.deleted",
      entity: "Location",
      entityId: id,
      before,
    });
  });
}

// ======================= Departments =======================

const lookupSelect = { id: true, name: true, createdAt: true, updatedAt: true } as const;

export async function listDepartments(tenantId: string) {
  return prisma.department.findMany({
    where: { ...forTenant(tenantId) },
    select: lookupSelect,
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(ctx: Ctx, input: NameInput) {
  return prisma.$transaction(async (tx) => {
    const same = await tx.department.findFirst({
      where: { ...forTenant(ctx.tenantId), name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (same) throw new AppError(409, `A department called "${input.name}" already exists.`);

    const row = await tx.department.create({
      data: { ...forTenant(ctx.tenantId), name: input.name },
      select: lookupSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "department.created",
      entity: "Department",
      entityId: row.id,
      after: row,
    });
    return row;
  });
}

export async function updateDepartment(ctx: Ctx, id: string, input: NameInput) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.department.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: lookupSelect,
    });
    if (!before) throw new AppError(404, "Department not found.");

    const same = await tx.department.findFirst({
      where: {
        ...forTenant(ctx.tenantId),
        id: { not: id },
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (same) throw new AppError(409, `A department called "${input.name}" already exists.`);

    const after = await tx.department.update({
      where: { id, ...forTenant(ctx.tenantId) },
      data: { name: input.name },
      select: lookupSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "department.updated",
      entity: "Department",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function deleteDepartment(ctx: Ctx, id: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.department.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: lookupSelect,
    });
    if (!before) throw new AppError(404, "Department not found.");

    const inUse = await tx.employee.count({ where: { ...forTenant(ctx.tenantId), departmentId: id } });
    if (inUse > 0) throw new AppError(409, `${inUse} employee(s) still belong to this department.`);

    await tx.department.delete({ where: { id, ...forTenant(ctx.tenantId) } });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "department.deleted",
      entity: "Department",
      entityId: id,
      before,
    });
  });
}

// ======================= Designations =======================

export async function listDesignations(tenantId: string) {
  return prisma.designation.findMany({
    where: { ...forTenant(tenantId) },
    select: lookupSelect,
    orderBy: { name: "asc" },
  });
}

export async function createDesignation(ctx: Ctx, input: NameInput) {
  return prisma.$transaction(async (tx) => {
    const same = await tx.designation.findFirst({
      where: { ...forTenant(ctx.tenantId), name: { equals: input.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (same) throw new AppError(409, `A designation called "${input.name}" already exists.`);

    const row = await tx.designation.create({
      data: { ...forTenant(ctx.tenantId), name: input.name },
      select: lookupSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "designation.created",
      entity: "Designation",
      entityId: row.id,
      after: row,
    });
    return row;
  });
}

export async function updateDesignation(ctx: Ctx, id: string, input: NameInput) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.designation.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: lookupSelect,
    });
    if (!before) throw new AppError(404, "Designation not found.");

    const same = await tx.designation.findFirst({
      where: {
        ...forTenant(ctx.tenantId),
        id: { not: id },
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (same) throw new AppError(409, `A designation called "${input.name}" already exists.`);

    const after = await tx.designation.update({
      where: { id, ...forTenant(ctx.tenantId) },
      data: { name: input.name },
      select: lookupSelect,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "designation.updated",
      entity: "Designation",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function deleteDesignation(ctx: Ctx, id: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.designation.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: lookupSelect,
    });
    if (!before) throw new AppError(404, "Designation not found.");

    const inUse = await tx.employee.count({ where: { ...forTenant(ctx.tenantId), designationId: id } });
    if (inUse > 0) throw new AppError(409, `${inUse} employee(s) still have this designation.`);

    await tx.designation.delete({ where: { id, ...forTenant(ctx.tenantId) } });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "designation.deleted",
      entity: "Designation",
      entityId: id,
      before,
    });
  });
}

// ======================= Employees: shape and visibility =======================

const employeeSelect = {
  id: true,
  code: true,
  name: true,
  email: true,
  phone: true,
  userId: true,
  locationId: true,
  departmentId: true,
  designationId: true,
  managerId: true,
  joiningDate: true,
  status: true,
  customFields: true,
  createdAt: true,
  updatedAt: true,
  location: { select: { id: true, name: true, timeZone: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true, code: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

// Bank and ID details are NOT part of this shape. They live in EmployeeSensitive.
function toDto(row: EmployeeRow) {
  return { ...row, joiningDate: formatDateOnly(row.joiningDate) };
}

async function actorEmployeeId(db: Tx, tenantId: string, userId: string): Promise<string | null> {
  const mine = await db.employee.findFirst({
    where: { ...forTenant(tenantId), userId },
    select: { id: true },
  });
  return mine?.id ?? null;
}

// What this person may see: HR sees everyone; others see themselves and their direct reports.
async function visibleTo(db: Tx, ctx: Ctx): Promise<Prisma.EmployeeWhereInput> {
  if (isHr(ctx)) return {};
  const mine = await actorEmployeeId(db, ctx.tenantId, ctx.actorId);
  if (!mine) return { id: { in: [] } }; // no employee record: nothing to see
  return { OR: [{ id: mine }, { managerId: mine }] };
}

export async function listEmployees(ctx: Ctx, query: ListQuery) {
  const visible = await visibleTo(prisma, ctx);
  const search: Prisma.EmployeeWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { code: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
        ],
      }
    : {};

  const rows = await prisma.employee.findMany({
    where: {
      ...forTenant(ctx.tenantId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      AND: [visible, search],
    },
    select: employeeSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const items = rows.slice(0, query.limit);
  return {
    items: items.map(toDto),
    nextCursor: rows.length > query.limit ? items[items.length - 1].id : null,
  };
}

export async function getEmployee(ctx: Ctx, id: string) {
  const visible = await visibleTo(prisma, ctx);
  const row = await prisma.employee.findFirst({
    where: { id, ...forTenant(ctx.tenantId), AND: [visible] },
    select: employeeSelect,
  });
  // Not allowed looks the same as not found, so nobody learns who exists.
  if (!row) throw new AppError(404, "Employee not found.");
  return toDto(row);
}

export async function getMyEmployee(ctx: Ctx) {
  const row = await prisma.employee.findFirst({
    where: { ...forTenant(ctx.tenantId), userId: ctx.actorId },
    select: employeeSelect,
  });
  if (!row) throw new AppError(404, "You do not have an employee record in this organisation.");
  return toDto(row);
}

// ======================= Employees: checks =======================

async function lockEmployee(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM core."Employee" WHERE id = ${id} FOR UPDATE`;
}

async function assertRefs(
  tx: Tx,
  tenantId: string,
  refs: { locationId?: string | null; departmentId?: string | null; designationId?: string | null; managerId?: string | null },
) {
  const missing = (field: string, what: string) =>
    new AppError(400, `${field}: that ${what} does not exist in this organisation.`);

  if (refs.locationId) {
    const found = await tx.location.findFirst({
      where: { id: refs.locationId, ...forTenant(tenantId) },
      select: { id: true },
    });
    if (!found) throw missing("locationId", "location");
  }
  if (refs.departmentId) {
    const found = await tx.department.findFirst({
      where: { id: refs.departmentId, ...forTenant(tenantId) },
      select: { id: true },
    });
    if (!found) throw missing("departmentId", "department");
  }
  if (refs.designationId) {
    const found = await tx.designation.findFirst({
      where: { id: refs.designationId, ...forTenant(tenantId) },
      select: { id: true },
    });
    if (!found) throw missing("designationId", "designation");
  }
  if (refs.managerId) {
    const found = await tx.employee.findFirst({
      where: { id: refs.managerId, ...forTenant(tenantId) },
      select: { id: true },
    });
    if (!found) throw missing("managerId", "manager");
  }
}

async function assertUnique(
  tx: Tx,
  tenantId: string,
  fields: { code?: string; email?: string },
  exceptId?: string,
) {
  const other = exceptId ? { id: { not: exceptId } } : {};
  if (fields.code) {
    const found = await tx.employee.findFirst({
      where: { ...forTenant(tenantId), ...other, code: { equals: fields.code, mode: "insensitive" } },
      select: { id: true },
    });
    if (found) throw new AppError(409, `The employee code "${fields.code}" is already used.`);
  }
  if (fields.email) {
    const found = await tx.employee.findFirst({
      where: { ...forTenant(tenantId), ...other, email: fields.email },
      select: { id: true },
    });
    if (found) throw new AppError(409, `An employee with the email "${fields.email}" already exists.`);
  }
}

// A person cannot report to themselves, directly or through a chain of managers.
async function assertNoManagerLoop(tx: Tx, tenantId: string, employeeId: string, managerId: string) {
  let current: string | null = managerId;
  for (let step = 0; current && step < 50; step++) {
    if (current === employeeId) {
      throw new AppError(400, "managerId: that would make the reporting line a loop.");
    }
    const row: { managerId: string | null } | null = await tx.employee.findFirst({
      where: { id: current, ...forTenant(tenantId) },
      select: { managerId: true },
    });
    current = row?.managerId ?? null;
  }
}

async function assertUserLinkable(tx: Tx, tenantId: string, userId: string, exceptEmployeeId?: string) {
  const member = await tx.membership.findFirst({
    where: { userId, ...forTenant(tenantId) },
    select: { id: true },
  });
  if (!member) throw new AppError(400, "userId: that user is not a member of this organisation.");

  const taken = await tx.employee.findFirst({
    where: {
      ...forTenant(tenantId),
      userId,
      ...(exceptEmployeeId ? { id: { not: exceptEmployeeId } } : {}),
    },
    select: { id: true },
  });
  if (taken) throw new AppError(409, "userId: that user is already linked to another employee.");
}

// With no userId given, link the employee to the signed-in account that has the same email, if any.
async function autoLinkedUserId(tx: Tx, tenantId: string, email: string): Promise<string | null> {
  const user = await tx.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return null;

  const member = await tx.membership.findFirst({
    where: { userId: user.id, ...forTenant(tenantId) },
    select: { id: true },
  });
  if (!member) return null;

  const taken = await tx.employee.findFirst({
    where: { ...forTenant(tenantId), userId: user.id },
    select: { id: true },
  });
  return taken ? null : user.id;
}

// ======================= Events (saved with the change, delivered afterwards) =======================

async function addEvent(
  tx: Tx,
  tenantId: string,
  employeeId: string,
  type: EmployeeEventType,
  dedupeKey: string,
  data: unknown,
): Promise<string> {
  const event = await tx.employeeEvent.create({
    data: {
      ...forTenant(tenantId),
      employeeId,
      type,
      dedupeKey,
      data: data as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return event.id;
}

async function queueEvent(eventId: string) {
  try {
    await enqueueEmployeeEvent(eventId);
  } catch (err) {
    // The event is saved. The 10-minute sweep queues it again.
    console.error(JSON.stringify({ msg: "employee.event_queue_failed", eventId, error: String(err) }));
  }
}

// Runs in the worker: hand the event to the modules that listen, then mark it as published.
export async function deliverEmployeeEvent(eventId: string) {
  const row = await prisma.employeeEvent.findUnique({ where: { id: eventId } });
  if (!row || row.publishedAt) return; // already delivered: a repeated job does nothing

  const event: EmployeeEvent = {
    id: row.id,
    type: row.type as EmployeeEventType,
    tenantId: row.tenantId,
    employeeId: row.employeeId,
    occurredAt: row.createdAt.toISOString(),
    data: row.data,
  };
  await dispatchEmployeeEvent(event);

  await prisma.employeeEvent.updateMany({
    where: { id: row.id, ...forTenant(row.tenantId), publishedAt: null },
    data: { publishedAt: new Date() },
  });
}

// If an event was saved but its job never got queued (for example the server stopped), queue it now.
export async function republishMissedEmployeeEvents() {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  // Cross-tenant on purpose: this is a system job.
  const missed = await prisma.employeeEvent.findMany({
    where: { publishedAt: null, createdAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  for (const item of missed) {
    await queueEvent(item.id);
  }
}

// ======================= Employees: create and update =======================

export async function createEmployee(ctx: Ctx, input: EmployeeCreate) {
  const created = await prisma.$transaction(async (tx) => {
    await assertRefs(tx, ctx.tenantId, input);
    await assertUnique(tx, ctx.tenantId, { code: input.code, email: input.email });

    let userId: string | null;
    if (input.userId) {
      await assertUserLinkable(tx, ctx.tenantId, input.userId);
      userId = input.userId;
    } else if (input.userId === null) {
      userId = null; // HR said: no sign-in account
    } else {
      userId = await autoLinkedUserId(tx, ctx.tenantId, input.email);
    }

    let row: EmployeeRow;
    try {
      row = await tx.employee.create({
        data: {
          ...forTenant(ctx.tenantId),
          code: input.code,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          userId,
          locationId: input.locationId,
          departmentId: input.departmentId ?? null,
          designationId: input.designationId ?? null,
          managerId: input.managerId ?? null,
          joiningDate: parseDateOnly(input.joiningDate),
          status: input.status,
          customFields: input.customFields as Prisma.InputJsonValue,
        },
        select: employeeSelect,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "An employee with that code, email or linked user already exists.");
      }
      throw err;
    }

    const dto = toDto(row);
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "employee.created",
      entity: "Employee",
      entityId: row.id,
      after: dto,
    });
    // One "created" event per employee: the (employeeId, dedupeKey) key makes a second one impossible.
    const eventId = await addEvent(tx, ctx.tenantId, row.id, "employee.created", "created", { employee: dto });
    return { dto, eventId };
  });

  await queueEvent(created.eventId);
  return created.dto;
}

export async function updateEmployee(ctx: Ctx, id: string, input: EmployeeUpdate) {
  const outcome = await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, id);

    const before = await tx.employee.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      select: employeeSelect,
    });
    if (!before) throw new AppError(404, "Employee not found.");

    // A missing field keeps its value; null clears an optional field.
    const pick = <T>(incoming: T | undefined, current: T): T => (incoming === undefined ? current : incoming);

    const current = {
      code: before.code,
      name: before.name,
      email: before.email,
      phone: before.phone,
      userId: before.userId,
      locationId: before.locationId,
      departmentId: before.departmentId,
      designationId: before.designationId,
      managerId: before.managerId,
      joiningDate: formatDateOnly(before.joiningDate),
      status: before.status,
      customFields: before.customFields as Record<string, unknown>,
    };
    const next = {
      code: pick(input.code, current.code),
      name: pick(input.name, current.name),
      email: pick(input.email, current.email),
      phone: pick(input.phone, current.phone),
      userId: pick(input.userId, current.userId),
      locationId: pick(input.locationId, current.locationId),
      departmentId: pick(input.departmentId, current.departmentId),
      designationId: pick(input.designationId, current.designationId),
      managerId: pick(input.managerId, current.managerId),
      joiningDate: pick(input.joiningDate, current.joiningDate),
      status: pick(input.status, current.status),
      customFields: pick(input.customFields as Record<string, unknown> | undefined, current.customFields),
    };

    const changes = computeChanges(current, next);
    // Nothing really changed: write nothing and publish nothing.
    if (Object.keys(changes).length === 0) return { dto: toDto(before), eventId: null };

    await assertUnique(
      tx,
      ctx.tenantId,
      { code: changes.code ? next.code : undefined, email: changes.email ? next.email : undefined },
      id,
    );
    await assertRefs(tx, ctx.tenantId, {
      locationId: changes.locationId ? next.locationId : undefined,
      departmentId: changes.departmentId ? next.departmentId : undefined,
      designationId: changes.designationId ? next.designationId : undefined,
      managerId: changes.managerId ? next.managerId : undefined,
    });
    if (changes.managerId && next.managerId) {
      if (next.managerId === id) throw new AppError(400, "managerId: a person cannot be their own manager.");
      await assertNoManagerLoop(tx, ctx.tenantId, id, next.managerId);
    }
    if (changes.userId && next.userId) await assertUserLinkable(tx, ctx.tenantId, next.userId, id);

    let after: EmployeeRow;
    try {
      after = await tx.employee.update({
        where: { id, ...forTenant(ctx.tenantId) },
        data: {
          code: next.code,
          name: next.name,
          email: next.email,
          phone: next.phone,
          userId: next.userId,
          locationId: next.locationId,
          departmentId: next.departmentId,
          designationId: next.designationId,
          managerId: next.managerId,
          joiningDate: parseDateOnly(next.joiningDate),
          status: next.status,
          customFields: next.customFields as Prisma.InputJsonValue,
        },
        select: employeeSelect,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "An employee with that code, email or linked user already exists.");
      }
      throw err;
    }

    const dto = toDto(after);
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "employee.updated",
      entity: "Employee",
      entityId: id,
      before: toDto(before),
      after: dto,
    });
    const eventId = await addEvent(tx, ctx.tenantId, id, "employee.updated", `updated:${after.updatedAt.getTime()}`, {
      employee: dto,
      changes,
    });
    return { dto, eventId };
  });

  if (outcome.eventId) await queueEvent(outcome.eventId);
  return outcome.dto;
}

// ======================= Sensitive details (HR only) =======================

const SENSITIVE_FIELDS = [
  "bankAccountHolder",
  "bankAccountNumber",
  "bankCode",
  "governmentIdType",
  "governmentIdNumber",
  "taxIdNumber",
] as const;

const sensitiveSelect = {
  bankAccountHolder: true,
  bankAccountNumber: true,
  bankCode: true,
  governmentIdType: true,
  governmentIdNumber: true,
  taxIdNumber: true,
  updatedAt: true,
} as const;

// Every read is written to the audit log in the SAME transaction. If the log cannot be written,
// nothing is returned. The log holds field names only, never the values.
export async function readSensitive(ctx: Ctx, employeeId: string) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, ...forTenant(ctx.tenantId) },
      select: { id: true },
    });
    if (!employee) throw new AppError(404, "Employee not found.");

    const row = await tx.employeeSensitive.findFirst({
      where: { employeeId, ...forTenant(ctx.tenantId) },
      select: sensitiveSelect,
    });

    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "employee.sensitive_read",
      entity: "EmployeeSensitive",
      entityId: employeeId,
      after: { fieldsReturned: row ? SENSITIVE_FIELDS.filter((f) => row[f] !== null) : [] },
    });

    return {
      employeeId,
      bankAccountHolder: row?.bankAccountHolder ?? null,
      bankAccountNumber: row?.bankAccountNumber ?? null,
      bankCode: row?.bankCode ?? null,
      governmentIdType: row?.governmentIdType ?? null,
      governmentIdNumber: row?.governmentIdNumber ?? null,
      taxIdNumber: row?.taxIdNumber ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

// Returns only the NAMES of the fields that were changed, never their values.
export async function writeSensitive(ctx: Ctx, employeeId: string, input: SensitiveInput) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, ...forTenant(ctx.tenantId) },
      select: { id: true },
    });
    if (!employee) throw new AppError(404, "Employee not found.");

    const data: Record<string, string | null> = {};
    for (const field of SENSITIVE_FIELDS) {
      const value = input[field];
      if (value !== undefined) data[field] = value;
    }

    await tx.employeeSensitive.upsert({
      where: { employeeId },
      create: { ...forTenant(ctx.tenantId), employeeId, ...data },
      update: data,
    });

    const fieldsChanged = Object.keys(data);
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "employee.sensitive_updated",
      entity: "EmployeeSensitive",
      entityId: employeeId,
      after: { fieldsChanged },
    });
    return { employeeId, fieldsChanged };
  });
}