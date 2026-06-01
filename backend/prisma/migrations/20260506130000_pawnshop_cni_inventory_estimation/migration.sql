-- 1. Add CLIENT_CNI to ImageOwnerType enum (MariaDB inline alter)
ALTER TABLE `Image` MODIFY COLUMN `ownerType` ENUM(
  'USER', 'COMPANY', 'CLIENT_VARIABLE', 'MY_CALENDAR_EVENT',
  'COMPANY_LOADING', 'COMPANY_BANNER', 'COMPANY_ICON', 'CLIENT_CNI'
) NOT NULL;

-- 2. Add cniImagePublicId to Client (stores publicId of the CNI image)
ALTER TABLE `Client`
  ADD COLUMN `cniImagePublicId` VARCHAR(191) NULL;

-- 3. Add inventoryId to PawnshopPurchaseItem (link to Inventory record)
ALTER TABLE `PawnshopPurchaseItem`
  ADD COLUMN `inventoryId` INT NULL,
  ADD CONSTRAINT `PawnshopPurchaseItem_inventoryId_fkey`
    FOREIGN KEY (`inventoryId`) REFERENCES `Inventory`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. PawnshopEstimation model
CREATE TABLE `PawnshopEstimation` (
  `id`                    INT             NOT NULL AUTO_INCREMENT,
  `companyId`             INT             NOT NULL,
  `clientId`              INT             NULL,
  `createdByEmployeeId`   INT             NOT NULL,
  `status`                ENUM('OPEN','CONVERTED','REJECTED') NOT NULL DEFAULT 'OPEN',
  `notes`                 TEXT            NULL,
  `convertedPurchaseId`   INT             NULL,
  `createdAt`             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PawnshopEstimation_companyId_idx` (`companyId`),
  INDEX `PawnshopEstimation_clientId_idx` (`clientId`),
  INDEX `PawnshopEstimation_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. PawnshopEstimationItem model
CREATE TABLE `PawnshopEstimationItem` (
  `id`                INT         NOT NULL AUTO_INCREMENT,
  `estimationId`      INT         NOT NULL,
  `productId`         INT         NOT NULL,
  `quantity`          DECIMAL(10,3) NOT NULL,
  `estimatedBuyPrice` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PawnshopEstimationItem_estimationId_idx` (`estimationId`),
  INDEX `PawnshopEstimationItem_productId_idx` (`productId`),
  CONSTRAINT `PawnshopEstimationItem_estimationId_fkey`
    FOREIGN KEY (`estimationId`) REFERENCES `PawnshopEstimation`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PawnshopEstimationItem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`)
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. FK for PawnshopEstimation -> Company, Client, Employee, Purchase
ALTER TABLE `PawnshopEstimation`
  ADD CONSTRAINT `PawnshopEstimation_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PawnshopEstimation_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PawnshopEstimation_createdByEmployeeId_fkey`
    FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `PawnshopEstimation_convertedPurchaseId_fkey`
    FOREIGN KEY (`convertedPurchaseId`) REFERENCES `PawnshopPurchase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
