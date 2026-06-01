-- AlterTable
ALTER TABLE `ExpenseReport` ADD COLUMN `status` ENUM('PENDING', 'REIMBURSED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `ExpenseReport_companyId_status_idx` ON `ExpenseReport`(`companyId`, `status`);
