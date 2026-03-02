import { z } from 'zod';

/**
 * Schema Zod para validar a resposta do LLM (Gemini).
 * Resposta deve ser JSON puro, sem texto adicional.
 */
export const InvoiceLlmSchema = z.object({
  installationNumber: z.string(),
  referenceMonth: z.string(),
  dueDate: z.string(),
  energiaEletricaKwh: z.number(),
  energiaSceeKwh: z.number(),
  energiaCompensadaGdKwh: z.number(),
  energiaEletricaValor: z.number(),
  energiaSceeValor: z.number(),
  energiaCompensadaGdValor: z.number(),
  contribIlumPublicaValor: z.number(),
});

export type InvoiceLlmParsed = z.infer<typeof InvoiceLlmSchema>;
