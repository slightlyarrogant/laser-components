/*
  Warnings:

  - You are about to drop the column `application_id` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `leads` table. All the data in the column will be lost.
  - Added the required column `productId` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_application_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_product_id_fkey";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "application_id",
DROP COLUMN "product_id",
ADD COLUMN     "applicationId" INTEGER,
ADD COLUMN     "organizationId" INTEGER,
ADD COLUMN     "productId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
