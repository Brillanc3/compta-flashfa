-- AlterTable
ALTER TABLE `AssignedContract`
    ADD COLUMN `senderUserId` INTEGER NULL;

-- Best-effort backfill for existing contracts from the notification sender.
UPDATE `AssignedContract` ac
    LEFT JOIN (
    SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.assignedContractId')) AS UNSIGNED) AS `assignedContractId`,
    MAX(`senderId`) AS `senderUserId`
    FROM `Notification`
    WHERE `senderId` IS NOT NULL
    AND JSON_VALID(`content`)
    AND JSON_EXTRACT(`content`, '$.assignedContractId') IS NOT NULL
    GROUP BY CAST(JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.assignedContractId')) AS UNSIGNED)
    ) notif ON notif.`assignedContractId` = ac.`id`
    SET ac.`senderUserId` = notif.`senderUserId`
WHERE ac.`senderUserId` IS NULL;

-- CreateTable
CREATE TABLE `UserElectronicSignatureVersion` (
                                                  `id` INTEGER NOT NULL AUTO_INCREMENT,
                                                  `userId` INTEGER NOT NULL,
                                                  `svg` LONGTEXT NOT NULL,
                                                  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

                                                  INDEX `UserElectronicSignatureVersion_userId_createdAt_idx`(`userId`, `createdAt`),
                                                  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Replace legacy single-signature table with a role-based signature table.
RENAME TABLE `ContractSignature` TO `ContractSignature_legacy`;

-- CreateTable
CREATE TABLE `ContractSignature` (
                                     `id` INTEGER NOT NULL AUTO_INCREMENT,
                                     `role` ENUM('SENDER', 'RECIPIENT') NOT NULL,
                                     `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                                     `confirmationText` VARCHAR(191) NOT NULL,
                                     `assignedContractId` INTEGER NOT NULL,
                                     `signerUserId` INTEGER NOT NULL,
                                     `signatureVersionId` INTEGER NULL,
                                     `signatureSvgSnapshot` LONGTEXT NULL,
                                     `signerNameSnapshot` VARCHAR(191) NULL,
                                     `signerIpAddress` VARCHAR(45) NULL,
                                     `signerUserAgent` TEXT NULL,

                                     UNIQUE INDEX `ContractSignature_assignedContractId_role_key`(`assignedContractId`, `role`),
                                     INDEX `ContractSignature_signerUserId_signedAt_idx`(`signerUserId`, `signedAt`),
                                     INDEX `ContractSignature_signatureVersionId_idx`(`signatureVersionId`),
                                     PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing recipient signatures into the new structure.
INSERT INTO `ContractSignature` (
    `id`,
    `role`,
    `signedAt`,
    `confirmationText`,
    `assignedContractId`,
    `signerUserId`,
    `signerNameSnapshot`
)
SELECT
    legacy.`id`,
    'RECIPIENT',
    legacy.`signedAt`,
    legacy.`confirmationText`,
    legacy.`assignedContractId`,
    ac.`assignedToUserId`,
    u.`name`
FROM `ContractSignature_legacy` legacy
         INNER JOIN `AssignedContract` ac ON ac.`id` = legacy.`assignedContractId`
         LEFT JOIN `User` u ON u.`id` = ac.`assignedToUserId`;

DROP TABLE `ContractSignature_legacy`;

-- Indexes
CREATE INDEX `AssignedContract_senderUserId_status_idx` ON `AssignedContract`(`senderUserId`, `status`);

-- Foreign keys
ALTER TABLE `AssignedContract`
    ADD CONSTRAINT `AssignedContract_senderUserId_fkey`
        FOREIGN KEY (`senderUserId`) REFERENCES `User`(`id`)
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UserElectronicSignatureVersion`
    ADD CONSTRAINT `UserElectronicSignatureVersion_userId_fkey`
        FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
            ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContractSignature`
    ADD CONSTRAINT `ContractSignature_assignedContractId_fkey`
        FOREIGN KEY (`assignedContractId`) REFERENCES `AssignedContract`(`id`)
            ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContractSignature`
    ADD CONSTRAINT `ContractSignature_signerUserId_fkey`
        FOREIGN KEY (`signerUserId`) REFERENCES `User`(`id`)
            ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContractSignature`
    ADD CONSTRAINT `ContractSignature_signatureVersionId_fkey`
        FOREIGN KEY (`signatureVersionId`) REFERENCES `UserElectronicSignatureVersion`(`id`)
            ON DELETE SET NULL ON UPDATE CASCADE;
