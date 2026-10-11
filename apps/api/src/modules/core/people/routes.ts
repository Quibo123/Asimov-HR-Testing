import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../../platform/errors.js";
import { ctxFrom } from "../../../platform/ctx.js";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  listQuery,
  locationCreateSchema,
  locationUpdateSchema,
  nameSchema,
  sensitiveSchema,
} from "./schemas.js";
import * as svc from "./service.js";

const idParams = z.object({ id: z.string().uuid() });

export async function peopleRoutes(app: FastifyInstance) {
  // ---------- Locations (everyone can read them, HR changes them) ----------
  app.get("/core/locations", { config: { requires: "authenticated" } }, async (request) => ({
    items: await svc.listLocations(request.tenantId),
  }));

  app.post("/core/locations", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const body = parseOrThrow(locationCreateSchema, request.body);
    return reply.code(201).send(await svc.createLocation(ctxFrom(request), body));
  });

  app.patch("/core/locations/:id", { config: { requires: "core.employees.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(locationUpdateSchema, request.body);
    return svc.updateLocation(ctxFrom(request), id, body);
  });

  app.delete("/core/locations/:id", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    await svc.deleteLocation(ctxFrom(request), id);
    return reply.code(204).send();
  });

  // ---------- Departments ----------
  app.get("/core/departments", { config: { requires: "authenticated" } }, async (request) => ({
    items: await svc.listDepartments(request.tenantId),
  }));

  app.post("/core/departments", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const body = parseOrThrow(nameSchema, request.body);
    return reply.code(201).send(await svc.createDepartment(ctxFrom(request), body));
  });

  app.patch("/core/departments/:id", { config: { requires: "core.employees.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(nameSchema, request.body);
    return svc.updateDepartment(ctxFrom(request), id, body);
  });

  app.delete("/core/departments/:id", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    await svc.deleteDepartment(ctxFrom(request), id);
    return reply.code(204).send();
  });

  // ---------- Designations ----------
  app.get("/core/designations", { config: { requires: "authenticated" } }, async (request) => ({
    items: await svc.listDesignations(request.tenantId),
  }));

  app.post("/core/designations", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const body = parseOrThrow(nameSchema, request.body);
    return reply.code(201).send(await svc.createDesignation(ctxFrom(request), body));
  });

  app.patch("/core/designations/:id", { config: { requires: "core.employees.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(nameSchema, request.body);
    return svc.updateDesignation(ctxFrom(request), id, body);
  });

  app.delete("/core/designations/:id", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    await svc.deleteDesignation(ctxFrom(request), id);
    return reply.code(204).send();
  });

  // ---------- Employees ----------
  // Who sees what is decided in the service: HR sees everyone, a manager sees themselves and
  // their direct reports, everyone else sees only themselves.
  app.get("/core/employees", { config: { requires: "authenticated" } }, async (request) => {
    const query = parseOrThrow(listQuery, request.query);
    return svc.listEmployees(ctxFrom(request), query);
  });

  app.get("/core/employees/me", { config: { requires: "authenticated" } }, async (request) =>
    svc.getMyEmployee(ctxFrom(request)),
  );

  app.get("/core/employees/:id", { config: { requires: "authenticated" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.getEmployee(ctxFrom(request), id);
  });

  app.post("/core/employees", { config: { requires: "core.employees.manage" } }, async (request, reply) => {
    const body = parseOrThrow(employeeCreateSchema, request.body);
    return reply.code(201).send(await svc.createEmployee(ctxFrom(request), body));
  });

  app.patch("/core/employees/:id", { config: { requires: "core.employees.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(employeeUpdateSchema, request.body);
    return svc.updateEmployee(ctxFrom(request), id, body);
  });

  // ---------- Sensitive details: HR only, and every read is audited ----------
  app.get("/core/employees/:id/sensitive", { config: { requires: "core.employees.sensitive" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    reply.header("cache-control", "no-store"); // never keep bank or ID details in a cache
    return svc.readSensitive(ctxFrom(request), id);
  });

  app.put("/core/employees/:id/sensitive", { config: { requires: "core.employees.sensitive" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(sensitiveSchema, request.body);
    return svc.writeSensitive(ctxFrom(request), id, body);
  });
}