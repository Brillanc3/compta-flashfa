/*
  Warnings:

  - You are about to drop the column `status` on the `ExpenseReport` table. All the data in the column will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MutedConversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ConversationParticipants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Conversation` DROP FOREIGN KEY `Conversation_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_senderId_fkey`;

-- DropForeignKey
ALTER TABLE `MessageReport` DROP FOREIGN KEY `MessageReport_messageId_fkey`;

-- DropForeignKey
ALTER TABLE `MessageReport` DROP FOREIGN KEY `MessageReport_reporterId_fkey`;

-- DropForeignKey
ALTER TABLE `MutedConversation` DROP FOREIGN KEY `MutedConversation_conversationId_fkey`;

-- DropForeignKey
ALTER TABLE `MutedConversation` DROP FOREIGN KEY `MutedConversation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `_ConversationParticipants` DROP FOREIGN KEY `_ConversationParticipants_A_fkey`;

-- DropForeignKey
ALTER TABLE `_ConversationParticipants` DROP FOREIGN KEY `_ConversationParticipants_B_fkey`;

-- AlterTable
ALTER TABLE `ExpenseReport` DROP COLUMN `status`;

-- DropTable
DROP TABLE `Conversation`;

-- DropTable
DROP TABLE `Message`;

-- DropTable
DROP TABLE `MessageReport`;

-- DropTable
DROP TABLE `MutedConversation`;

-- DropTable
DROP TABLE `_ConversationParticipants`;
