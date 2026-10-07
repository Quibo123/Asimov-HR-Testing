-- CreateTable
CREATE TABLE "platform"."AuditEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEntry_tenantId_createdAt_idx" ON "platform"."AuditEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEntry_tenantId_entity_entityId_idx" ON "platform"."AuditEntry"("tenantId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "platform"."AuditEntry" ADD CONSTRAINT "AuditEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "platform"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit rows are append-only: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION platform.audit_entry_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEntry rows cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entry_no_update_delete
BEFORE UPDATE OR DELETE ON platform."AuditEntry"
FOR EACH ROW EXECUTE FUNCTION platform.audit_entry_immutable();
