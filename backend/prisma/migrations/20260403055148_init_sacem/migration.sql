-- CreateTable
CREATE TABLE `SacemPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SacemPost_messageId_key`(`messageId`),
    INDEX `SacemPost_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SacemPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `reactionsCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SacemPayment_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SacemParticipation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,

    UNIQUE INDEX `SacemParticipation_postId_employeeId_key`(`postId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SacemPost` ADD CONSTRAINT `SacemPost_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemPayment` ADD CONSTRAINT `SacemPayment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `SacemPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemParticipation` ADD CONSTRAINT `SacemParticipation_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `SacemPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemParticipation` ADD CONSTRAINT `SacemParticipation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
