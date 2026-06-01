-- CreateTable
CREATE TABLE `v2_forum_post_subscription` (
    `userId` INTEGER NOT NULL,
    `threadId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `v2_forum_post_subscription_threadId_idx`(`threadId`),
    INDEX `v2_forum_post_subscription_userId_idx`(`userId`),
    PRIMARY KEY (`userId`, `threadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `v2_forum_post_subscription` ADD CONSTRAINT `v2_forum_post_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_post_subscription` ADD CONSTRAINT `v2_forum_post_subscription_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
