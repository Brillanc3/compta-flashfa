-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `occurredAt` DATETIME(3) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `logId` INTEGER NOT NULL,
    `type` ENUM('ADD', 'REMOVE') NOT NULL,
    `itemCode` VARCHAR(191) NOT NULL,
    `itemLabel` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `metadata` LONGTEXT NULL,

    UNIQUE INDEX `InventoryMovement_logId_key`(`logId`),
    INDEX `InventoryMovement_companyId_occurredAt_idx`(`companyId`, `occurredAt`),
    INDEX `InventoryMovement_companyId_userId_occurredAt_idx`(`companyId`, `userId`, `occurredAt`),
    INDEX `InventoryMovement_companyId_itemCode_occurredAt_idx`(`companyId`, `itemCode`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Log_category_logType_idx` ON `Log`(`category`, `logType`);

-- CreateIndex
CREATE INDEX `Log_companyId_category_logType_date_idx` ON `Log`(`companyId`, `category`, `logType`, `date`);

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `Log`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
