-- CreateTable
CREATE TABLE `v2_user_channel_notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channelId` BIGINT NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `mutedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_user_channel_notification_channelId_idx`(`channelId`),
    UNIQUE INDEX `v2_user_channel_notification_userId_channelId_key`(`userId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `v2_user_channel_notification` ADD CONSTRAINT `v2_user_channel_notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_user_channel_notification` ADD CONSTRAINT `v2_user_channel_notification_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
