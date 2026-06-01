-- CreateTable
CREATE TABLE `CustomPage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `type` ENUM('IFRAME', 'CUSTOM') NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `draftVersionId` INTEGER NULL,
    `publishedVersionId` INTEGER NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NOT NULL,

    UNIQUE INDEX `CustomPage_draftVersionId_key`(`draftVersionId`),
    UNIQUE INDEX `CustomPage_publishedVersionId_key`(`publishedVersionId`),
    INDEX `CustomPage_companyId_idx`(`companyId`),
    INDEX `CustomPage_companyId_updatedAt_idx`(`companyId`, `updatedAt`),
    INDEX `CustomPage_companyId_publishedAt_idx`(`companyId`, `publishedAt`),
    UNIQUE INDEX `CustomPage_companyId_slug_key`(`companyId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomPageVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` INTEGER NOT NULL,
    `kind` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `content` LONGTEXT NULL,
    `iframeUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NOT NULL,

    INDEX `CustomPageVersion_pageId_idx`(`pageId`),
    INDEX `CustomPageVersion_pageId_kind_idx`(`pageId`, `kind`),
    INDEX `CustomPageVersion_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomPageAccess` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` INTEGER NOT NULL,
    `kind` ENUM('USER', 'RANK') NOT NULL,
    `userId` INTEGER NULL,
    `rankId` INTEGER NULL,

    INDEX `CustomPageAccess_pageId_idx`(`pageId`),
    INDEX `CustomPageAccess_pageId_kind_idx`(`pageId`, `kind`),
    UNIQUE INDEX `CustomPageAccess_pageId_kind_userId_key`(`pageId`, `kind`, `userId`),
    UNIQUE INDEX `CustomPageAccess_pageId_kind_rankId_key`(`pageId`, `kind`, `rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomPage` ADD CONSTRAINT `CustomPage_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPage` ADD CONSTRAINT `CustomPage_draftVersionId_fkey` FOREIGN KEY (`draftVersionId`) REFERENCES `CustomPageVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPage` ADD CONSTRAINT `CustomPage_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `CustomPageVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPage` ADD CONSTRAINT `CustomPage_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPage` ADD CONSTRAINT `CustomPage_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPageVersion` ADD CONSTRAINT `CustomPageVersion_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `CustomPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPageVersion` ADD CONSTRAINT `CustomPageVersion_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPageAccess` ADD CONSTRAINT `CustomPageAccess_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `CustomPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPageAccess` ADD CONSTRAINT `CustomPageAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomPageAccess` ADD CONSTRAINT `CustomPageAccess_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
