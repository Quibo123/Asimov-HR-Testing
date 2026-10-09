-- CreateEnum
CREATE TYPE "platform"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "platform"."ApprovalStepStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "platform"."ApproverRule" AS ENUM ('MANAGER', 'ROLE', 'PERSON');

-- AlterTable
ALTER TABLE "platform"."Membership" ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "platform"."ApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "subjectEntity" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "platform"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "eventPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."ApprovalStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rule" "platform"."ApproverRule" NOT NULL,
    "approverRole" "platform"."Role",
    "approverUserId" TEXT,
    "assignedUserId" TEXT,
    "status" "platform"."ApprovalStepStatus" NOT NULL DEFAULT 'WAITING',
    "decidedById" TEXT,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_status_idx" ON "platform"."ApprovalRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_requesterId_idx" ON "platform"."ApprovalRequest"("tenantId", "requesterId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_module_subjectEntity_subjectId_idx" ON "platform"."ApprovalRequest"("tenantId", "module", "subjectEntity", "subjectId");

-- CreateIndex
CREATE INDEX "ApprovalStep_status_activatedAt_idx" ON "platform"."ApprovalStep"("status", "activatedAt");

-- CreateIndex
CREATE INDEX "ApprovalStep_tenantId_assignedUserId_status_idx" ON "platform"."ApprovalStep"("tenantId", "assignedUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_requestId_position_key" ON "platform"."ApprovalStep"("requestId", "position");

-- AddForeignKey
ALTER TABLE "platform"."ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."ApprovalStep" ADD CONSTRAINT "ApprovalStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "platform"."ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
