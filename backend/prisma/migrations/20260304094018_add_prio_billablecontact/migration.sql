-- AlterTable
ALTER TABLE `BillableContact` ADD COLUMN `isPrio` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `BillableContact_companyId_isPrio_idx` ON `BillableContact`(`companyId`, `isPrio`);
