-- CreateEnum
CREATE TYPE "talently"."ApplicationSource" AS ENUM ('portal', 'import');

-- AlterEnum
ALTER TYPE "talently"."ApplicationStatus" ADD VALUE 'IMPORTED';

-- AlterTable
ALTER TABLE "talently"."Application" ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "source" "talently"."ApplicationSource" NOT NULL DEFAULT 'portal',
ALTER COLUMN "consentAt" DROP NOT NULL;
