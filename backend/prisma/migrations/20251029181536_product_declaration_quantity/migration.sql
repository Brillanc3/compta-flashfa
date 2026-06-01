/*
  Warnings:

  - You are about to drop the column `metadata` on the `ProductDeclaration` table. All the data in the column will be lost.
  - Added the required column `productNameSnapshot` to the `ProductDeclaration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `ProductDeclaration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ProductDeclaration` DROP COLUMN `metadata`,
    ADD COLUMN `fixedPart` DECIMAL(10, 2) NULL,
    ADD COLUMN `percentPart` DECIMAL(5, 2) NULL,
    ADD COLUMN `percentValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `priceAtSale` DECIMAL(10, 2) NULL,
    ADD COLUMN `productNameSnapshot` VARCHAR(191) NOT NULL,
    ADD COLUMN `quantity` DECIMAL(10, 2) NOT NULL;
