-- AddForeignKey
ALTER TABLE `FidelityCard` ADD CONSTRAINT `FidelityCard_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
