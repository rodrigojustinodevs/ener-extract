import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type GenerativeContentBlob,
  GoogleGenerativeAI,
  type Part,
} from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import type { InvoiceConfig } from '../../config/invoice.config.js';
import type { NormalizedInvoiceData } from './normalized-invoice.types';
import {
  InvoiceLlmSchema,
  type InvoiceLlmParsed,
} from './llm-extractor.schema.js';

const JSON_SCHEMA_PROMPT = `
Extraia os dados da fatura de energia do PDF e responda APENAS com um único objeto JSON válido, sem markdown, sem texto antes ou depois.
Use exatamente as chaves e tipos abaixo (números como number, não string):

{
  "installationNumber": "string (número da instalação)",
  "referenceMonth": "string (ex: JUL/2024 ou 2024-07)",
  "dueDate": "string (ex: DD/MM/AAAA)",
  "energiaEletricaKwh": number,
  "energiaSceeKwh": number,
  "energiaCompensadaGdKwh": number,
  "energiaEletricaValor": number,
  "energiaSceeValor": number,
  "energiaCompensadaGdValor": number,
  "contribIlumPublicaValor": number
}

Regras: valores monetários em número (ex: 123.45), consumo em kWh como número. dueDate no formato DD/MM/AAAA.
`;

/**
 * Extrai dados da fatura via LLM (Gemini).
 * Valida resposta com Zod e calcula as 4 variáveis derivadas.
 */
@Injectable()
export class LlmExtractorService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<InvoiceConfig>('invoice')!;
    this.apiKey = config.geminiApiKey;
    this.model = config.geminiModel;
    this.timeoutMs = config.geminiTimeoutMs;
  }

  async extract(file: Express.Multer.File): Promise<NormalizedInvoiceData> {
    if (!this.apiKey?.trim()) {
      throw new ServiceUnavailableException(
        'Extrator LLM não configurado: GEMINI_API_KEY ausente',
      );
    }

    const base64 = await this.readPdfAsBase64(file.path);
    const raw = await this.callGemini(base64);
    const parsed = this.validateAndParse(raw);
    return this.toNormalized(parsed);
  }

  private async readPdfAsBase64(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    return buffer.toString('base64');
  }

  private async callGemini(base64Pdf: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const blob: GenerativeContentBlob = {
      mimeType: 'application/pdf',
      data: base64Pdf,
    };
    const parts: Part[] = [{ text: JSON_SCHEMA_PROMPT }, { inlineData: blob }];

    const model = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Timeout na chamada ao Gemini')),
        this.timeoutMs,
      );
    });

    try {
      const result = await Promise.race([
        model.generateContent({ contents: [{ role: 'user', parts }] }),
        timeoutPromise,
      ]);
      if (timeoutId) clearTimeout(timeoutId);
      const response = result.response;
      const text = response.text();
      if (!text?.trim()) {
        throw new BadRequestException(
          'Resposta do extrator LLM vazia ou bloqueada',
        );
      }
      return this.extractJsonFromResponse(text);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error) {
        if (err.message.includes('Timeout')) {
          throw new ServiceUnavailableException(
            `Extrator LLM: timeout após ${this.timeoutMs}ms`,
          );
        }
        throw new BadRequestException(
          `Falha na extração via LLM: ${err.message}`,
        );
      }
      throw err;
    }
  }

  /**
   * Tenta extrair JSON puro da resposta (remove markdown se existir).
   */
  private extractJsonFromResponse(text: string): string {
    const trimmed = text.trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new BadRequestException(
        'Resposta do LLM não contém um objeto JSON válido',
      );
    }
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }

  private validateAndParse(raw: string): InvoiceLlmParsed {
    try {
      const json = JSON.parse(raw) as unknown;
      return InvoiceLlmSchema.parse(json);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Resposta inválida do LLM';
      throw new BadRequestException(`Validação da fatura falhou: ${message}`);
    }
  }

  private parseDueDate(dueDateStr: string): Date {
    const normalized = dueDateStr.trim();
    const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(d.getTime())) return d;
    }
    const iso = new Date(normalized);
    if (!Number.isNaN(iso.getTime())) return iso;
    throw new BadRequestException(
      `Data de vencimento inválida: ${dueDateStr}. Use DD/MM/AAAA.`,
    );
  }

  private toNormalized(parsed: InvoiceLlmParsed): NormalizedInvoiceData {
    const consumoEnergiaEletricaKwh =
      parsed.energiaEletricaKwh + parsed.energiaSceeKwh;
    const energiaCompensadaKwh = parsed.energiaCompensadaGdKwh;
    const valorTotalSemGd =
      parsed.energiaEletricaValor +
      parsed.energiaSceeValor +
      parsed.contribIlumPublicaValor;
    const economiaGd = Math.abs(parsed.energiaCompensadaGdValor);
    const totalAmount = valorTotalSemGd - economiaGd;

    return {
      referenceMonth: parsed.referenceMonth,
      dueDate: this.parseDueDate(parsed.dueDate),
      totalAmount,
      consumoEnergiaEletricaKwh,
      energiaCompensadaKwh,
      valorTotalSemGd,
      economiaGd,
    };
  }
}
