-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "status" "ApplicationStatus" NOT NULL DEFAULT 'ACTIVE';
