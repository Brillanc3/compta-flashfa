/*
  Warnings:

  - You are about to drop the column `declarationDate` on the `ProductDeclaration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ProductDeclaration` DROP COLUMN `declarationDate`,
    ADD COLUMN `declaredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
