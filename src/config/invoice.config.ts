import { registerAs } from '@nestjs/config';

export type InvoiceExtractorMode = 'llm' | 'pdf';

export type InvoiceConfig = {
  extractorMode: InvoiceExtractorMode;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
};

export default registerAs('invoice', (): InvoiceConfig => {
  const raw = process.env.INVOICE_EXTRACTOR_MODE?.toLowerCase();
  const extractorMode: InvoiceExtractorMode =
    raw === 'llm' || raw === 'pdf' ? raw : 'pdf';

  return {
    extractorMode,
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    geminiTimeoutMs: Math.max(
      5000,
      parseInt(process.env.GEMINI_TIMEOUT_MS ?? '30000', 10),
    ),
  };
});
