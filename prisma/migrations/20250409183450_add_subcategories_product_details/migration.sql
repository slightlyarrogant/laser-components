/*
  Warnings:

  - You are about to drop the column `category_id` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subcategory_id` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "category_id",
ADD COLUMN     "datasheet_url" TEXT,
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "subcategory_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "subcategories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_name_key" ON "subcategories"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
