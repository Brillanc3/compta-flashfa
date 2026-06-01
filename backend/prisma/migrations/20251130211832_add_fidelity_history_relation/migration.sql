/*
  Warnings:

  - Added the required column `templateId` to the `FidelityCard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FidelityCard` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `FidelityCard` DROP FOREIGN KEY `FidelityCard_clientId_fkey`;

-- DropIndex
DROP INDEX `FidelityCard_clientId_key` ON `FidelityCard`;

-- AlterTable
ALTER TABLE `FidelityCard` ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `templateId` INTEGER NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `FidelityCardHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `performedByUserId` INTEGER NOT NULL,
    `actionType` ENUM('CARD_CREATED', 'STAMP_ADDED', 'STAMP_REMOVED', 'STATUS_CHANGED', 'MANUAL_ADJUSTMENT') NOT NULL,
    `beforeStampCount` INTEGER NULL,
    `afterStampCount` INTEGER NULL,
    `beforeStatus` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NULL,
    `afterStatus` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FidelityCardHistory` ADD CONSTRAINT `FidelityCardHistory_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `FidelityCard`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCardHistory` ADD CONSTRAINT `FidelityCardHistory_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCard` ADD CONSTRAINT `FidelityCard_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `FidelityCardTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;