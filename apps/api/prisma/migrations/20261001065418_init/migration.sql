-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "onboard";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "talently";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "time";

-- CreateTable
CREATE TABLE "talently"."TalentlyPlaceholder" (
    "id" TEXT NOT NULL,

    CONSTRAINT "TalentlyPlaceholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."CorePlaceholder" (
    "id" TEXT NOT NULL,

    CONSTRAINT "CorePlaceholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboard"."OnboardPlaceholder" (
    "id" TEXT NOT NULL,

    CONSTRAINT "OnboardPlaceholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time"."TimePlaceholder" (
    "id" TEXT NOT NULL,

    CONSTRAINT "TimePlaceholder_pkey" PRIMARY KEY ("id")
);
