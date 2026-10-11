-- CreateEnum
CREATE TYPE "core"."EmployeeStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'NOTICE', 'LEFT');

-- CreateTable
CREATE TABLE "core"."Location" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "weekendDays" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Designation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "userId" TEXT,
    "locationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "managerId" TEXT,
    "joiningDate" DATE NOT NULL,
    "status" "core"."EmployeeStatus" NOT NULL DEFAULT 'ONBOARDING',
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."EmployeeSensitive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bankAccountHolder" TEXT,
    "bankAccountNumber" TEXT,
    "bankCode" TEXT,
    "governmentIdType" TEXT,
    "governmentIdNumber" TEXT,
    "taxIdNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSensitive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."EmployeeEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_name_key" ON "core"."Location"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "core"."Department"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_tenantId_name_key" ON "core"."Designation"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Employee_tenantId_status_idx" ON "core"."Employee"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Employee_tenantId_managerId_idx" ON "core"."Employee"("tenantId", "managerId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_locationId_idx" ON "core"."Employee"("tenantId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_code_key" ON "core"."Employee"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_email_key" ON "core"."Employee"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_userId_key" ON "core"."Employee"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSensitive_employeeId_key" ON "core"."EmployeeSensitive"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSensitive_tenantId_idx" ON "core"."EmployeeSensitive"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeEvent_publishedAt_createdAt_idx" ON "core"."EmployeeEvent"("publishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeEvent_tenantId_idx" ON "core"."EmployeeEvent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeEvent_employeeId_dedupeKey_key" ON "core"."EmployeeEvent"("employeeId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "core"."Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Designation" ADD CONSTRAINT "Designation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "core"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "core"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "core"."Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "core"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."EmployeeSensitive" ADD CONSTRAINT "EmployeeSensitive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."EmployeeSensitive" ADD CONSTRAINT "EmployeeSensitive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "core"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."EmployeeEvent" ADD CONSTRAINT "EmployeeEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
