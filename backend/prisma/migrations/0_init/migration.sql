-- CreateTable
CREATE TABLE `Setting` (
    `id` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_FINALIZATION', 'ACTIVE', 'DISABLED', 'ADMIN_DISABLED', 'BLOCKED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `tempPasswordToken` VARCHAR(191) NULL,
    `tempPasswordExpiresAt` DATETIME(3) NULL,
    `characterId` INTEGER NULL,
    `discordId` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `notificationPreferences` LONGTEXT NULL,
    `preferences` JSON NULL,
    `imageUrl` VARCHAR(191) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_tempPasswordToken_key`(`tempPasswordToken`),
    UNIQUE INDEX `User_discordId_characterId_key`(`discordId`, `characterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `RefreshSession_userId_idx`(`userId`),
    INDEX `RefreshSession_deviceId_idx`(`deviceId`),
    UNIQUE INDEX `RefreshSession_deviceId_refreshTokenHash_key`(`deviceId`, `refreshTokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `onboardingKey` VARCHAR(191) NULL,
    `apiKey` VARCHAR(191) NULL,
    `isApiActive` BOOLEAN NOT NULL DEFAULT false,
    `apiDeactivationReason` VARCHAR(191) NULL,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `accountingPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `pendingChanges` LONGTEXT NULL,
    `pendingChangesDeadline` DATETIME(3) NULL,
    `accountingSuspendedAt` DATETIME(3) NULL,
    `isParentCompany` BOOLEAN NOT NULL DEFAULT false,
    `groupId` INTEGER NULL,
    `useTchatV2` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Company_name_key`(`name`),
    UNIQUE INDEX `Company_onboardingKey_key`(`onboardingKey`),
    UNIQUE INDEX `Company_apiKey_key`(`apiKey`),
    UNIQUE INDEX `Company_groupId_key`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanySettings` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `settings` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanySettings_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyApiKey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `scopes` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CompanyApiKey_key_key`(`key`),
    INDEX `CompanyApiKey_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPresence` (
    `userId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `status` ENUM('ONLINE', 'IDLE', 'DND', 'INVISIBLE', 'OFFLINE') NOT NULL DEFAULT 'OFFLINE',
    `customEmoji` VARCHAR(64) NULL,
    `customText` VARCHAR(128) NULL,
    `lastHeartbeatAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserPresence_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`userId`, `companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMention` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `messageId` BIGINT NOT NULL,
    `type` ENUM('USER', 'RANK', 'EVERYONE') NOT NULL,
    `targetId` INTEGER NULL,

    INDEX `ChatMention_messageId_idx`(`messageId`),
    INDEX `ChatMention_targetId_type_idx`(`targetId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatReaction` (
    `messageId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `emoji` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatReaction_messageId_idx`(`messageId`),
    PRIMARY KEY (`messageId`, `userId`, `emoji`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatPinnedMessage` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `channelId` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `pinnedByUserId` INTEGER NOT NULL,
    `pinnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatPinnedMessage_channelId_idx`(`channelId`),
    UNIQUE INDEX `ChatPinnedMessage_channelId_messageId_key`(`channelId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatCategory` (
    `id` BIGINT NOT NULL,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatCategoryRankOverride` (
    `categoryId` BIGINT NOT NULL,
    `rankId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatCategoryRankOverride_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`categoryId`, `rankId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatCategoryUserOverride` (
    `categoryId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatCategoryUserOverride_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`categoryId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannel` (
    `id` BIGINT NOT NULL,
    `companyId` INTEGER NOT NULL,
    `categoryId` BIGINT NULL,
    `name` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `type` ENUM('TEXT') NOT NULL DEFAULT 'TEXT',
    `syncedWithCategory` BOOLEAN NOT NULL DEFAULT true,
    `lastMessageId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `replyToId` BIGINT NULL,

    INDEX `ChatMessage_channelId_createdAt_idx`(`channelId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessageEdit` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `editorId` INTEGER NOT NULL,
    `editedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessageEdit_messageId_editedAt_idx`(`messageId`, `editedAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatAttachment` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `byteSize` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `diskPath` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatAttachment_channelId_createdAt_idx`(`channelId`, `createdAt`),
    INDEX `ChatAttachment_messageId_idx`(`messageId`),
    UNIQUE INDEX `ChatAttachment_channelId_publicId_key`(`channelId`, `publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillableContact` (
    `userId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isPrio` BOOLEAN NOT NULL DEFAULT false,

    INDEX `BillableContact_companyId_isPrio_idx`(`companyId`, `isPrio`),
    INDEX `BillableContact_companyId_fkey`(`companyId`),
    UNIQUE INDEX `BillableContact_userId_unique`(`userId`),
    PRIMARY KEY (`userId`, `companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `companyId` INTEGER NULL,

    UNIQUE INDEX `Role_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Permission_action_key`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyEmployee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDING_LINK', 'ACTIVE', 'FIRE', 'RESIGNED') NOT NULL DEFAULT 'PENDING_LINK',
    `failedLinkAttempts` INTEGER NOT NULL DEFAULT 0,
    `companyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `rankId` INTEGER NOT NULL,
    `statusUpdatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `linkCode` VARCHAR(191) NULL,
    `linkCodeCreatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CompanyEmployee_linkCode_key`(`linkCode`),
    INDEX `CompanyEmployee_rankId_fkey`(`rankId`),
    INDEX `CompanyEmployee_userId_fkey`(`userId`),
    UNIQUE INDEX `CompanyEmployee_companyId_userId_key`(`companyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeSalaryOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyEmployeeId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `week` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeSalaryOverride_companyEmployeeId_year_week_key`(`companyEmployeeId`, `year`, `week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPartner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `inventoryOwner` VARCHAR(191) NULL,
    `buyPrice` DECIMAL(10, 2) NOT NULL,
    `resalePrice` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPartnerBuyPrice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `buyPrice` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopPartnerBuyPrice_companyId_idx`(`companyId`),
    INDEX `PawnshopPartnerBuyPrice_partnerId_idx`(`partnerId`),
    INDEX `PawnshopPartnerBuyPrice_productId_idx`(`productId`),
    UNIQUE INDEX `PawnshopPartnerBuyPrice_partnerId_productId_key`(`partnerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPurchase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `createdByEmployeeId` INTEGER NOT NULL,
    `partnerId` INTEGER NULL,
    `status` ENUM('DRAFT', 'VALIDATED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `paymentStatus` ENUM('UNPAID', 'PAID_TRANSFER') NOT NULL DEFAULT 'UNPAID',
    `totalBuyAmount` DECIMAL(10, 2) NULL,
    `totalResaleAmount` DECIMAL(10, 2) NULL,
    `validatedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `paidAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopPurchase_companyId_idx`(`companyId`),
    INDEX `PawnshopPurchase_clientId_idx`(`clientId`),
    INDEX `PawnshopPurchase_createdByEmployeeId_idx`(`createdByEmployeeId`),
    INDEX `PawnshopPurchase_partnerId_idx`(`partnerId`),
    INDEX `PawnshopPurchase_status_idx`(`status`),
    INDEX `PawnshopPurchase_validatedAt_idx`(`validatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPurchaseItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unitBuyPrice` DECIMAL(10, 2) NOT NULL,
    `lineTotal` DECIMAL(10, 2) NOT NULL,
    `unitResalePrice` DECIMAL(10, 2) NOT NULL,
    `resaleLineTotal` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `inventoryId` INTEGER NULL,

    INDEX `PawnshopPurchaseItem_purchaseId_idx`(`purchaseId`),
    INDEX `PawnshopPurchaseItem_productId_idx`(`productId`),
    INDEX `PawnshopPurchaseItem_inventoryId_idx`(`inventoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopEstimation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `clientId` INTEGER NULL,
    `createdByEmployeeId` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CONVERTED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `justificatif` TEXT NULL,
    `isPublicSubmission` BOOLEAN NOT NULL DEFAULT false,
    `convertedPurchaseId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopEstimation_companyId_idx`(`companyId`),
    INDEX `PawnshopEstimation_clientId_idx`(`clientId`),
    INDEX `PawnshopEstimation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopEstimationItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estimationId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `estimatedBuyPrice` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PawnshopEstimationItem_estimationId_idx`(`estimationId`),
    INDEX `PawnshopEstimationItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PawnshopPublicPageConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `publicSlug` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `shopName` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `welcomeText` TEXT NULL,
    `theme` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PawnshopPublicPageConfig_companyId_key`(`companyId`),
    UNIQUE INDEX `PawnshopPublicPageConfig_publicSlug_key`(`publicSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartonSale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `occurredAt` DATETIME(3) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `transactionId` INTEGER NOT NULL,
    `companyEmployeeId` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cartonCount` INTEGER NOT NULL DEFAULT 0,
    `reason` VARCHAR(191) NULL,
    `redistributionNumber` VARCHAR(191) NULL,

    UNIQUE INDEX `CartonSale_transactionId_key`(`transactionId`),
    INDEX `CartonSale_companyId_occurredAt_idx`(`companyId`, `occurredAt`),
    INDEX `CartonSale_companyEmployeeId_occurredAt_idx`(`companyEmployeeId`, `occurredAt`),
    INDEX `CartonSale_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `groupRankId` INTEGER NULL,
    `remunerationConfig` JSON NULL,
    `salaryCap` DECIMAL(10, 2) NULL,
    `chatPermissionsBits` BIGINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `Rank_groupRankId_key`(`groupRankId`),
    UNIQUE INDEX `Rank_companyId_name_key`(`companyId`, `name`),
    UNIQUE INDEX `Rank_companyId_position_key`(`companyId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyEmployeeId` INTEGER NOT NULL,
    `rankId` INTEGER NULL,
    `leaveAt` DATETIME(3) NULL,
    `rankName` VARCHAR(191) NOT NULL,

    INDEX `RankHistory_companyEmployeeId_fkey`(`companyEmployeeId`),
    INDEX `RankHistory_rankId_fkey`(`rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `ContractTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `type` ENUM('ADMIN', 'COMPANY', 'LAWYER') NOT NULL DEFAULT 'ADMIN',
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `backgroundImageUrl` VARCHAR(191) NULL,
    `ownerUserId` INTEGER NULL,
    `companyId` INTEGER NULL,
    `companyNameSnapshot` VARCHAR(191) NULL,

    INDEX `ContractTemplate_ownerUserId_fkey`(`ownerUserId`),
    INDEX `ContractTemplate_companyId_idx`(`companyId`),
    INDEX `ContractTemplate_companyId_type_idx`(`companyId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `ContractTemplateField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `fieldType` ENUM('TEXT', 'NUMBER', 'DATE', 'MODULE_SELECTION', 'PRICE') NOT NULL DEFAULT 'TEXT',
    `label` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `options` LONGTEXT NULL,
    `templateId` INTEGER NOT NULL,

    INDEX `ContractTemplateField_templateId_order_idx`(`templateId`, `order`),
    UNIQUE INDEX `ContractTemplateField_templateId_key_key`(`templateId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignedContract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `signedAt` DATETIME(3) NULL,
    `refusedAt` DATETIME(3) NULL,
    `refusalReason` TEXT NULL,
    `publicUuid` VARCHAR(191) NULL,
    `publicEnabledAt` DATETIME(3) NULL,
    `publicRevokedAt` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'SIGNED', 'REJECTED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `fieldValues` TEXT NULL,
    `templateId` INTEGER NOT NULL,
    `assignedToUserId` INTEGER NOT NULL,
    `senderUserId` INTEGER NULL,
    `generatedCompanyId` INTEGER NULL,
    `modifiesCompanyId` INTEGER NULL,
    `generatedCompanyNameSnapshot` VARCHAR(191) NULL,
    `modifiesCompanyNameSnapshot` VARCHAR(191) NULL,
    `snapshotTitle` VARCHAR(191) NULL,
    `snapshotMarkdown` TEXT NULL,

    UNIQUE INDEX `AssignedContract_publicUuid_key`(`publicUuid`),
    INDEX `AssignedContract_assignedToUserId_status_idx`(`assignedToUserId`, `status`),
    INDEX `AssignedContract_senderUserId_status_idx`(`senderUserId`, `status`),
    INDEX `AssignedContract_generatedCompanyId_fkey`(`generatedCompanyId`),
    INDEX `AssignedContract_templateId_fkey`(`templateId`),
    INDEX `AssignedContract_modifiesCompanyId_idx`(`modifiesCompanyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `createdByUserId` INTEGER NOT NULL,
    `companyId` INTEGER NULL,

    UNIQUE INDEX `ContractShare_publicId_key`(`publicId`),
    INDEX `ContractShare_createdByUserId_createdAt_idx`(`createdByUserId`, `createdAt`),
    INDEX `ContractShare_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `ContractShare_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractShareItem` (
    `shareId` INTEGER NOT NULL,
    `assignedContractId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `ContractShareItem_assignedContractId_idx`(`assignedContractId`),
    INDEX `ContractShareItem_shareId_order_idx`(`shareId`, `order`),
    PRIMARY KEY (`shareId`, `assignedContractId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserElectronicSignatureVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `svg` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserElectronicSignatureVersion_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
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

    INDEX `CustomService_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `ContractSignature_signerUserId_signedAt_idx`(`signerUserId`, `signedAt`),
    INDEX `ContractSignature_signatureVersionId_idx`(`signatureVersionId`),
    UNIQUE INDEX `ContractSignature_assignedContractId_role_key`(`assignedContractId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` LONGTEXT NOT NULL,
    `type` ENUM('SYSTEM', 'USER_SPECIFIC', 'GROUP', 'COMPANY_WIDE') NOT NULL,
    `behavior` ENUM('PERMANENT', 'TEMPORARY', 'BLOCKING') NOT NULL DEFAULT 'PERMANENT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `senderId` INTEGER NULL,

    INDEX `Notification_senderId_fkey`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationRecipient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isAcknowledged` BOOLEAN NOT NULL DEFAULT false,
    `notificationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `NotificationRecipient_userId_fkey`(`userId`),
    UNIQUE INDEX `NotificationRecipient_notificationId_userId_key`(`notificationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Image` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mimetype` VARCHAR(191) NOT NULL,
    `byteSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ownerType` ENUM('USER', 'COMPANY', 'CLIENT_VARIABLE', 'MY_CALENDAR_EVENT', 'COMPANY_LOADING', 'COMPANY_BANNER', 'COMPANY_ICON', 'CLIENT_CNI', 'ADMIN') NOT NULL,
    `ownerId` INTEGER NOT NULL,

    UNIQUE INDEX `Image_publicId_key`(`publicId`),
    INDEX `Image_ownerId_ownerType_idx`(`ownerId`, `ownerType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnboardingCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `companyId` INTEGER NOT NULL,

    UNIQUE INDEX `OnboardingCode_code_key`(`code`),
    INDEX `OnboardingCode_companyId_fkey`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bill` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('UNPAID', 'PAID_CASH', 'PAID_CARD', 'CANCELED') NOT NULL DEFAULT 'UNPAID',
    `reason` VARCHAR(191) NOT NULL,
    `externalBillId` INTEGER NOT NULL,
    `issuerName` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `authorId` INTEGER NOT NULL,
    `authorCompanyEmployeeId` INTEGER NULL,
    `companyId` INTEGER NOT NULL,
    `clientId` INTEGER NULL,
    `canceledById` INTEGER NULL,
    `isParentBill` BOOLEAN NOT NULL DEFAULT false,
    `recipientDiscordId` VARCHAR(191) NULL,
    `recipientCharacterId` INTEGER NULL,
    `accountingTargetCompanyId` INTEGER NULL,
    `accountingNotifyUserId` INTEGER NULL,
    `accountingDueAt` DATETIME(3) NULL,
    `accountingIssuedNotifiedAt` DATETIME(3) NULL,
    `accountingReminderCount` INTEGER NOT NULL DEFAULT 0,
    `accountingLastReminderAt` DATETIME(3) NULL,

    UNIQUE INDEX `Bill_externalBillId_key`(`externalBillId`),
    INDEX `Bill_authorId_fkey`(`authorId`),
    INDEX `Bill_authorCompanyEmployeeId_fkey`(`authorCompanyEmployeeId`),
    INDEX `Bill_clientId_fkey`(`clientId`),
    INDEX `Bill_companyId_fkey`(`companyId`),
    INDEX `Bill_canceledById_fkey`(`canceledById`),
    INDEX `Bill_accountingTargetCompanyId_fkey`(`accountingTargetCompanyId`),
    INDEX `Bill_accountingNotifyUserId_fkey`(`accountingNotifyUserId`),
    INDEX `Bill_isParentBill_status_dueAt_idx`(`isParentBill`, `status`, `accountingDueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `BillComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `content` TEXT NOT NULL,
    `billId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,

    INDEX `BillComment_billId_idx`(`billId`),
    INDEX `BillComment_authorId_idx`(`authorId`),
    INDEX `BillComment_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `balanceBefore` DECIMAL(15, 2) NULL,
    `balanceAfter` DECIMAL(15, 2) NULL,
    `description` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `billId` INTEGER NULL,
    `isCsvInjection` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `Transaction_billId_key`(`billId`),
    INDEX `Transaction_categoryId_fkey`(`categoryId`),
    INDEX `Transaction_companyId_fkey`(`companyId`),
    INDEX `Transaction_companyId_date_idx`(`companyId`, `date` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('CHIFFRE_AFFAIRES', 'AUTRES_ENTREES', 'DONS_RECUS', 'DECORATION', 'SUBVENTIONS_RECUES', 'SALAIRES', 'MATIERES_PREMIERES', 'AVOCATS', 'FRAIS_COMPTABLE', 'LOCATIONS', 'FRAIS_VEHICULES', 'NOURRITURE', 'DONS_EFFECTUES', 'LOCATIONS_NON_DEDUC', 'CHARGES_VEHICULES_NON_DEDUC', 'AUTRES_NON_DEDUC', 'IMPOTS') NOT NULL,
    `type` ENUM('REVENUE', 'EXPENSE') NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isDeductible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TransactionCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `message` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `logType` VARCHAR(191) NOT NULL,
    `text` VARCHAR(191) NULL,
    `date` VARCHAR(191) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `isProcessed` BOOLEAN NOT NULL DEFAULT false,
    `processingError` TEXT NULL,
    `companyId` INTEGER NOT NULL,

    INDEX `Log_companyId_fkey`(`companyId`),
    INDEX `Log_category_logType_idx`(`category`, `logType`),
    INDEX `Log_companyId_category_logType_date_idx`(`companyId`, `category`, `logType`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Module` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Module_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermissionTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `moduleId` INTEGER NOT NULL,

    UNIQUE INDEX `PermissionTemplate_action_key`(`action`),
    INDEX `PermissionTemplate_moduleId_fkey`(`moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyModule` (
    `companyId` INTEGER NOT NULL,
    `moduleId` INTEGER NOT NULL,

    INDEX `CompanyModule_moduleId_fkey`(`moduleId`),
    PRIMARY KEY (`companyId`, `moduleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FidelityCardTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `baseImageId` VARCHAR(191) NOT NULL,
    `stampImageId` VARCHAR(191) NOT NULL,
    `companyId` INTEGER NOT NULL,

    UNIQUE INDEX `FidelityCardTemplate_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FidelityStampZone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `templateId` INTEGER NOT NULL,

    UNIQUE INDEX `FidelityStampZone_templateId_order_key`(`templateId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `phoneNumber` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `companyId` INTEGER NOT NULL,
    `nameSearchable` VARCHAR(191) NULL,
    `cni` VARCHAR(191) NULL,
    `cniImagePublicId` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `characterId` INTEGER NULL,
    `discordId` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `kind` ENUM('PERSON', 'COMPANY') NOT NULL DEFAULT 'PERSON',
    `linkedCompanyGroupId` INTEGER NULL,
    `linkedCompanyNameSnapshot` VARCHAR(191) NULL,

    INDEX `Client_companyId_fkey`(`companyId`),
    INDEX `Client_characterId_idx`(`characterId`),
    INDEX `Client_userId_idx`(`userId`),
    INDEX `Client_linkedCompanyGroupId_idx`(`linkedCompanyGroupId`),
    UNIQUE INDEX `Client_name_companyId_key`(`name`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FidelityCardHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `performedByUserId` INTEGER NOT NULL,
    `actionType` ENUM('CARD_CREATED', 'STAMP_ADDED', 'STAMP_REMOVED', 'STATUS_CHANGED', 'MANUAL_ADJUSTMENT') NOT NULL,
    `beforeStampCount` INTEGER NULL,
    `afterStampCount` INTEGER NULL,
    `beforeStatus` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NULL,
    `afterStatus` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FidelityCardHistory_cardId_fkey`(`cardId`),
    INDEX `FidelityCardHistory_performedByUserId_fkey`(`performedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FidelityCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicLink` VARCHAR(191) NOT NULL,
    `stampCount` INTEGER NOT NULL DEFAULT 0,
    `clientId` INTEGER NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deactivatedAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `templateId` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FidelityCard_publicLink_key`(`publicLink`),
    INDEX `FidelityCard_templateId_fkey`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `category` ENUM('BILLS', 'SUPPORT', 'OTHERS') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'ASSIGNED', 'WAITING_AGENT', 'WAITING_USER', 'CLOSURE_REQUESTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdById` INTEGER NOT NULL,
    `assigneeId` INTEGER NULL,
    `assigneeJoinedAt` DATETIME(3) NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `closureRequestedAt` DATETIME(3) NULL,
    `closureRequestedById` INTEGER NULL,
    `closureDeadlineAt` DATETIME(3) NULL,

    INDEX `Ticket_createdById_updatedAt_idx`(`createdById`, `updatedAt`),
    INDEX `Ticket_assigneeId_updatedAt_idx`(`assigneeId`, `updatedAt`),
    INDEX `Ticket_category_status_updatedAt_idx`(`category`, `status`, `updatedAt`),
    INDEX `Ticket_status_updatedAt_idx`(`status`, `updatedAt`),
    INDEX `Ticket_closureDeadlineAt_idx`(`closureDeadlineAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketParticipant` (
    `ticketId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketParticipant_userId_idx`(`userId`),
    PRIMARY KEY (`ticketId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `kind` ENUM('USER', 'ADMIN', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `content` MEDIUMTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    INDEX `TicketMessage_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `companyId` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deactivatedAt` DATETIME(3) NULL,

    INDEX `Product_companyId_fkey`(`companyId`),
    UNIQUE INDEX `Product_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductDeclaration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `productId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `declaredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fixedPart` DECIMAL(10, 2) NULL,
    `percentPart` DECIMAL(5, 2) NULL,
    `percentValue` DECIMAL(10, 2) NULL,
    `priceAtSale` DECIMAL(10, 2) NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,

    INDEX `ProductDeclaration_companyId_fkey`(`companyId`),
    INDEX `ProductDeclaration_productId_fkey`(`productId`),
    INDEX `ProductDeclaration_employeeId_fkey`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WidgetDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `requiredPermission` LONGTEXT NULL,
    `availableVariants` LONGTEXT NULL,
    `targetContext` ENUM('COMPANY', 'ADMIN_USER', 'GLOBAL') NOT NULL DEFAULT 'COMPANY',

    UNIQUE INDEX `WidgetDefinition_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserWidget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `layout` LONGTEXT NOT NULL,
    `config` LONGTEXT NULL,
    `userId` INTEGER NOT NULL,
    `companyId` INTEGER NULL,
    `widgetDefinitionId` INTEGER NOT NULL,

    INDEX `UserWidget_companyId_fkey`(`companyId`),
    INDEX `UserWidget_userId_fkey`(`userId`),
    INDEX `UserWidget_widgetDefinitionId_fkey`(`widgetDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `comment` TEXT NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'REIMBURSED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `authorId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `reviewerId` INTEGER NULL,
    `categoryId` INTEGER NOT NULL,

    INDEX `ExpenseReport_authorId_idx`(`authorId`),
    INDEX `ExpenseReport_companyId_idx`(`companyId`),
    INDEX `ExpenseReport_reviewerId_idx`(`reviewerId`),
    INDEX `ExpenseReport_categoryId_idx`(`categoryId`),
    INDEX `ExpenseReport_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseReportCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `companyId` INTEGER NOT NULL,

    INDEX `ExpenseReportCategory_companyId_idx`(`companyId`),
    UNIQUE INDEX `ExpenseReportCategory_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#FFFFFF',
    `companyId` INTEGER NOT NULL,

    UNIQUE INDEX `EventCategory_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `rrule` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBySystem` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `categoryId` INTEGER NULL,
    `companyId` INTEGER NULL,
    `targetRoleId` INTEGER NULL,

    INDEX `CalendarEvent_userId_startTime_endTime_idx`(`userId`, `startTime`, `endTime`),
    INDEX `CalendarEvent_authorId_idx`(`authorId`),
    INDEX `CalendarEvent_categoryId_idx`(`categoryId`),
    INDEX `CalendarEvent_companyId_idx`(`companyId`),
    INDEX `CalendarEvent_targetRoleId_idx`(`targetRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `navTitle` VARCHAR(191) NULL,
    `navIcon` VARCHAR(191) NULL,
    `showInSidebar` BOOLEAN NOT NULL DEFAULT false,
    `navOrder` INTEGER NOT NULL DEFAULT 0,
    `navGroup` VARCHAR(191) NULL,
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
    INDEX `CustomPage_companyId_showInSidebar_navOrder_idx`(`companyId`, `showInSidebar`, `navOrder`),
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

-- CreateTable
CREATE TABLE `Partner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` INTEGER NULL,

    INDEX `Partner_companyId_idx`(`companyId`),
    INDEX `Partner_createdBy_fkey`(`createdBy`),
    UNIQUE INDEX `Partner_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerServiceType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `partnerPrice` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PartnerServiceType_companyId_idx`(`companyId`),
    INDEX `PartnerServiceType_partnerId_idx`(`partnerId`),
    UNIQUE INDEX `PartnerServiceType_partnerId_name_key`(`partnerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerServiceRendered` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `partnerId` INTEGER NOT NULL,
    `serviceTypeId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PartnerServiceRendered_companyId_idx`(`companyId`),
    INDEX `PartnerServiceRendered_partnerId_idx`(`partnerId`),
    INDEX `PartnerServiceRendered_serviceTypeId_idx`(`serviceTypeId`),
    INDEX `PartnerServiceRendered_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `occurredAt` DATETIME(3) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `logId` INTEGER NOT NULL,
    `type` ENUM('ADD', 'REMOVE') NOT NULL,
    `owner` VARCHAR(191) NULL,
    `ownerRefId` INTEGER NULL,
    `itemCode` VARCHAR(191) NOT NULL,
    `itemLabel` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `properName` VARCHAR(191) NULL,
    `metadata` LONGTEXT NULL,

    UNIQUE INDEX `InventoryMovement_logId_key`(`logId`),
    INDEX `InventoryMovement_companyId_occurredAt_idx`(`companyId`, `occurredAt`),
    INDEX `InventoryMovement_companyId_userId_occurredAt_idx`(`companyId`, `userId`, `occurredAt`),
    INDEX `InventoryMovement_companyId_itemCode_occurredAt_idx`(`companyId`, `itemCode`, `occurredAt`),
    INDEX `InventoryMovement_companyId_properName_occurredAt_idx`(`companyId`, `properName`, `occurredAt`),
    INDEX `InventoryMovement_companyId_owner_occurredAt_idx`(`companyId`, `owner`, `occurredAt`),
    INDEX `InventoryMovement_ownerRefId_idx`(`ownerRefId`),
    PRIMARY KEY (`id`)
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

    INDEX `Inventory_companyId_idx`(`companyId`),
    UNIQUE INDEX `Inventory_companyId_owner_key`(`companyId`, `owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `ChatChannelRankOverride` (
    `channelId` BIGINT NOT NULL,
    `rankId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatChannelRankOverride_channelId_idx`(`channelId`),
    PRIMARY KEY (`channelId`, `rankId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannelUserOverride` (
    `channelId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `allowBits` BIGINT NOT NULL DEFAULT 0,
    `denyBits` BIGINT NOT NULL DEFAULT 0,

    INDEX `ChatChannelUserOverride_channelId_idx`(`channelId`),
    PRIMARY KEY (`channelId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatChannelReadState` (
    `channelId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `lastReadMessageId` BIGINT NULL,
    `lastReadAt` DATETIME(3) NULL,

    INDEX `ChatChannelReadState_userId_idx`(`userId`),
    PRIMARY KEY (`channelId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatDmConversation` (
    `id` BIGINT NOT NULL,
    `userAId` INTEGER NOT NULL,
    `userBId` INTEGER NOT NULL,

    UNIQUE INDEX `ChatDmConversation_userAId_userBId_key`(`userAId`, `userBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatDmMessage` (
    `id` BIGINT NOT NULL,
    `conversationId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SacemPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SacemPost_messageId_key`(`messageId`),
    INDEX `SacemPost_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SacemPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `reactionsCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SacemPayment_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SacemParticipation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,

    UNIQUE INDEX `SacemParticipation_postId_employeeId_key`(`postId`, `employeeId`),
    PRIMARY KEY (`id`)
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

    UNIQUE INDEX `StreamerKey_key_key`(`key`),
    INDEX `StreamerKey_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOLEAN', 'TEXT') NOT NULL DEFAULT 'BOOLEAN',
    `config` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `showInPerks` BOOLEAN NOT NULL DEFAULT false,
    `showInCatalog` BOOLEAN NOT NULL DEFAULT false,
    `perksDescription` LONGTEXT NULL,
    `perksPrice` DECIMAL(10, 2) NULL,
    `perksPriceDuration` VARCHAR(191) NULL,
    `perksIconUrl` VARCHAR(191) NULL,

    INDEX `ClientVariable_companyId_idx`(`companyId`),
    INDEX `ClientVariable_companyId_order_idx`(`companyId`, `order`),
    UNIQUE INDEX `ClientVariable_companyId_slug_key`(`companyId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariableAccess` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variableId` INTEGER NOT NULL,
    `kind` ENUM('USER', 'RANK') NOT NULL,
    `userId` INTEGER NULL,
    `rankId` INTEGER NULL,

    INDEX `ClientVariableAccess_variableId_idx`(`variableId`),
    INDEX `ClientVariableAccess_variableId_kind_idx`(`variableId`, `kind`),
    UNIQUE INDEX `ClientVariableAccess_variableId_kind_userId_key`(`variableId`, `kind`, `userId`),
    UNIQUE INDEX `ClientVariableAccess_variableId_kind_rankId_key`(`variableId`, `kind`, `rankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientVariableValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variableId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `value` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    INDEX `ClientVariableValue_clientId_idx`(`clientId`),
    INDEX `ClientVariableValue_variableId_idx`(`variableId`),
    UNIQUE INDEX `ClientVariableValue_variableId_clientId_key`(`variableId`, `clientId`),
    PRIMARY KEY (`id`)
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

    INDEX `MyCalendarEvent_authorId_idx`(`authorId`),
    INDEX `MyCalendarEvent_companyId_idx`(`companyId`),
    INDEX `MyCalendarEvent_startTime_endTime_idx`(`startTime`, `endTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyCalendarCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#FFFFFF',
    `userId` INTEGER NULL,
    `companyId` INTEGER NULL,

    INDEX `MyCalendarCategory_userId_idx`(`userId`),
    INDEX `MyCalendarCategory_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MyCalendarGuest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REFUSED') NOT NULL DEFAULT 'PENDING',

    INDEX `MyCalendarGuest_userId_idx`(`userId`),
    UNIQUE INDEX `MyCalendarGuest_eventId_userId_key`(`eventId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `adminId` INTEGER NOT NULL,
    `sector` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `score` INTEGER NULL,
    `answers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuizSession_token_key`(`token`),
    INDEX `QuizSession_userId_idx`(`userId`),
    INDEX `QuizSession_adminId_idx`(`adminId`),
    INDEX `QuizSession_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedSite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NOT NULL,
    `billId` INTEGER NULL,

    UNIQUE INDEX `HostedSite_slug_key`(`slug`),
    UNIQUE INDEX `HostedSite_billId_key`(`billId`),
    INDEX `HostedSite_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedPage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `route` VARCHAR(191) NOT NULL DEFAULT '',
    `title` VARCHAR(191) NOT NULL,
    `htmlContent` TEXT NOT NULL DEFAULT '',
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HostedPage_siteId_idx`(`siteId`),
    UNIQUE INDEX `HostedPage_siteId_route_key`(`siteId`, `route`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedAsset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `kind` ENUM('CSS', 'JS') NOT NULL,
    `content` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HostedAsset_siteId_idx`(`siteId`),
    UNIQUE INDEX `HostedAsset_siteId_filename_key`(`siteId`, `filename`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedForm` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `opensAt` DATETIME(3) NULL,
    `closesAt` DATETIME(3) NULL,
    `maxResponses` INTEGER NULL,
    `notifKind` ENUM('TEMPORARY', 'PERMANENT', 'BLOCKING') NOT NULL DEFAULT 'TEMPORARY',
    `notifTitle` VARCHAR(191) NULL,
    `notifMessage` VARCHAR(191) NOT NULL DEFAULT 'Merci pour votre réponse !',
    `notifDurationSec` INTEGER NOT NULL DEFAULT 5,
    `discordWebhookUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HostedForm_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedFormField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'TEXTAREA', 'EMAIL', 'NUMBER', 'BOOLEAN', 'SELECT', 'RADIO', 'DATE') NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `options` JSON NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HostedFormField_formId_idx`(`formId`),
    UNIQUE INDEX `HostedFormField_formId_key_key`(`formId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedFormResponse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formId` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HostedFormResponse_formId_idx`(`formId`),
    INDEX `HostedFormResponse_formId_isRead_idx`(`formId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedVariable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL DEFAULT '',
    `kind` ENUM('STATIC', 'DYNAMIC') NOT NULL DEFAULT 'STATIC',
    `sourceUrl` VARCHAR(191) NULL,
    `sourcePath` VARCHAR(191) NULL,
    `refreshMs` INTEGER NULL,
    `cachedValue` TEXT NULL,
    `lastFetchedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HostedVariable_siteId_idx`(`siteId`),
    UNIQUE INDEX `HostedVariable_siteId_key_key`(`siteId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HostedCustomRoute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `type` ENUM('SERVICE', 'FORM_RESPONSES') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `fields` JSON NOT NULL,
    `formId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HostedCustomRoute_siteId_idx`(`siteId`),
    UNIQUE INDEX `HostedCustomRoute_siteId_key_key`(`siteId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE `IngestFallback` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `headers` JSON NOT NULL,
    `bodyString` LONGTEXT NOT NULL,
    `enqueuedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,

    INDEX `IngestFallback_resolved_attempts_idx`(`resolved`, `attempts`),
    INDEX `IngestFallback_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `actions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    INDEX `Announcement_isActive_idx`(`isActive`),
    INDEX `Announcement_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_guild` (
    `id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `iconHash` VARCHAR(128) NULL,
    `bannerHash` VARCHAR(128) NULL,
    `ownerId` INTEGER NOT NULL,
    `systemChannelId` BIGINT NULL,
    `afkChannelId` BIGINT NULL,
    `afkTimeout` INTEGER NOT NULL DEFAULT 300,
    `verificationLevel` INTEGER NOT NULL DEFAULT 0,
    `companyId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `v2_guild_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_guild_emoji` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `imageKey` VARCHAR(128) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_guild_emoji_guildId_idx`(`guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_guild_notif_setting` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `guildId` BIGINT NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `mutedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_guild_notif_setting_guildId_idx`(`guildId`),
    UNIQUE INDEX `v2_guild_notif_setting_userId_guildId_key`(`userId`, `guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_role` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` INTEGER NOT NULL DEFAULT 0,
    `hoist` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `permissions` BIGINT NOT NULL DEFAULT 0,
    `managed` BOOLEAN NOT NULL DEFAULT false,
    `companyRankId` INTEGER NULL,
    `mentionable` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_role_guildId_position_idx`(`guildId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_member` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `guildId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `nickname` VARCHAR(32) NULL,
    `avatarHash` VARCHAR(128) NULL,
    `timeoutUntil` DATETIME(3) NULL,
    `cachedGuildPermissions` BIGINT NOT NULL DEFAULT 0,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_member_guildId_idx`(`guildId`),
    INDEX `v2_member_userId_idx`(`userId`),
    UNIQUE INDEX `v2_member_guildId_userId_key`(`guildId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_member_role` (
    `memberId` BIGINT NOT NULL,
    `roleId` BIGINT NOT NULL,

    PRIMARY KEY (`memberId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_channel` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NULL,
    `parentId` BIGINT NULL,
    `type` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `topic` VARCHAR(1024) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `nsfw` BOOLEAN NOT NULL DEFAULT false,
    `rateLimitPerUser` INTEGER NOT NULL DEFAULT 0,
    `lastMessageId` BIGINT NULL,
    `lastPinTimestamp` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_channel_guildId_position_idx`(`guildId`, `position`),
    INDEX `v2_channel_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_dm_recipient` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `hiddenAt` DATETIME(3) NULL,

    INDEX `v2_dm_recipient_userId_idx`(`userId`),
    UNIQUE INDEX `v2_dm_recipient_channelId_userId_key`(`channelId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_permission_overwrite` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `targetId` BIGINT NOT NULL,
    `type` INTEGER NOT NULL,
    `allow` BIGINT NOT NULL DEFAULT 0,
    `deny` BIGINT NOT NULL DEFAULT 0,

    INDEX `v2_permission_overwrite_channelId_idx`(`channelId`),
    UNIQUE INDEX `v2_permission_overwrite_channelId_targetId_type_key`(`channelId`, `targetId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_thread_metadata` (
    `channelId` BIGINT NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `autoArchiveDuration` INTEGER NOT NULL DEFAULT 1440,
    `archiveTimestamp` DATETIME(3) NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createMessageId` BIGINT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_message` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `type` INTEGER NOT NULL DEFAULT 0,
    `content` VARCHAR(2000) NOT NULL,
    `editedAt` DATETIME(3) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `tts` BOOLEAN NOT NULL DEFAULT false,
    `nonce` VARCHAR(64) NULL,
    `flags` INTEGER NOT NULL DEFAULT 0,
    `referencedMessageId` BIGINT NULL,
    `deletedAt` DATETIME(3) NULL,
    `authorUsername` VARCHAR(64) NOT NULL,
    `authorAvatarHash` VARCHAR(128) NULL,
    `authorNickname` VARCHAR(32) NULL,
    `mentionsJson` TEXT NULL,
    `reactionsSummary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_message_channelId_id_idx`(`channelId`, `id` DESC),
    INDEX `v2_message_authorId_idx`(`authorId`),
    FULLTEXT INDEX `v2_message_content_idx`(`content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_attachment` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `contentType` VARCHAR(128) NOT NULL,
    `size` INTEGER NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `key` VARCHAR(512) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `userId` INTEGER NULL,
    `companyId` INTEGER NULL,
    `scanStatus` VARCHAR(16) NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_attachment_messageId_idx`(`messageId`),
    INDEX `v2_attachment_userId_idx`(`userId`),
    INDEX `v2_attachment_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_embed` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `type` VARCHAR(32) NOT NULL DEFAULT 'rich',
    `url` VARCHAR(512) NULL,
    `title` VARCHAR(256) NULL,
    `description` TEXT NULL,
    `color` INTEGER NULL,
    `imageUrl` VARCHAR(512) NULL,
    `thumbnailUrl` VARCHAR(512) NULL,
    `authorName` VARCHAR(256) NULL,
    `authorUrl` VARCHAR(512) NULL,
    `footerText` VARCHAR(2048) NULL,
    `rawJson` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_embed_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_reaction` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `emoji` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_reaction_messageId_idx`(`messageId`),
    UNIQUE INDEX `v2_reaction_messageId_userId_emoji_key`(`messageId`, `userId`, `emoji`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_message_mention` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `targetId` BIGINT NOT NULL,
    `type` VARCHAR(16) NOT NULL,

    INDEX `v2_message_mention_messageId_idx`(`messageId`),
    INDEX `v2_message_mention_targetId_type_idx`(`targetId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_pinned_message` (
    `channelId` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `pinnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pinnedBy` INTEGER NOT NULL,

    INDEX `v2_pinned_message_channelId_pinnedAt_idx`(`channelId`, `pinnedAt` DESC),
    PRIMARY KEY (`channelId`, `messageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_message_edit` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `content` VARCHAR(2000) NOT NULL,
    `editorId` INTEGER NOT NULL,
    `editedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_message_edit_messageId_editedAt_idx`(`messageId`, `editedAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_invite` (
    `code` VARCHAR(16) NOT NULL,
    `guildId` BIGINT NOT NULL,
    `channelId` BIGINT NULL,
    `inviterId` INTEGER NOT NULL,
    `maxUses` INTEGER NOT NULL DEFAULT 0,
    `uses` INTEGER NOT NULL DEFAULT 0,
    `maxAge` INTEGER NOT NULL DEFAULT 86400,
    `temporary` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_invite_guildId_idx`(`guildId`),
    INDEX `v2_invite_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_ban` (
    `guildId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `reason` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_ban_guildId_idx`(`guildId`),
    PRIMARY KEY (`guildId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_webhook` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `avatarHash` VARCHAR(128) NULL,
    `token` VARCHAR(128) NOT NULL,
    `signingSecret` VARCHAR(128) NULL,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_webhook_guildId_idx`(`guildId`),
    INDEX `v2_webhook_channelId_idx`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_audit_log` (
    `id` BIGINT NOT NULL,
    `guildId` BIGINT NOT NULL,
    `actorId` INTEGER NULL,
    `targetId` BIGINT NULL,
    `actionType` INTEGER NOT NULL,
    `changes` LONGTEXT NULL,
    `reason` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_audit_log_guildId_createdAt_idx`(`guildId`, `createdAt` DESC),
    INDEX `v2_audit_log_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_migration_map` (
    `entityType` VARCHAR(20) NOT NULL,
    `v1Id` VARCHAR(64) NOT NULL,
    `v2Id` BIGINT NOT NULL,

    INDEX `v2_migration_map_v2Id_idx`(`v2Id`),
    PRIMARY KEY (`entityType`, `v1Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_channel_read_state` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `channelId` BIGINT NOT NULL,
    `lastReadMessageId` BIGINT NULL,
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_channel_read_state_channelId_idx`(`channelId`),
    UNIQUE INDEX `v2_channel_read_state_userId_channelId_key`(`userId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_push_subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(256) NOT NULL,
    `auth` VARCHAR(64) NOT NULL,
    `deviceType` VARCHAR(20) NOT NULL DEFAULT 'web',
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_push_subscription_userId_idx`(`userId`),
    UNIQUE INDEX `v2_push_subscription_userId_endpoint_key`(`userId`, `endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_user_channel_notification` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channelId` BIGINT NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `mutedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `v2_user_channel_notification_channelId_idx`(`channelId`),
    UNIQUE INDEX `v2_user_channel_notification_userId_channelId_key`(`userId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_forum_tag` (
    `id` BIGINT NOT NULL,
    `channelId` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `emoji` VARCHAR(64) NULL,
    `moderated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_forum_tag_channelId_idx`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_thread_tag` (
    `threadId` BIGINT NOT NULL,
    `tagId` BIGINT NOT NULL,

    PRIMARY KEY (`threadId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_poll` (
    `id` BIGINT NOT NULL,
    `messageId` BIGINT NOT NULL,
    `question` VARCHAR(300) NOT NULL,
    `multiple` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `v2_poll_messageId_key`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_poll_option` (
    `id` BIGINT NOT NULL,
    `pollId` BIGINT NOT NULL,
    `text` VARCHAR(100) NOT NULL,

    INDEX `v2_poll_option_pollId_idx`(`pollId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_poll_vote` (
    `id` BIGINT NOT NULL,
    `pollId` BIGINT NOT NULL,
    `optionId` BIGINT NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_poll_vote_pollId_optionId_idx`(`pollId`, `optionId`),
    UNIQUE INDEX `v2_poll_vote_pollId_userId_optionId_key`(`pollId`, `userId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_forum_subscription` (
    `userId` INTEGER NOT NULL,
    `channelId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_forum_subscription_channelId_idx`(`channelId`),
    PRIMARY KEY (`userId`, `channelId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `v2_forum_post_subscription` (
    `userId` INTEGER NOT NULL,
    `threadId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `v2_forum_post_subscription_threadId_idx`(`threadId`),
    INDEX `v2_forum_post_subscription_userId_idx`(`userId`),
    PRIMARY KEY (`userId`, `threadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserCompanies` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_UserCompanies_AB_unique`(`A`, `B`),
    INDEX `_UserCompanies_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserRoles` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_UserRoles_AB_unique`(`A`, `B`),
    INDEX `_UserRoles_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_RolePermissions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_RolePermissions_AB_unique`(`A`, `B`),
    INDEX `_RolePermissions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserPermissions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_UserPermissions_AB_unique`(`A`, `B`),
    INDEX `_UserPermissions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_RankPermissionTemplates` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_RankPermissionTemplates_AB_unique`(`A`, `B`),
    INDEX `_RankPermissionTemplates_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshSession` ADD CONSTRAINT `RefreshSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanySettings` ADD CONSTRAINT `CompanySettings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyApiKey` ADD CONSTRAINT `CompanyApiKey_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPresence` ADD CONSTRAINT `UserPresence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPresence` ADD CONSTRAINT `UserPresence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMention` ADD CONSTRAINT `ChatMention_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatReaction` ADD CONSTRAINT `ChatReaction_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatReaction` ADD CONSTRAINT `ChatReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatPinnedMessage` ADD CONSTRAINT `ChatPinnedMessage_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatPinnedMessage` ADD CONSTRAINT `ChatPinnedMessage_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatPinnedMessage` ADD CONSTRAINT `ChatPinnedMessage_pinnedByUserId_fkey` FOREIGN KEY (`pinnedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategory` ADD CONSTRAINT `ChatCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryRankOverride` ADD CONSTRAINT `ChatCategoryRankOverride_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryRankOverride` ADD CONSTRAINT `ChatCategoryRankOverride_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryUserOverride` ADD CONSTRAINT `ChatCategoryUserOverride_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatCategoryUserOverride` ADD CONSTRAINT `ChatCategoryUserOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannel` ADD CONSTRAINT `ChatChannel_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannel` ADD CONSTRAINT `ChatChannel_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ChatCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `ChatMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessageEdit` ADD CONSTRAINT `ChatMessageEdit_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessageEdit` ADD CONSTRAINT `ChatMessageEdit_editorId_fkey` FOREIGN KEY (`editorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatAttachment` ADD CONSTRAINT `ChatAttachment_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatAttachment` ADD CONSTRAINT `ChatAttachment_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableContact` ADD CONSTRAINT `BillableContact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableContact` ADD CONSTRAINT `BillableContact_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSalaryOverride` ADD CONSTRAINT `EmployeeSalaryOverride_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartner` ADD CONSTRAINT `PawnshopPartner_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopProduct` ADD CONSTRAINT `PawnshopProduct_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `PawnshopPartner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPartnerBuyPrice` ADD CONSTRAINT `PawnshopPartnerBuyPrice_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchase` ADD CONSTRAINT `PawnshopPurchase_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `PawnshopPartner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchaseItem` ADD CONSTRAINT `PawnshopPurchaseItem_inventoryId_fkey` FOREIGN KEY (`inventoryId`) REFERENCES `Inventory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchaseItem` ADD CONSTRAINT `PawnshopPurchaseItem_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `PawnshopPurchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPurchaseItem` ADD CONSTRAINT `PawnshopPurchaseItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimation` ADD CONSTRAINT `PawnshopEstimation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimation` ADD CONSTRAINT `PawnshopEstimation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimation` ADD CONSTRAINT `PawnshopEstimation_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimation` ADD CONSTRAINT `PawnshopEstimation_convertedPurchaseId_fkey` FOREIGN KEY (`convertedPurchaseId`) REFERENCES `PawnshopPurchase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimationItem` ADD CONSTRAINT `PawnshopEstimationItem_estimationId_fkey` FOREIGN KEY (`estimationId`) REFERENCES `PawnshopEstimation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopEstimationItem` ADD CONSTRAINT `PawnshopEstimationItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `PawnshopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PawnshopPublicPageConfig` ADD CONSTRAINT `PawnshopPublicPageConfig_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartonSale` ADD CONSTRAINT `CartonSale_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rank` ADD CONSTRAINT `Rank_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankHistory` ADD CONSTRAINT `RankHistory_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankHistory` ADD CONSTRAINT `RankHistory_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankHistoryArchive` ADD CONSTRAINT `RankHistoryArchive_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplate` ADD CONSTRAINT `ContractTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplate` ADD CONSTRAINT `ContractTemplate_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplateArticle` ADD CONSTRAINT `ContractTemplateArticle_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplateField` ADD CONSTRAINT `ContractTemplateField_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_senderUserId_fkey` FOREIGN KEY (`senderUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_generatedCompanyId_fkey` FOREIGN KEY (`generatedCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_modifiesCompanyId_fkey` FOREIGN KEY (`modifiesCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShare` ADD CONSTRAINT `ContractShare_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShare` ADD CONSTRAINT `ContractShare_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShareItem` ADD CONSTRAINT `ContractShareItem_shareId_fkey` FOREIGN KEY (`shareId`) REFERENCES `ContractShare`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShareItem` ADD CONSTRAINT `ContractShareItem_assignedContractId_fkey` FOREIGN KEY (`assignedContractId`) REFERENCES `AssignedContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserElectronicSignatureVersion` ADD CONSTRAINT `UserElectronicSignatureVersion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomService` ADD CONSTRAINT `CustomService_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_assignedContractId_fkey` FOREIGN KEY (`assignedContractId`) REFERENCES `AssignedContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_signerUserId_fkey` FOREIGN KEY (`signerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_signatureVersionId_fkey` FOREIGN KEY (`signatureVersionId`) REFERENCES `UserElectronicSignatureVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationRecipient` ADD CONSTRAINT `NotificationRecipient_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationRecipient` ADD CONSTRAINT `NotificationRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingCode` ADD CONSTRAINT `OnboardingCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_canceledById_fkey` FOREIGN KEY (`canceledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_authorCompanyEmployeeId_fkey` FOREIGN KEY (`authorCompanyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_accountingTargetCompanyId_fkey` FOREIGN KEY (`accountingTargetCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_accountingNotifyUserId_fkey` FOREIGN KEY (`accountingNotifyUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillShare` ADD CONSTRAINT `BillShare_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillShare` ADD CONSTRAINT `BillShare_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillComment` ADD CONSTRAINT `BillComment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TransactionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Log` ADD CONSTRAINT `Log_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionTemplate` ADD CONSTRAINT `PermissionTemplate_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyModule` ADD CONSTRAINT `CompanyModule_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyModule` ADD CONSTRAINT `CompanyModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCardTemplate` ADD CONSTRAINT `FidelityCardTemplate_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityStampZone` ADD CONSTRAINT `FidelityStampZone_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `FidelityCardTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCardHistory` ADD CONSTRAINT `FidelityCardHistory_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `FidelityCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCardHistory` ADD CONSTRAINT `FidelityCardHistory_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCard` ADD CONSTRAINT `FidelityCard_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FidelityCard` ADD CONSTRAINT `FidelityCard_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `FidelityCardTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_closureRequestedById_fkey` FOREIGN KEY (`closureRequestedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketParticipant` ADD CONSTRAINT `TicketParticipant_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketParticipant` ADD CONSTRAINT `TicketParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductDeclaration` ADD CONSTRAINT `ProductDeclaration_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductDeclaration` ADD CONSTRAINT `ProductDeclaration_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductDeclaration` ADD CONSTRAINT `ProductDeclaration_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserWidget` ADD CONSTRAINT `UserWidget_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserWidget` ADD CONSTRAINT `UserWidget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserWidget` ADD CONSTRAINT `UserWidget_widgetDefinitionId_fkey` FOREIGN KEY (`widgetDefinitionId`) REFERENCES `WidgetDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseReport` ADD CONSTRAINT `ExpenseReport_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseReport` ADD CONSTRAINT `ExpenseReport_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseReportCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseReport` ADD CONSTRAINT `ExpenseReport_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseReport` ADD CONSTRAINT `ExpenseReport_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseReportCategory` ADD CONSTRAINT `ExpenseReportCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventCategory` ADD CONSTRAINT `EventCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `EventCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_targetRoleId_fkey` FOREIGN KEY (`targetRoleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `Partner` ADD CONSTRAINT `Partner_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Partner` ADD CONSTRAINT `Partner_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceType` ADD CONSTRAINT `PartnerServiceType_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceType` ADD CONSTRAINT `PartnerServiceType_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceRendered` ADD CONSTRAINT `PartnerServiceRendered_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceRendered` ADD CONSTRAINT `PartnerServiceRendered_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceRendered` ADD CONSTRAINT `PartnerServiceRendered_serviceTypeId_fkey` FOREIGN KEY (`serviceTypeId`) REFERENCES `PartnerServiceType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerServiceRendered` ADD CONSTRAINT `PartnerServiceRendered_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_ownerRefId_fkey` FOREIGN KEY (`ownerRefId`) REFERENCES `Inventory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `Log`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelRankOverride` ADD CONSTRAINT `ChatChannelRankOverride_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelUserOverride` ADD CONSTRAINT `ChatChannelUserOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelReadState` ADD CONSTRAINT `ChatChannelReadState_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `ChatChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatChannelReadState` ADD CONSTRAINT `ChatChannelReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmConversation` ADD CONSTRAINT `ChatDmConversation_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmConversation` ADD CONSTRAINT `ChatDmConversation_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmMessage` ADD CONSTRAINT `ChatDmMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ChatDmConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatDmMessage` ADD CONSTRAINT `ChatDmMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemPost` ADD CONSTRAINT `SacemPost_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemPayment` ADD CONSTRAINT `SacemPayment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `SacemPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemParticipation` ADD CONSTRAINT `SacemParticipation_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `SacemPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SacemParticipation` ADD CONSTRAINT `SacemParticipation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamerKey` ADD CONSTRAINT `StreamerKey_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariable` ADD CONSTRAINT `ClientVariable_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_variableId_fkey` FOREIGN KEY (`variableId`) REFERENCES `ClientVariable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableAccess` ADD CONSTRAINT `ClientVariableAccess_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_variableId_fkey` FOREIGN KEY (`variableId`) REFERENCES `ClientVariable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientVariableValue` ADD CONSTRAINT `ClientVariableValue_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarEvent` ADD CONSTRAINT `MyCalendarEvent_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MyCalendarCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarCategory` ADD CONSTRAINT `MyCalendarCategory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarCategory` ADD CONSTRAINT `MyCalendarCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarGuest` ADD CONSTRAINT `MyCalendarGuest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `MyCalendarEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MyCalendarGuest` ADD CONSTRAINT `MyCalendarGuest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizSession` ADD CONSTRAINT `QuizSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizSession` ADD CONSTRAINT `QuizSession_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedSite` ADD CONSTRAINT `HostedSite_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedSite` ADD CONSTRAINT `HostedSite_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedSite` ADD CONSTRAINT `HostedSite_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedSite` ADD CONSTRAINT `HostedSite_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `Bill`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedPage` ADD CONSTRAINT `HostedPage_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `HostedSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedAsset` ADD CONSTRAINT `HostedAsset_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `HostedSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedForm` ADD CONSTRAINT `HostedForm_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `HostedSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedFormField` ADD CONSTRAINT `HostedFormField_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `HostedForm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedFormResponse` ADD CONSTRAINT `HostedFormResponse_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `HostedForm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedVariable` ADD CONSTRAINT `HostedVariable_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `HostedSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedCustomRoute` ADD CONSTRAINT `HostedCustomRoute_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `HostedSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HostedCustomRoute` ADD CONSTRAINT `HostedCustomRoute_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `HostedForm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeHREvent` ADD CONSTRAINT `EmployeeHREvent_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeHREvent` ADD CONSTRAINT `EmployeeHREvent_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeHRAttachment` ADD CONSTRAINT `EmployeeHRAttachment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `EmployeeHREvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild` ADD CONSTRAINT `v2_guild_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild` ADD CONSTRAINT `v2_guild_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild_emoji` ADD CONSTRAINT `v2_guild_emoji_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild_notif_setting` ADD CONSTRAINT `v2_guild_notif_setting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_guild_notif_setting` ADD CONSTRAINT `v2_guild_notif_setting_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_role` ADD CONSTRAINT `v2_role_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_role` ADD CONSTRAINT `v2_role_companyRankId_fkey` FOREIGN KEY (`companyRankId`) REFERENCES `Rank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_member` ADD CONSTRAINT `v2_member_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_member` ADD CONSTRAINT `v2_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_member_role` ADD CONSTRAINT `v2_member_role_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `v2_member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_member_role` ADD CONSTRAINT `v2_member_role_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `v2_role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_channel` ADD CONSTRAINT `v2_channel_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_dm_recipient` ADD CONSTRAINT `v2_dm_recipient_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_dm_recipient` ADD CONSTRAINT `v2_dm_recipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_permission_overwrite` ADD CONSTRAINT `v2_permission_overwrite_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_thread_metadata` ADD CONSTRAINT `v2_thread_metadata_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_message` ADD CONSTRAINT `v2_message_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_message` ADD CONSTRAINT `v2_message_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_attachment` ADD CONSTRAINT `v2_attachment_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_embed` ADD CONSTRAINT `v2_embed_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_reaction` ADD CONSTRAINT `v2_reaction_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_reaction` ADD CONSTRAINT `v2_reaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_message_mention` ADD CONSTRAINT `v2_message_mention_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_pinned_message` ADD CONSTRAINT `v2_pinned_message_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_pinned_message` ADD CONSTRAINT `v2_pinned_message_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_message_edit` ADD CONSTRAINT `v2_message_edit_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_message_edit` ADD CONSTRAINT `v2_message_edit_editorId_fkey` FOREIGN KEY (`editorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_invite` ADD CONSTRAINT `v2_invite_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_invite` ADD CONSTRAINT `v2_invite_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_invite` ADD CONSTRAINT `v2_invite_inviterId_fkey` FOREIGN KEY (`inviterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_ban` ADD CONSTRAINT `v2_ban_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_ban` ADD CONSTRAINT `v2_ban_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_webhook` ADD CONSTRAINT `v2_webhook_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_webhook` ADD CONSTRAINT `v2_webhook_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_webhook` ADD CONSTRAINT `v2_webhook_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_audit_log` ADD CONSTRAINT `v2_audit_log_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `v2_guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_audit_log` ADD CONSTRAINT `v2_audit_log_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_channel_read_state` ADD CONSTRAINT `v2_channel_read_state_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_channel_read_state` ADD CONSTRAINT `v2_channel_read_state_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_push_subscription` ADD CONSTRAINT `v2_push_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_user_channel_notification` ADD CONSTRAINT `v2_user_channel_notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_user_channel_notification` ADD CONSTRAINT `v2_user_channel_notification_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_tag` ADD CONSTRAINT `v2_forum_tag_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_thread_tag` ADD CONSTRAINT `v2_thread_tag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `v2_forum_tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_poll` ADD CONSTRAINT `v2_poll_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `v2_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_poll_option` ADD CONSTRAINT `v2_poll_option_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `v2_poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_poll_vote` ADD CONSTRAINT `v2_poll_vote_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `v2_poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_poll_vote` ADD CONSTRAINT `v2_poll_vote_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `v2_poll_option`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_poll_vote` ADD CONSTRAINT `v2_poll_vote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_subscription` ADD CONSTRAINT `v2_forum_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_subscription` ADD CONSTRAINT `v2_forum_subscription_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_post_subscription` ADD CONSTRAINT `v2_forum_post_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `v2_forum_post_subscription` ADD CONSTRAINT `v2_forum_post_subscription_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `v2_channel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserCompanies` ADD CONSTRAINT `_UserCompanies_A_fkey` FOREIGN KEY (`A`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserCompanies` ADD CONSTRAINT `_UserCompanies_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserRoles` ADD CONSTRAINT `_UserRoles_A_fkey` FOREIGN KEY (`A`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserRoles` ADD CONSTRAINT `_UserRoles_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RolePermissions` ADD CONSTRAINT `_RolePermissions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RolePermissions` ADD CONSTRAINT `_RolePermissions_B_fkey` FOREIGN KEY (`B`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserPermissions` ADD CONSTRAINT `_UserPermissions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserPermissions` ADD CONSTRAINT `_UserPermissions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RankPermissionTemplates` ADD CONSTRAINT `_RankPermissionTemplates_A_fkey` FOREIGN KEY (`A`) REFERENCES `PermissionTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RankPermissionTemplates` ADD CONSTRAINT `_RankPermissionTemplates_B_fkey` FOREIGN KEY (`B`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

