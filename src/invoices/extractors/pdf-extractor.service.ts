import { Injectable } from '@nestjs/common';
import type { ParsedInvoice } from '../services/cemig-extractor.types.js';
import { CemigExtractorService } from '../services/cemig-extractor.service.js';
import { PdfParserService } from '../services/pdf-parser.service.js';
import type { NormalizedInvoiceData } from './normalized-invoice.types';

/**
 * Extrai dados da fatura via pdf-parse + Cemig (regex).
 * Calcula as 4 variáveis derivadas a partir dos itens e contribuição.
 */
@Injectable()
export class PdfExtractorService {
  constructor(
    private readonly pdfParser: PdfParserService,
    private readonly cemigExtractor: CemigExtractorService,
  ) {}

  async extract(file: Express.Multer.File): Promise<NormalizedInvoiceData> {
    const path = file.path ?? (file as unknown as { path?: string }).path;
    if (!path) {
      throw new Error('Arquivo sem path; use storage em disco no Multer.');
    }
    const text = await this.pdfParser.parse(path);
    const parsed = this.cemigExtractor.extract(text);
    return this.toNormalized(parsed);
  }

  private toNormalized(parsed: ParsedInvoice): NormalizedInvoiceData {
    const {
      consumoEnergiaEletricaKwh,
      energiaCompensadaKwh,
      valorTotalSemGd,
      economiaGd,
    } = this.computeDerivedVariables(parsed);

    return {
      referenceMonth: parsed.referenceMonth,
      dueDate: parsed.dueDate,
      totalAmount: parsed.totalAmount,
      consumoEnergiaEletricaKwh,
      energiaCompensadaKwh,
      valorTotalSemGd,
      economiaGd,
      items: parsed.items,
      emissionDate: parsed.emissionDate,
      publicLighting: parsed.publicLighting,
      invoiceNumber: parsed.invoiceNumber,
      barcode: parsed.barcode,
      currentGenerationBalance: parsed.currentGenerationBalance,
    };
  }

  private computeDerivedVariables(parsed: ParsedInvoice): {
    consumoEnergiaEletricaKwh: number;
    energiaCompensadaKwh: number;
    valorTotalSemGd: number;
    economiaGd: number;
  } {
    let energiaEletricaKwh = 0;
    let energiaSceeKwh = 0;
    let energiaCompensadaGdKwh = 0;
    let energiaEletricaValor = 0;
    let energiaSceeValor = 0;
    let energiaCompensadaGdValor = 0;

    for (const item of parsed.items) {
      const kwh = item.consumptionKwh ?? item.quantity ?? 0;
      const amount = item.amount ?? 0;
      switch (item.type) {
        case 'ENERGIA_ELETRICA':
          energiaEletricaKwh += Number(kwh);
          energiaEletricaValor += Number(amount);
          break;
        case 'ENERGIA_SCEE':
          energiaSceeKwh += Number(kwh);
          energiaSceeValor += Number(amount);
          break;
        case 'ENERGIA_COMPENSADA_GD':
          energiaCompensadaGdKwh += Number(kwh);
          energiaCompensadaGdValor += Number(amount);
          break;
        default:
          break;
      }
    }

    const contrib = parsed.publicLighting ?? 0;
    const consumoEnergiaEletricaKwh = energiaEletricaKwh + energiaSceeKwh;
    const energiaCompensadaKwh = energiaCompensadaGdKwh;
    const valorTotalSemGd =
      energiaEletricaValor + energiaSceeValor + Number(contrib);
    const economiaGd = Math.abs(energiaCompensadaGdValor);

    return {
      consumoEnergiaEletricaKwh,
      energiaCompensadaKwh,
      valorTotalSemGd,
      economiaGd,
    };
  }
}
