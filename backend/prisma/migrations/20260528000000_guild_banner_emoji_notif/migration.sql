-- AlterTable
ALTER TABLE `v2_guild` ADD COLUMN `bannerHash` VARCHAR(128) NULL;

-- CreateTable
CREATE TABLE `v2_guild_emoji` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `imageKey` VARCHAR(128) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_guild_emoji_guildId_idx`(`guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_guild_notif_setting` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `guildId` BIGINT NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `mutedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_guild_notif_setting_guildId_idx`(`guildId`),
    UNIQUE INDEX `v2_guild_notif_setting_userId_guildId_key`(`userId`, `guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `v2_guild_emoji` ADD CONSTRAINT `v2_guild_emoji_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild_notif_setting` ADD CONSTRAINT `v2_guild_notif_setting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild_notif_setting` ADD CONSTRAINT `v2_guild_notif_setting_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
