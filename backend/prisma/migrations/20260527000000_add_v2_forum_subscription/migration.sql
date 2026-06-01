-- CreateTable
CREATE TABLE `v2_forum_subscription` (
    `userId` INTEGER NOT NULL,
    `channelId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_forum_subscription_channelId_idx`(`channelId`),
    PRIMARY KEY (`userId`, `channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `v2_forum_subscription` ADD CONSTRAINT `v2_forum_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_subscription` ADD CONSTRAINT `v2_forum_subscription_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
