/*
  Warnings:

  - The primary key for the `ChatChannelRankOverride` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `allow` on the `ChatChannelRankOverride` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `ChatChannelRankOverride` table. All the data in the column will be lost.
  - You are about to drop the column `deny` on the `ChatChannelRankOverride` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `ChatChannelRankOverride` table. All the data in the column will be lost.
  - The primary key for the `ChatChannelUserOverride` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `allow` on the `ChatChannelUserOverride` table. All the data in the column will be lost.
  - You are about to drop the column `conversationId` on the `ChatChannelUserOverride` table. All the data in the column will be lost.
  - You are about to drop the column `deny` on the `ChatChannelUserOverride` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `ChatChannelUserOverride` table. All the data in the column will be lost.
  - You are about to drop the `ChatPermissionDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationRoleMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationUserMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RankChatPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReportEvent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `channelId` to the `ChatChannelRankOverride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channelId` to the `ChatChannelUserOverride` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ChatChannelRankOverride` DROP FOREIGN KEY `ChatChannelRankOverride_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `ChatChannelRankOverride` DROP FOREIGN KEY `ChatChannelRankOverride_rankId_fkey`;

-- DropForeignKey
ALTER TABLE `ChatChannelUserOverride` DROP FOREIGN KEY `ChatChannelUserOverride_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `ChatChannelUserOverride` DROP FOREIGN KEY `ChatChannelUserOverride_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Conversation` DROP FOREIGN KEY `Conversation_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `Conversation` DROP FOREIGN KEY `Conversation_ticketAdminId_fkey`;

-- DropForeignKey
ALTER TABLE `ConversationRoleMember` DROP FOREIGN KEY `ConversationRoleMember_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `ConversationRoleMember` DROP FOREIGN KEY `ConversationRoleMember_roleId_fkey`;

-- DropForeignKey
ALTER TABLE `ConversationUserMember` DROP FOREIGN KEY `ConversationUserMember_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `ConversationUserMember` DROP FOREIGN KEY `ConversationUserMember_invitedById_fkey`;

-- DropForeignKey
ALTER TABLE `ConversationUserMember` DROP FOREIGN KEY `ConversationUserMember_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `RankChatPermission` DROP FOREIGN KEY `RankChatPermission_rankId_fkey`;

-- DropForeignKey
ALTER TABLE `ReportEvent` DROP FOREIGN KEY `ReportEvent_reporterId_fkey`;

-- DropIndex
DROP INDEX `ChatChannelRankOverride_conversationId_rankId_key` ON `ChatChannelRankOverride`;

-- DropIndex
DROP INDEX `ChatChannelRankOverride_rankId_fkey` ON `ChatChannelRankOverride`;

-- DropIndex
DROP INDEX `ChatChannelUserOverride_conversationId_userId_key` ON `ChatChannelUserOverride`;

-- DropIndex
DROP INDEX `ChatChannelUserOverride_userId_fkey` ON `ChatChannelUserOverride`;

-- AlterTable
ALTER TABLE `ChatChannelRankOverride` DROP PRIMARY KEY,
    DROP COLUMN `allow`,
    DROP COLUMN `conversationId`,
    DROP COLUMN `deny`,
    DROP COLUMN `id`,
    ADD COLUMN `allowBits` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `channelId` BIGINT NOT NULL,
    ADD COLUMN `denyBits` BIGINT NOT NULL DEFAULT 0,
    ADD PRIMARY KEY (`channelId`, `rankId`);

-- AlterTable
ALTER TABLE `ChatChannelUserOverride` DROP PRIMARY KEY,
    DROP COLUMN `allow`,
    DROP COLUMN `conversationId`,
    DROP COLUMN `deny`,
    DROP COLUMN `id`,
    ADD COLUMN `allowBits` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `channelId` BIGINT NOT NULL,
    ADD COLUMN `denyBits` BIGINT NOT NULL DEFAULT 0,
    ADD PRIMARY KEY (`channelId`, `userId`);

-- AlterTable
ALTER TABLE `Rank` ADD COLUMN `chatPermissionsBits` BIGINT NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE `ChatPermissionDefinition`;

-- DropTable
DROP TABLE `Conversation`;

-- DropTable
DROP TABLE `ConversationRoleMember`;

-- DropTable
DROP TABLE `ConversationSnapshot`;

-- DropTable
DROP TABLE `ConversationUserMember`;

-- DropTable
DROP TABLE `Message`;

-- DropTable
DROP TABLE `MessageSnapshot`;

-- DropTable
DROP TABLE `RankChatPermission`;

-- DropTable
DROP TABLE `ReportEvent`;

-- CreateTable
CREATE TABLE `ChatCategory` (
    `id` BIGINT NOT NULL,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannel` (
    `id` BIGINT NOT NULL,
    `companyId` INTEGER NOT NULL,
    `categoryId` BIGINT NULL,
    `name` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `lastMessageId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ChatMessage_channelId_createdAt_idx`(`channelId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannelReadState` (
    `channelId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `lastReadMessageId` BIGINT NULL,
    `lastReadAt` DATETIME(3) NULL,

    INDEX `ChatChannelReadState_userId_idx`(`userId`),
    PRIMARY KEY (`channelId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatDmConversation` (
    `id` BIGINT NOT NULL,
    `userAId` INTEGER NOT NULL,
    `userBId` INTEGER NOT NULL,

    UNIQUE INDEX `ChatDmConversation_userAId_userBId_key`(`userAId`, `userBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatDmMessage` (
    `id` BIGINT NOT NULL,
    `conversationId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ChatChannelRankOverride_channelId_idx` ON `ChatChannelRankOverride`(`channelId`);

-- CreateIndex
CREATE INDEX `ChatChannelUserOverride_channelId_idx` ON `ChatChannelUserOverride`(`channelId`);

-- AddForeignKey
ALTER TABLE `ChatCategory` ADD CONSTRAINT `ChatCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannel` ADD CONSTRAINT `ChatChannel_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannel` ADD CONSTRAINT `ChatChannel_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelReadState` ADD CONSTRAINT `ChatChannelReadState_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelReadState` ADD CONSTRAINT `ChatChannelReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmConversation` ADD CONSTRAINT `ChatDmConversation_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmConversation` ADD CONSTRAINT `ChatDmConversation_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmMessage` ADD CONSTRAINT `ChatDmMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ChatDmConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmMessage` ADD CONSTRAINT `ChatDmMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
