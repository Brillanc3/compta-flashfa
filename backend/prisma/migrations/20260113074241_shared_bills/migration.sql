-- AlterTable
ALTER TABLE `Bill` ADD COLUMN `authorCompanyEmployeeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `BillShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `billId` INTEGER NOT NULL,
    `companyEmployeeId` INTEGER NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,

    INDEX `BillShare_billId_fkey`(`billId`),
    INDEX `BillShare_companyEmployeeId_fkey`(`companyEmployeeId`),
    UNIQUE INDEX `BillShare_bill_companyEmployee_unique`(`billId`, `companyEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Bill_authorCompanyEmployeeId_fkey` ON `Bill`(`authorCompanyEmployeeId`);

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_authorCompanyEmployeeId_fkey` FOREIGN KEY (`authorCompanyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillShare` ADD CONSTRAINT `BillShare_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillShare` ADD CONSTRAINT `BillShare_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
