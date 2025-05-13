/*
  Warnings:

  - A unique constraint covering the columns `[name,subcategory_id]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "products_name_subcategory_id_key" ON "products"("name", "subcategory_id");
