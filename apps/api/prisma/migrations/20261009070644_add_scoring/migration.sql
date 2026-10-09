-- CreateEnum
CREATE TYPE "talently"."ScoringMethod" AS ENUM ('form', 'ai', 'both');

-- AlterTable
ALTER TABLE "talently"."Job" ADD COLUMN     "scoringMethod" "talently"."ScoringMethod" NOT NULL DEFAULT 'form';

-- CreateTable
CREATE TABLE "platform"."TenantSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talently"."Score" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scorer" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "mustHavesFailed" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSetting_tenantId_key_key" ON "platform"."TenantSetting"("tenantId", "key");

-- CreateIndex
CREATE INDEX "Score_tenantId_idx" ON "talently"."Score"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_applicationId_scorer_key" ON "talently"."Score"("applicationId", "scorer");

-- AddForeignKey
ALTER TABLE "platform"."TenantSetting" ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Score" ADD CONSTRAINT "Score_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Score" ADD CONSTRAINT "Score_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "talently"."Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
