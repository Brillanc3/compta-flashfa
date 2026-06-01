-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `ticketAdminId` INTEGER NULL,
    ADD COLUMN `ticketStatus` ENUM('OPEN', 'CLOSE', 'INWAITING', 'PENDING_S', 'PENDING_U') NULL;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_ticketAdminId_fkey` FOREIGN KEY (`ticketAdminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
