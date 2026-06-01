-- AlterTable
ALTER TABLE `Bill` ADD COLUMN `accountingDueAt` DATETIME(3) NULL,
    ADD COLUMN `accountingIssuedNotifiedAt` DATETIME(3) NULL,
    ADD COLUMN `accountingLastReminderAt` DATETIME(3) NULL,
    ADD COLUMN `accountingNotifyUserId` INTEGER NULL,
    ADD COLUMN `accountingReminderCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `accountingTargetCompanyId` INTEGER NULL,
    ADD COLUMN `isParentBill` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `recipientCharacterId` INTEGER NULL,
    ADD COLUMN `recipientDiscordId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Bill_accountingTargetCompanyId_fkey` ON `Bill`(`accountingTargetCompanyId`);

-- CreateIndex
CREATE INDEX `Bill_accountingNotifyUserId_fkey` ON `Bill`(`accountingNotifyUserId`);

-- CreateIndex
CREATE INDEX `Bill_isParentBill_status_dueAt_idx` ON `Bill`(`isParentBill`, `status`, `accountingDueAt`);

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_accountingTargetCompanyId_fkey` FOREIGN KEY (`accountingTargetCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_accountingNotifyUserId_fkey` FOREIGN KEY (`accountingNotifyUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
