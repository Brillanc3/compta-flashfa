/*
  Warnings:

  - A unique constraint covering the columns `[publicUuid]` on the table `AssignedContract` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `AssignedContract` ADD COLUMN `publicEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `publicRevokedAt` DATETIME(3) NULL,
    ADD COLUMN `publicUuid` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PawnshopPartner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `buyPrice` DECIMAL(10, 2) NOT NULL,
    `resalePrice` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPartnerBuyPrice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `buyPrice` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopPartnerBuyPrice_companyId_idx`(`companyId`),
    INDEX `PawnshopPartnerBuyPrice_partnerId_idx`(`partnerId`),
    INDEX `PawnshopPartnerBuyPrice_productId_idx`(`productId`),
    UNIQUE INDEX `PawnshopPartnerBuyPrice_partnerId_productId_key`(`partnerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPurchase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `createdByEmployeeId` INTEGER NOT NULL,
    `partnerId` INTEGER NULL,
    `status` ENUM('DRAFT', 'VALIDATED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `totalBuyAmount` DECIMAL(10, 2) NULL,
    `totalResaleAmount` DECIMAL(10, 2) NULL,
    `validatedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopPurchase_companyId_idx`(`companyId`),
    INDEX `PawnshopPurchase_clientId_idx`(`clientId`),
    INDEX `PawnshopPurchase_createdByEmployeeId_idx`(`createdByEmployeeId`),
    INDEX `PawnshopPurchase_partnerId_idx`(`partnerId`),
    INDEX `PawnshopPurchase_status_idx`(`status`),
    INDEX `PawnshopPurchase_validatedAt_idx`(`validatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPurchaseItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unitBuyPrice` DECIMAL(10, 2) NOT NULL,
    `lineTotal` DECIMAL(10, 2) NOT NULL,
    `unitResalePrice` DECIMAL(10, 2) NOT NULL,
    `resaleLineTotal` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopPurchaseItem_purchaseId_idx`(`purchaseId`),
    INDEX `PawnshopPurchaseItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AssignedContract_publicUuid_key` ON `AssignedContract`(`publicUuid`);

-- AddForeignKey
ALTER TABLE `PawnshopPartner` ADD CONSTRAINT `PawnshopPartner_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopProduct` ADD CONSTRAINT `PawnshopProduct_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `PawnshopPartner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `PawnshopPartner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchaseItem` ADD CONSTRAINT `PawnshopPurchaseItem_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `PawnshopPurchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchaseItem` ADD CONSTRAINT `PawnshopPurchaseItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
