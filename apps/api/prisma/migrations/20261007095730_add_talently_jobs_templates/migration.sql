-- CreateEnum
CREATE TYPE "talently"."QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO', 'NUMBER_BANDS', 'RATING', 'SHORT_TEXT', 'FILE');

-- CreateEnum
CREATE TYPE "talently"."JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateTable
CREATE TABLE "talently"."QuestionnaireTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talently"."Question" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "talently"."QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "mustHave" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talently"."Option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talently"."Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "talently"."JobStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionnaireTemplate_tenantId_idx" ON "talently"."QuestionnaireTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireTemplate_groupId_version_key" ON "talently"."QuestionnaireTemplate"("groupId", "version");

-- CreateIndex
CREATE INDEX "Question_templateId_idx" ON "talently"."Question"("templateId");

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "talently"."Option"("questionId");

-- CreateIndex
CREATE INDEX "Job_tenantId_status_idx" ON "talently"."Job"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "talently"."QuestionnaireTemplate" ADD CONSTRAINT "QuestionnaireTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Question" ADD CONSTRAINT "Question_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "talently"."QuestionnaireTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "talently"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "platform"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talently"."Job" ADD CONSTRAINT "Job_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "talently"."QuestionnaireTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
