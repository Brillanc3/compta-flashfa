-- CreateTable: EmployeeHREvent and EmployeeHRAttachment

CREATE TABLE `EmployeeHREvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyEmployeeId` INTEGER NOT NULL,
    `type` ENUM('AVERTISSEMENT', 'FELICITATION', 'PRIME', 'NOTE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `isoWeek` INTEGER NULL,
    `isoYear` INTEGER NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdByEmployeeId` INTEGER NULL,

    INDEX `EmployeeHREvent_companyEmployeeId_idx`(`companyEmployeeId`),
    INDEX `EmployeeHREvent_companyEmployeeId_isoYear_isoWeek_idx`(`companyEmployeeId`, `isoYear`, `isoWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: EmployeeHRAttachment

CREATE TABLE `EmployeeHRAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `byteSize` INTEGER NOT NULL,
    `diskPath` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmployeeHRAttachment_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: EmployeeHREvent -> CompanyEmployee (employee)
ALTER TABLE `EmployeeHREvent` ADD CONSTRAINT `EmployeeHREvent_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EmployeeHREvent -> CompanyEmployee (createdBy)
ALTER TABLE `EmployeeHREvent` ADD CONSTRAINT `EmployeeHREvent_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: EmployeeHRAttachment -> EmployeeHREvent
ALTER TABLE `EmployeeHRAttachment` ADD CONSTRAINT `EmployeeHRAttachment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `EmployeeHREvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
