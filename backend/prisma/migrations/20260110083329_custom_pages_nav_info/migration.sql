-- AlterTable
ALTER TABLE `CustomPage` ADD COLUMN `navGroup` VARCHAR(191) NULL,
    ADD COLUMN `navIcon` VARCHAR(191) NULL,
    ADD COLUMN `navOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `navTitle` VARCHAR(191) NULL,
    ADD COLUMN `showInSidebar` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `CustomPage_companyId_showInSidebar_navOrder_idx` ON `CustomPage`(`companyId`, `showInSidebar`, `navOrder`);
