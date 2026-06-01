-- AlterTable
ALTER TABLE `AssignedContract` ADD COLUMN `generatedCompanyNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `modifiesCompanyNameSnapshot` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ContractTemplate` ADD COLUMN `companyNameSnapshot` VARCHAR(191) NULL;
