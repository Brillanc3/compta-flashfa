-- AlterTable
ALTER TABLE `Bill` ADD COLUMN `canceledById` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Bill_canceledById_fkey` ON `Bill`(`canceledById`);

-- AddForeignKey
ALTER TABLE `Bill` ADD CONSTRAINT `Bill_canceledById_fkey` FOREIGN KEY (`canceledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
