-- CreateTable: ChatCategoryRankOverride
CREATE TABLE `ChatCategoryRankOverride` (
    `categoryId` BIGINT NOT NULL,
    `rankId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatCategoryRankOverride_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`categoryId`, `rankId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ChatCategoryUserOverride
CREATE TABLE `ChatCategoryUserOverride` (
    `categoryId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatCategoryUserOverride_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`categoryId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatCategoryRankOverride`
    ADD CONSTRAINT `ChatCategoryRankOverride_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryRankOverride`
    ADD CONSTRAINT `ChatCategoryRankOverride_rankId_fkey`
    FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryUserOverride`
    ADD CONSTRAINT `ChatCategoryUserOverride_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryUserOverride`
    ADD CONSTRAINT `ChatCategoryUserOverride_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add type + syncedWithCategory on ChatChannel
-- Existing channels keep all current overrides AND become synced=TRUE so legacy behavior preserved.
ALTER TABLE `ChatChannel`
    ADD COLUMN `type` ENUM('TEXT') NOT NULL DEFAULT 'TEXT',
    ADD COLUMN `syncedWithCategory` BOOLEAN NOT NULL DEFAULT TRUE;

-- Channels with existing channel-level overrides should NOT be synced (they have their own perms already)
UPDATE `ChatChannel` ch
SET ch.`syncedWithCategory` = FALSE
WHERE ch.`id` IN (
    SELECT DISTINCT `channelId` FROM `ChatChannelRankOverride`
    UNION
    SELECT DISTINCT `channelId` FROM `ChatChannelUserOverride`
);
