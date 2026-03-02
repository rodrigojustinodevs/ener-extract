-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `consumo_energia_eletrica_kwh` DECIMAL(12, 3) NULL,
    ADD COLUMN `energia_compensada_kwh` DECIMAL(12, 3) NULL,
    ADD COLUMN `valor_total_sem_gd` DECIMAL(10, 2) NULL,
    ADD COLUMN `economia_gd` DECIMAL(10, 2) NULL;
