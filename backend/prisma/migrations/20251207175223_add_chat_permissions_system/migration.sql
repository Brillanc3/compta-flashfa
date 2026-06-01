-- CreateTable
CREATE TABLE `ChatPermissionDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChatPermissionDefinition_action_key`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankChatPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rankId` INTEGER NOT NULL,
    `permissionAction` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `RankChatPermission_rankId_permissionAction_key`(`rankId`, `permissionAction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannelRankOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` BIGINT NOT NULL,
    `rankId` INTEGER NOT NULL,
    `allow` JSON NOT NULL,
    `deny` JSON NOT NULL,

    UNIQUE INDEX `ChatChannelRankOverride_conversationId_rankId_key`(`conversationId`, `rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannelUserOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `allow` JSON NOT NULL,
    `deny` JSON NOT NULL,

    UNIQUE INDEX `ChatChannelUserOverride_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RankChatPermission` ADD CONSTRAINT `RankChatPermission_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
