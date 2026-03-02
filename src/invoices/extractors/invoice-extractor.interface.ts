import type { NormalizedInvoiceData } from './normalized-invoice.types';

/**
 * Contrato para extratores de fatura (PDF tradicional ou LLM).
 * Recebe o arquivo do Multer e retorna dados normalizados para persistência.
 */
export interface IInvoiceExtractor {
  extract(file: Express.Multer.File): Promise<NormalizedInvoiceData>;
}
