-- CreateTable
CREATE TABLE `CartonSale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `occurredAt` DATETIME(3) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `transactionId` INTEGER NOT NULL,
    `companyEmployeeId` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cartonCount` INTEGER NOT NULL DEFAULT 0,
    `reason` VARCHAR(191) NULL,
    `redistributionNumber` VARCHAR(191) NULL,

    UNIQUE INDEX `CartonSale_transactionId_key`(`transactionId`),
    INDEX `CartonSale_companyId_occurredAt_idx`(`companyId`, `occurredAt`),
    INDEX `CartonSale_companyEmployeeId_occurredAt_idx`(`companyEmployeeId`, `occurredAt`),
    INDEX `CartonSale_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
