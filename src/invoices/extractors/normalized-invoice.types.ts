import type { ParsedInvoiceItem } from '../services/cemig-extractor.types.js';

/**
 * Dados normalizados após extração (PDF ou LLM), com as 4 variáveis derivadas
 * calculadas, prontos para persistência.
 */
export interface NormalizedInvoiceData {
  referenceMonth: string;
  dueDate: Date;
  totalAmount: number;
  /** Consumo Energia Elétrica (kWh) = energiaEletricaKwh + energiaSceeKwh */
  consumoEnergiaEletricaKwh: number;
  /** Energia Compensada (kWh) = energiaCompensadaGdKwh */
  energiaCompensadaKwh: number;
  /** Valor total sem GD (R$) = energiaEletricaValor + energiaSceeValor + contribIlumPublicaValor */
  valorTotalSemGd: number;
  /** Economia GD (R$) = |energiaCompensadaGdValor| */
  economiaGd: number;
  /** Opcional: itens da fatura (preenchido pelo extrator PDF) */
  items?: ParsedInvoiceItem[];
  /** Campos opcionais do extrator Cemig (PDF) */
  emissionDate?: Date | null;
  publicLighting?: number | null;
  invoiceNumber?: string | null;
  barcode?: string | null;
  currentGenerationBalance?: number | null;
}
