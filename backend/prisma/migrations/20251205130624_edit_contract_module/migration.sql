-- AlterTable
ALTER TABLE `AssignedContract` ADD COLUMN `refusalReason` TEXT NULL,
    ADD COLUMN `refusedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `ContractTemplate` ADD COLUMN `backgroundImageUrl` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ContractTemplateArticle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `templateId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `params` JSON NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `ContractTemplateArticle_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContractTemplateArticle` ADD CONSTRAINT `ContractTemplateArticle_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
