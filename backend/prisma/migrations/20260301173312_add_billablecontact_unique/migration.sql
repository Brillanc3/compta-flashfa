/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `BillableContact` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `BillableContact_userId_unique` ON `BillableContact`(`userId`);
