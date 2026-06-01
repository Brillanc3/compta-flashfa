-- CreateTable
CREATE TABLE `RankHistoryArchive` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `companyId` INTEGER NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `rankId` INTEGER NULL,
    `rankName` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL,
    `leaveAt` DATETIME(3) NULL,

    INDEX `RankHistoryArchive_userId_assignedAt_idx`(`userId`, `assignedAt`),
    INDEX `RankHistoryArchive_companyName_idx`(`companyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RankHistoryArchive` ADD CONSTRAINT `RankHistoryArchive_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
