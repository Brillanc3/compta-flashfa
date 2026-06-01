-- AlterTable
ALTER TABLE `ContractTemplate` ADD COLUMN `companyId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ContractTemplate_companyId_idx` ON `ContractTemplate`(`companyId`);

-- CreateIndex
CREATE INDEX `ContractTemplate_companyId_type_idx` ON `ContractTemplate`(`companyId`, `type`);

-- AddForeignKey
ALTER TABLE `ContractTemplate` ADD CONSTRAINT `ContractTemplate_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
