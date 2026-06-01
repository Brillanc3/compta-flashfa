-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `plate` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,

    UNIQUE INDEX `Vehicle_vehicleId_key`(`vehicleId`),
    INDEX `Vehicle_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `type` ENUM('OUT', 'IN') NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `vehicleRefId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `properName` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `logId` INTEGER NOT NULL,
    `metadata` LONGTEXT NULL,

    UNIQUE INDEX `VehicleMovement_logId_key`(`logId`),
    INDEX `VehicleMovement_companyId_occurredAt_idx`(`companyId`, `occurredAt`),
    INDEX `VehicleMovement_companyId_vehicleId_idx`(`companyId`, `vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleMovement` ADD CONSTRAINT `VehicleMovement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleMovement` ADD CONSTRAINT `VehicleMovement_vehicleRefId_fkey` FOREIGN KEY (`vehicleRefId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleMovement` ADD CONSTRAINT `VehicleMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleMovement` ADD CONSTRAINT `VehicleMovement_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `Log`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
