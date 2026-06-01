-- CreateTable
CREATE TABLE `ContractShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `createdByUserId` INTEGER NOT NULL,
    `companyId` INTEGER NULL,

    UNIQUE INDEX `ContractShare_publicId_key`(`publicId`),
    INDEX `ContractShare_createdByUserId_createdAt_idx`(`createdByUserId`, `createdAt`),
    INDEX `ContractShare_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `ContractShare_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractShareItem` (
    `shareId` INTEGER NOT NULL,
    `assignedContractId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `ContractShareItem_assignedContractId_idx`(`assignedContractId`),
    INDEX `ContractShareItem_shareId_order_idx`(`shareId`, `order`),
    PRIMARY KEY (`shareId`, `assignedContractId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContractShare` ADD CONSTRAINT `ContractShare_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShare` ADD CONSTRAINT `ContractShare_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShareItem` ADD CONSTRAINT `ContractShareItem_shareId_fkey` FOREIGN KEY (`shareId`) REFERENCES `ContractShare`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShareItem` ADD CONSTRAINT `ContractShareItem_assignedContractId_fkey` FOREIGN KEY (`assignedContractId`) REFERENCES `AssignedContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
