-- AlterTable
ALTER TABLE `InventoryMovement` ADD COLUMN `owner` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `InventoryMovement_companyId_owner_occurredAt_idx` ON `InventoryMovement`(`companyId`, `owner`, `occurredAt`);
