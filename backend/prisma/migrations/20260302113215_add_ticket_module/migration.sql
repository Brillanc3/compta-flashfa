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
