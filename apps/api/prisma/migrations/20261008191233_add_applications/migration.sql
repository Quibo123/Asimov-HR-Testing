-- CreateEnum
CREATE TYPE "talently"."ApplicationStatus" AS ENUM ('RECEIVED', 'SCORING', 'SCORED', 'FAILED');

-- CreateTable
CREATE TABLE "talently"."Application" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "talently"."ApplicationStatus" NOT NULL DEFAULT 'RECEIVED',
    "submissionCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talently"."Answer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_tenantId_jobId_idx" ON "talently"."Application"("tenantId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_email_key" ON "talently"."Application"("jobId", "email");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "talently"."Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_applicationId_questionId_key" ON "talently"."Answer"("applicationId", "questionId");

-- AddForeignKey
ALTER TABLE "talently"."Application" ADD CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "talently"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Answer" ADD CONSTRAINT "Answer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "talently"."Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "talently"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
