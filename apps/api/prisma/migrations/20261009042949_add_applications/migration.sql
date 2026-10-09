/*
  Warnings:

  - The values [SCORING,FAILED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `submissionCount` on the `Application` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "talently"."ApplicationStatus_new" AS ENUM ('RECEIVED', 'SCORED');
ALTER TABLE "talently"."Application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "talently"."Application" ALTER COLUMN "status" TYPE "talently"."ApplicationStatus_new" USING ("status"::text::"talently"."ApplicationStatus_new");
ALTER TYPE "talently"."ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "talently"."ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "talently"."ApplicationStatus_old";
ALTER TABLE "talently"."Application" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
COMMIT;

-- DropIndex
DROP INDEX "talently"."Answer_questionId_idx";

-- DropIndex
DROP INDEX "talently"."Application_tenantId_jobId_idx";

-- AlterTable
ALTER TABLE "talently"."Application" DROP COLUMN "submissionCount",
ADD COLUMN     "resumeKey" TEXT;

-- CreateIndex
CREATE INDEX "Application_tenantId_status_idx" ON "talently"."Application"("tenantId", "status");
