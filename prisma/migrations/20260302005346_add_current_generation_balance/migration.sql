/*
  Warnings:

  - You are about to drop the column `generation_balance` on the `invoices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `invoices` DROP COLUMN `generation_balance`,
    ADD COLUMN `barcode` VARCHAR(300) NULL,
    ADD COLUMN `current_generation_balance` DECIMAL(12, 3) NULL;
