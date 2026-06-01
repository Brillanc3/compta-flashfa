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
    `characterId` INTEGER NULL,
    `discordId` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `notificationPreferences` LONGTEXT NULL,
    `preferences` LONGTEXT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_tempPasswordToken_key`(`tempPasswordToken`),
    UNIQUE INDEX `User_characterId_key`(`characterId`),
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
    `isParentCompany` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Company_name_key`(`name`),
    UNIQUE INDEX `Company_onboardingKey_key`(`onboardingKey`),
    UNIQUE INDEX `Company_apiKey_key`(`apiKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillableContact` (
    `userId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BillableContact_companyId_fkey`(`companyId`),
    PRIMARY KEY (`userId`, `companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
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

    INDEX `CompanyEmployee_rankId_fkey`(`rankId`),
    INDEX `CompanyEmployee_userId_fkey`(`userId`),
    UNIQUE INDEX `CompanyEmployee_companyId_userId_key`(`companyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `groupRankId` INTEGER NULL,
    `remunerationConfig` LONGTEXT NULL,
    `salaryCap` DECIMAL(10, 2) NULL,

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
CREATE TABLE `Conversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `type` ENUM('DIRECT', 'GROUP', 'TICKET') NOT NULL DEFAULT 'DIRECT',
    `subject` VARCHAR(191) NULL,
    `category` ENUM('BILLING', 'TECHNICAL', 'GENERAL', 'CONTACT', 'OTHER') NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NULL,
    `assigneeId` INTEGER NULL,

    INDEX `Conversation_updatedAt_idx`(`updatedAt`),
    INDEX `Conversation_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `content` TEXT NOT NULL,
    `type` ENUM('USER', 'SYSTEM', 'APPOINTMENT_PROPOSAL') NOT NULL DEFAULT 'USER',
    `payload` LONGTEXT NULL,
    `conversationId` INTEGER NOT NULL,
    `senderId` INTEGER NULL,

    INDEX `Message_conversationId_idx`(`conversationId`),
    INDEX `Message_senderId_fkey`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` ENUM('HRP', 'MIX_RP', 'GROSSIER', 'AUTRE') NOT NULL,
    `customReason` VARCHAR(75) NULL,
    `status` ENUM('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
    `messageId` INTEGER NOT NULL,
    `reporterId` INTEGER NOT NULL,

    INDEX `MessageReport_messageId_idx`(`messageId`),
    INDEX `MessageReport_reporterId_idx`(`reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MutedConversation` (
    `userId` INTEGER NOT NULL,
    `conversationId` INTEGER NOT NULL,

    INDEX `MutedConversation_conversationId_fkey`(`conversationId`),
    PRIMARY KEY (`userId`, `conversationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `type` ENUM('ADMIN', 'COMPANY', 'LAWYER') NOT NULL DEFAULT 'ADMIN',
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `ownerUserId` INTEGER NULL,

    INDEX `ContractTemplate_ownerUserId_fkey`(`ownerUserId`),
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
    `status` ENUM('PENDING', 'SIGNED', 'REJECTED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `fieldValues` TEXT NULL,
    `templateId` INTEGER NOT NULL,
    `assignedToUserId` INTEGER NOT NULL,
    `generatedCompanyId` INTEGER NULL,
    `modifiesCompanyId` INTEGER NULL,

    INDEX `AssignedContract_assignedToUserId_status_idx`(`assignedToUserId`, `status`),
    INDEX `AssignedContract_generatedCompanyId_fkey`(`generatedCompanyId`),
    INDEX `AssignedContract_templateId_fkey`(`templateId`),
    INDEX `AssignedContract_modifiesCompanyId_idx`(`modifiesCompanyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractSignature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmationText` VARCHAR(191) NOT NULL,
    `assignedContractId` INTEGER NOT NULL,

    UNIQUE INDEX `ContractSignature_assignedContractId_key`(`assignedContractId`),
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
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ownerType` ENUM('USER', 'COMPANY') NOT NULL,
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
    `companyId` INTEGER NOT NULL,
    `clientId` INTEGER NULL,

    UNIQUE INDEX `Bill_externalBillId_key`(`externalBillId`),
    INDEX `Bill_authorId_fkey`(`authorId`),
    INDEX `Bill_clientId_fkey`(`clientId`),
    INDEX `Bill_companyId_fkey`(`companyId`),
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

    UNIQUE INDEX `Transaction_billId_key`(`billId`),
    INDEX `Transaction_categoryId_fkey`(`categoryId`),
    INDEX `Transaction_companyId_fkey`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('CHIFFRE_AFFAIRES', 'AUTRES_ENTREES', 'DONS_RECUS', 'DECORATION', 'SUBVENTIONS_RECUES', 'SALAIRES', 'MATIERES_PREMIERES', 'AVOCATS', 'FRAIS_COMPTABLE', 'LOCATIONS', 'FRAIS_VEHICULES', 'NOURRITURE', 'DONS_EFFECTUES', 'LOCATIONS_NON_DEDUC', 'CHARGES_VEHICULES_NON_DEDUC', 'AUTRES_NON_DEDUC') NOT NULL,
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

    INDEX `Client_companyId_fkey`(`companyId`),
    UNIQUE INDEX `Client_name_companyId_key`(`name`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FidelityCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicLink` VARCHAR(191) NOT NULL,
    `stampCount` INTEGER NOT NULL DEFAULT 0,
    `clientId` INTEGER NOT NULL,

    UNIQUE INDEX `FidelityCard_publicLink_key`(`publicLink`),
    UNIQUE INDEX `FidelityCard_clientId_key`(`clientId`),
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
    `status` ENUM('PENDING', 'REIMBURSED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `authorId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `reviewerId` INTEGER NULL,
    `categoryId` INTEGER NOT NULL,

    INDEX `ExpenseReport_authorId_idx`(`authorId`),
    INDEX `ExpenseReport_companyId_idx`(`companyId`),
    INDEX `ExpenseReport_reviewerId_idx`(`reviewerId`),
    INDEX `ExpenseReport_categoryId_idx`(`categoryId`),
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
CREATE TABLE `_ConversationParticipants` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ConversationParticipants_AB_unique`(`A`, `B`),
    INDEX `_ConversationParticipants_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_RankPermissionTemplates` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_RankPermissionTemplates_AB_unique`(`A`, `B`),
    INDEX `_RankPermissionTemplates_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BillableContact` ADD CONSTRAINT `BillableContact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillableContact` ADD CONSTRAINT `BillableContact_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEmployee` ADD CONSTRAINT `CompanyEmployee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rank` ADD CONSTRAINT `Rank_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankHistory` ADD CONSTRAINT `RankHistory_companyEmployeeId_fkey` FOREIGN KEY (`companyEmployeeId`) REFERENCES `CompanyEmployee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankHistory` ADD CONSTRAINT `RankHistory_rankId_fkey` FOREIGN KEY (`rankId`) REFERENCES `Rank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageReport` ADD CONSTRAINT `MessageReport_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageReport` ADD CONSTRAINT `MessageReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MutedConversation` ADD CONSTRAINT `MutedConversation_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MutedConversation` ADD CONSTRAINT `MutedConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplate` ADD CONSTRAINT `ContractTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplateField` ADD CONSTRAINT `ContractTemplateField_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_generatedCompanyId_fkey` FOREIGN KEY (`generatedCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_modifiesCompanyId_fkey` FOREIGN KEY (`modifiesCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignedContract` ADD CONSTRAINT `AssignedContract_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSignature` ADD CONSTRAINT `ContractSignature_assignedContractId_fkey` FOREIGN KEY (`assignedContractId`) REFERENCES `AssignedContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationRecipient` ADD CONSTRAINT `NotificationRecipient_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationRecipient` ADD CONSTRAINT `NotificationRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingCode` ADD CONSTRAINT `OnboardingCode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `FidelityCard` ADD CONSTRAINT `FidelityCard_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `EventCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarEvent` ADD CONSTRAINT `CalendarEvent_targetRoleId_fkey` FOREIGN KEY (`targetRoleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `_ConversationParticipants` ADD CONSTRAINT `_ConversationParticipants_A_fkey` FOREIGN KEY (`A`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ConversationParticipants` ADD CONSTRAINT `_ConversationParticipants_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RankPermissionTemplates` ADD CONSTRAINT `_RankPermissionTemplates_A_fkey` FOREIGN KEY (`A`) REFERENCES `PermissionTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RankPermissionTemplates` ADD CONSTRAINT `_RankPermissionTemplates_B_fkey` FOREIGN KEY (`B`) REFERENCES `Rank`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
