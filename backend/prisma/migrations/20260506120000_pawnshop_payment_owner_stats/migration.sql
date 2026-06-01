-- AlterTable PawnshopPurchase: add paymentStatus + paidAt (additive, no data loss)
ALTER TABLE `PawnshopPurchase`
  ADD COLUMN `paymentStatus` ENUM('UNPAID', 'PAID_TRANSFER') NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN `paidAt` DATETIME(3) NULL;
