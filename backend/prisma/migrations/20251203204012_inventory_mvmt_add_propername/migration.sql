-- AlterTable
ALTER TABLE `InventoryMovement` ADD COLUMN `properName` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `InventoryMovement_companyId_properName_occurredAt_idx` ON `InventoryMovement`(`companyId`, `properName`, `occurredAt`);
