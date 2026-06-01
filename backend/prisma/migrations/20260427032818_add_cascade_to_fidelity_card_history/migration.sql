-- DropForeignKey
ALTER TABLE `FidelityCardHistory` DROP FOREIGN KEY `FidelityCardHistory_cardId_fkey`;

-- AddForeignKey
ALTER TABLE `FidelityCardHistory` ADD CONSTRAINT `FidelityCardHistory_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `FidelityCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
