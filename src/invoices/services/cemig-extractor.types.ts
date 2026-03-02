import type {
  ConsumerClass,
  InvoiceItemType,
} from '../../../generated/prisma/enums.js';

export interface ParsedInvoiceItem {
  type: InvoiceItemType;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  icmsBase: number | null;
  icmsRate: number | null;
  consumptionKwh?: number;
}

export interface ParsedInvoice {
  installationNumber: string;
  clientNumber: string;
  referenceMonth: string;
  dueDate: Date;
  totalAmount: number;
  /** installations.address */
  address: string | null;
  /** installations.consumer_class */
  consumerClass: ConsumerClass | null;
  /** installations.tariff_modality */
  tariffModality: string | null;
  /** invoices.emission_date */
  emissionDate: Date | null;
  /** invoices.public_lighting (Contrib Ilum) */
  publicLighting: number | null;
  /** invoices.invoice_number (NOTA FISCAL Nº) */
  invoiceNumber: string | null;
  /** invoices.barcode (código de barra da fatura) */
  barcode: string | null;
  /** invoices.current_generation_balance (SALDO ATUAL DE GERAÇÃO, kWh) */
  currentGenerationBalance: number | null;
  items: ParsedInvoiceItem[];
}
