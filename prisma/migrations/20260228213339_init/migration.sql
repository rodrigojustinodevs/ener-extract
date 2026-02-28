-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `cpf_cnpj` VARCHAR(20) NULL,
    `refresh_token` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_cpf_cnpj_key`(`cpf_cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `installation_number` VARCHAR(50) NOT NULL,
    `client_number` VARCHAR(50) NOT NULL,
    `address` VARCHAR(500) NULL,
    `consumer_class` ENUM('RESIDENCIAL', 'COMERCIAL', 'INDUSTRIAL', 'RURAL', 'PODER_PUBLICO') NULL,
    `tariff_modality` VARCHAR(100) NULL,
    `is_gd` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `installations_installation_number_key`(`installation_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `installation_id` INTEGER NOT NULL,
    `reference_month` VARCHAR(10) NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `emission_date` DATETIME(3) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `public_lighting` DECIMAL(10, 2) NULL,
    `tariff_flag` ENUM('VERDE', 'AMARELA', 'VERMELHA_P1', 'VERMELHA_P2', 'ESCASSEZ_HIDRICA') NULL,
    `invoice_number` VARCHAR(100) NULL,
    `generation_balance` DECIMAL(10, 3) NULL,
    `pdf_path` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoices_installation_id_reference_month_key`(`installation_id`, `reference_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `type` ENUM('ENERGIA_ELETRICA', 'ENERGIA_SCEE', 'ENERGIA_COMPENSADA_GD', 'CONTRIB_ILUM_PUBLICA', 'OUTROS') NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(10, 3) NULL,
    `unit_price` DECIMAL(14, 8) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `icms_base` DECIMAL(10, 2) NULL,
    `icms_rate` DECIMAL(5, 4) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consumption_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `reference_month` VARCHAR(10) NOT NULL,
    `consumption_kwh` DECIMAL(10, 3) NOT NULL,
    `daily_average` DECIMAL(10, 3) NULL,
    `days_count` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `installations` ADD CONSTRAINT `installations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_installation_id_fkey` FOREIGN KEY (`installation_id`) REFERENCES `installations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consumption_history` ADD CONSTRAINT `consumption_history_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
