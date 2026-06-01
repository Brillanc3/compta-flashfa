-- AlterTable
ALTER TABLE `Client` ADD COLUMN `characterId` INTEGER NULL,
    ADD COLUMN `discordId` VARCHAR(191) NULL,
    ADD COLUMN `userId` INTEGER NULL;

-- AlterTable
ALTER TABLE `CompanyEmployee` ADD COLUMN `linkCode` VARCHAR(191) NULL,
    ADD COLUMN `linkCodeCreatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Image` MODIFY `ownerType` enum('USER','COMPANY','CLIENT_VARIABLE','MY_CALENDAR_EVENT') NOT NULL;

-- AlterTable
ALTER TABLE `InventoryMovement` ADD COLUMN `ownerRefId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `isCsvInjection` BOOLEAN NULL DEFAULT false;

-- CreateTable
CREATE TABLE `BillComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `content` TEXT NOT NULL,
    `billId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,

    INDEX `BillComment_authorId_idx`(`authorId` ASC),
    INDEX `BillComment_billId_idx`(`billId` ASC),
    INDEX `BillComment_companyId_idx`(`companyId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOLEAN', 'TEXT') NOT NULL DEFAULT 'BOOLEAN',
    `config` LONGTEXT NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `perksDescription` LONGTEXT NULL,
    `showInPerks` BOOLEAN NOT NULL DEFAULT false,
    `perksPrice` DECIMAL(10, 2) NULL,
    `perksPriceDuration` VARCHAR(191) NULL,
    `perksIconUrl` VARCHAR(191) NULL,
    `showInCatalog` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ClientVariable_companyId_idx`(`companyId` ASC),
    INDEX `ClientVariable_companyId_order_idx`(`companyId` ASC, `order` ASC),
    UNIQUE INDEX `ClientVariable_companyId_slug_key`(`companyId` ASC, `slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariableAccess` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variableId` INTEGER NOT NULL,
    `kind` ENUM('USER', 'RANK') NOT NULL,
    `userId` INTEGER NULL,
    `rankId` INTEGER NULL,

    INDEX `ClientVariableAccess_rankId_fkey`(`rankId` ASC),
    INDEX `ClientVariableAccess_userId_fkey`(`userId` ASC),
    INDEX `ClientVariableAccess_variableId_idx`(`variableId` ASC),
    INDEX `ClientVariableAccess_variableId_kind_idx`(`variableId` ASC, `kind` ASC),
    UNIQUE INDEX `ClientVariableAccess_variableId_kind_rankId_key`(`variableId` ASC, `kind` ASC, `rankId` ASC),
    UNIQUE INDEX `ClientVariableAccess_variableId_kind_userId_key`(`variableId` ASC, `kind` ASC, `userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariableValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variableId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `value` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    INDEX `ClientVariableValue_clientId_idx`(`clientId` ASC),
    INDEX `ClientVariableValue_updatedByUserId_fkey`(`updatedByUserId` ASC),
    UNIQUE INDEX `ClientVariableValue_variableId_clientId_key`(`variableId` ASC, `clientId` ASC),
    INDEX `ClientVariableValue_variableId_idx`(`variableId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomService` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `invoiceReason` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `startWeek` INTEGER NULL,
    `endWeek` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomService_companyId_idx`(`companyId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,

    INDEX `Inventory_companyId_idx`(`companyId` ASC),
    UNIQUE INDEX `Inventory_companyId_owner_key`(`companyId` ASC, `owner` ASC),
    INDEX `Inventory_createdById_fkey`(`createdById` ASC),
    INDEX `Inventory_updatedById_fkey`(`updatedById` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyCalendarCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#FFFFFF',
    `userId` INTEGER NULL,
    `companyId` INTEGER NULL,

    INDEX `MyCalendarCategory_companyId_idx`(`companyId` ASC),
    INDEX `MyCalendarCategory_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyCalendarEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `color` VARCHAR(191) NULL DEFAULT '#3b82f6',
    `repetition` VARCHAR(191) NULL,
    `authorId` INTEGER NOT NULL,
    `companyId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `imageUrl` VARCHAR(191) NULL,
    `isPredefined` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MyCalendarEvent_authorId_idx`(`authorId` ASC),
    INDEX `MyCalendarEvent_categoryId_fkey`(`categoryId` ASC),
    INDEX `MyCalendarEvent_companyId_idx`(`companyId` ASC),
    INDEX `MyCalendarEvent_startTime_endTime_idx`(`startTime` ASC, `endTime` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyCalendarGuest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REFUSED') NOT NULL DEFAULT 'PENDING',

    UNIQUE INDEX `MyCalendarGuest_eventId_userId_key`(`eventId` ASC, `userId` ASC),
    INDEX `MyCalendarGuest_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StreamerKey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `companyId` INTEGER NOT NULL,
    `isEmergency` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `StreamerKey_companyId_idx`(`companyId` ASC),
    UNIQUE INDEX `StreamerKey_key_key`(`key` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Client_characterId_idx` ON `Client`(`characterId` ASC);

-- CreateIndex
CREATE INDEX `Client_userId_idx` ON `Client`(`userId` ASC);

-- CreateIndex
CREATE UNIQUE INDEX `CompanyEmployee_linkCode_key` ON `CompanyEmployee`(`linkCode` ASC);

-- CreateIndex
CREATE INDEX `InventoryMovement_ownerRefId_idx` ON `InventoryMovement`(`ownerRefId` ASC);

-- CreateIndex
CREATE INDEX `Transaction_companyId_date_idx` ON `Transaction`(`companyId` ASC, `date` DESC);

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariable` ADD CONSTRAINT `ClientVariable_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_variableId_fkey` FOREIGN KEY (`variableId`) REFERENCES `ClientVariable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_variableId_fkey` FOREIGN KEY (`variableId`) REFERENCES `ClientVariable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomService` ADD CONSTRAINT `CustomService_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_ownerRefId_fkey` FOREIGN KEY (`ownerRefId`) REFERENCES `Inventory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarCategory` ADD CONSTRAINT `MyCalendarCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarCategory` ADD CONSTRAINT `MyCalendarCategory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MyCalendarCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarGuest` ADD CONSTRAINT `MyCalendarGuest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `MyCalendarEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarGuest` ADD CONSTRAINT `MyCalendarGuest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamerKey` ADD CONSTRAINT `StreamerKey_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

