/*
  Warnings:

  - A unique constraint covering the columns `[companyId,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Role_name_key` ON `Role`;

-- AlterTable
ALTER TABLE `Role` ADD COLUMN `companyId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` BIGINT NOT NULL,
    `kind` ENUM('DIRECT', 'GROUP', 'COMPANY', 'TICKET') NOT NULL,
    `companyId` INTEGER NULL,
    `ticketCategory` ENUM('OTHER', 'BILLING', 'GENERAL', 'CONTACT', 'TECHNICAL') NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `firstReportedAt` DATETIME(3) NULL,
    `membersCache` JSON NULL,
    `membersCacheVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Conversation_companyId_idx`(`companyId`),
    INDEX `Conversation_kind_companyId_idx`(`kind`, `companyId`),
    INDEX `Conversation_lastActivityAt_idx`(`lastActivityAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationUserMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `invitedById` INTEGER NULL,

    INDEX `ConversationUserMember_userId_idx`(`userId`),
    INDEX `ConversationUserMember_conversationId_idx`(`conversationId`),
    UNIQUE INDEX `ConversationUserMember_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationRoleMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` BIGINT NOT NULL,
    `roleId` INTEGER NOT NULL,

    INDEX `ConversationRoleMember_roleId_idx`(`roleId`),
    INDEX `ConversationRoleMember_conversationId_idx`(`conversationId`),
    UNIQUE INDEX `ConversationRoleMember_conversationId_roleId_key`(`conversationId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` BIGINT NOT NULL,
    `conversationId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `firstReportedAt` DATETIME(3) NULL,

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `Message_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationSnapshot` (
    `id` BIGINT NOT NULL,
    `originalConversationId` BIGINT NOT NULL,
    `kind` ENUM('DIRECT', 'GROUP', 'COMPANY', 'TICKET') NOT NULL,
    `companyId` INTEGER NULL,
    `ticketCategory` ENUM('OTHER', 'BILLING', 'GENERAL', 'CONTACT', 'TECHNICAL') NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `participantUserIds` JSON NULL,
    `participantRoleIds` JSON NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ConversationSnapshot_originalConversationId_key`(`originalConversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageSnapshot` (
    `id` BIGINT NOT NULL,
    `originalMessageId` BIGINT NOT NULL,
    `conversationId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `originalCreatedAt` DATETIME(3) NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MessageSnapshot_originalMessageId_key`(`originalMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `targetType` ENUM('MESSAGE', 'CONVERSATION') NOT NULL,
    `conversationId` BIGINT NULL,
    `messageId` BIGINT NULL,
    `reporterId` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportEvent_targetType_conversationId_idx`(`targetType`, `conversationId`),
    INDEX `ReportEvent_targetType_messageId_idx`(`targetType`, `messageId`),
    INDEX `ReportEvent_reporterId_createdAt_idx`(`reporterId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Role_companyId_name_key` ON `Role`(`companyId`, `name`);

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationUserMember` ADD CONSTRAINT `ConversationUserMember_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationUserMember` ADD CONSTRAINT `ConversationUserMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationUserMember` ADD CONSTRAINT `ConversationUserMember_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationRoleMember` ADD CONSTRAINT `ConversationRoleMember_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationRoleMember` ADD CONSTRAINT `ConversationRoleMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportEvent` ADD CONSTRAINT `ReportEvent_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
