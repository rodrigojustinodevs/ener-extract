import { Injectable } from '@nestjs/common';
import type {
  ConsumerClass,
  InvoiceItemType,
} from '../../../generated/prisma/enums.js';
import type {
  ParsedInvoice,
  ParsedInvoiceItem,
} from './cemig-extractor.types.js';

/**
 * Serviço responsável exclusivamente por extrair dados estruturados
 * do texto bruto de uma fatura Cemig.
 *
 * Não possui responsabilidade de persistência.
 */
@Injectable()
export class CemigExtractorService {
  extract(text: string): ParsedInvoice {
    const normalizedText = this.normalizeText(text);
    const { clientNumber, installationNumber } =
      this.extractClientAndInstallation(normalizedText);
    const valoresFaturadosBlock =
      this.extractValoresFaturadosBlock(normalizedText);

    return {
      clientNumber,
      installationNumber:
        installationNumber || this.extractInstallationNumber(normalizedText),
      referenceMonth: this.extractReferenceMonth(normalizedText),
      dueDate: this.extractDueDate(normalizedText),
      totalAmount: this.extractTotalAmount(normalizedText),
      address: this.extractAddress(normalizedText),
      consumerClass: this.extractConsumerClass(normalizedText),
      tariffModality: this.extractTariffModality(normalizedText),
      emissionDate: this.extractEmissionDate(normalizedText),
      publicLighting: this.extractPublicLighting(valoresFaturadosBlock),
      invoiceNumber: this.extractInvoiceNumber(normalizedText),
      barcode: this.extractBarcode(normalizedText),
      currentGenerationBalance:
        this.extractCurrentGenerationBalance(normalizedText),
      items: this.extractItems(valoresFaturadosBlock),
    };
  }

  /**
   * Extrai apenas o bloco "Valores Faturados" (até Histórico de Consumo ou fim da tabela).
   */
  private extractValoresFaturadosBlock(text: string): string {
    const start = text.search(/Valores\s+Faturados/i);
    if (start === -1) return text;
    const afterStart = text.slice(start);
    const endMatch = afterStart.match(/\n\s*Hist[oó]rico\s+de\s+Consumo/i);
    const end = endMatch?.index ?? afterStart.length;
    return afterStart.slice(0, end).trim();
  }

  private normalizeText(text: string): string {
    return text.replace(/\r/g, '').trim();
  }

  private parseBrl(value: string): number {
    return this.toFloat(
      value
        .replace(/\s/g, '')
        .replace(/R\$\s?/i, '')
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  private parseDecimal(value: string): number {
    return this.toFloat(
      value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'),
    );
  }

  private toFloat(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /* -------------------------------------------------------------------------- */
  /*                           FIELD EXTRACTION HELPERS                         */
  /* -------------------------------------------------------------------------- */

  private matchFirst(
    text: string,
    patterns: RegExp[],
  ): RegExpMatchArray | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }

  /* -------------------------------------------------------------------------- */
  /*                    Nº DO CLIENTE e Nº DA INSTALAÇÃO                        */
  /* -------------------------------------------------------------------------- */

  /**
   * Extrai Nº DO CLIENTE e Nº DA INSTALAÇÃO do bloco típico da Cemig:
   * "Nº DO CLIENTE Nº DA INSTALAÇÃO" na linha seguinte "XXXX XXXXX"
   */
  private extractClientAndInstallation(text: string): {
    clientNumber: string;
    installationNumber: string;
  } {
    const pattern =
      /N[º°]?\s*DO\s+CLIENTE\s+N[º°]?\s*DA\s+INSTALA[CÇ][AÃ]O\s*\n\s*(\d+)\s+(\d+)/i;
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return {
        clientNumber: match[1].trim(),
        installationNumber: match[2].trim(),
      };
    }
    return { clientNumber: '', installationNumber: '' };
  }

  private extractInstallationNumber(text: string): string {
    const patterns: RegExp[] = [
      /(?:N[º°]?\s*da?\s*Instala[cç][aã]o|Instala[cç][aã]o)\s*:?\s*(\d{8,15})/i,
      /Instala[cç][aã]o\s+(\d{8,15})/i,
      /(\d{10,15})\s*\/\s*\d{4}/,
    ];

    const match = this.matchFirst(text, patterns);
    return match?.[1]?.trim() ?? '';
  }

  /* -------------------------------------------------------------------------- */
  /*                              REFERENCE MONTH                               */
  /* -------------------------------------------------------------------------- */

  private extractReferenceMonth(text: string): string {
    const patterns: RegExp[] = [
      /(?:M[eê]s\s+de\s+refer[eê]ncia|Refer[eê]ncia|Mês Ref\.?)\s*:?\s*([A-Z]{3}\/\d{4})/i,
      /([A-Z]{3}\/\d{4})/,
      /(\d{2}\/\d{4})/,
    ];

    const match = this.matchFirst(text, patterns);
    return match?.[1]?.trim() ?? '';
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DUE DATE                                  */
  /* -------------------------------------------------------------------------- */

  private extractDueDate(text: string): Date {
    const patterns: RegExp[] = [
      /(?:Data\s+de\s+)?Vencimento\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i,
      /Venc\.?\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i,
      /(\d{2})\/(\d{2})\/(\d{4})/,
    ];

    const match = this.matchFirst(text, patterns);

    if (!match || !match[1] || !match[2] || !match[3]) return new Date(NaN);

    const day = match[1];
    const month = match[2];
    const year = match[3];
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    return Number.isNaN(date.getTime()) ? new Date(NaN) : date;
  }

  private extractTotalAmount(text: string): number {
    const patterns: RegExp[] = [
      /TOTAL\s+(\d+,\d{2})/i,
      /(?:Total\s+a\s+pagar|Valor\s+a\s+pagar)\s*\(?R?\$?\)?\s*[\s\S]*?(\d+,\d{2})/i,
      /(?:Total\s+a\s+pagar|Valor\s+Total|Total)\s*:?\s*R\$\s*([\d.,\s]+)/i,
      /R\$\s*([\d.,\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return this.parseBrl(match[1]);
    }
    return 0;
  }

  /**
   * Extrai endereço da unidade (logradouro + bairro + CEP cidade/UF).
   */
  private extractAddress(text: string): string | null {
    const patterns = [
      /(?:Endere[cç]o\s+da\s+unidade|Endere[cç]o)\s*:?\s*[\n\s]*([^\n]+[\n\s]+[^\n]+[\n\s]+\d{5}-?\d{3}\s+[^\n]+)/i,
      /(?:RUA|AV\.?|R\.?)\s+[^\n]+[\n\s]+[^\n]+[\n\s]+\d{5}-?\d{3}\s+[^\n]+/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[0]) {
        const raw = (match[1] ?? match[0]).replace(/\n/g, ', ').trim();
        return raw.slice(0, 500) || null;
      }
    }
    return null;
  }

  private extractConsumerClass(text: string): ConsumerClass | null {
    const m = text.match(
      /Classe\s+Subclasse\s+Modalidade[\s\S]*?\n\s*(\w+)\s+/i,
    );
    const v = m?.[1]?.toUpperCase();
    if (
      v === 'RESIDENCIAL' ||
      v === 'COMERCIAL' ||
      v === 'INDUSTRIAL' ||
      v === 'RURAL'
    )
      return v as ConsumerClass;
    if (v?.includes('PODER') || v?.includes('PUBLICO')) return 'PODER_PUBLICO';
    return null;
  }

  private extractTariffModality(text: string): string | null {
    const m = text.match(
      /Modalidade\s+Tarif[aá]ria[\s\S]*?\n\s*\w+\s+\w+\s+([^\n]+?)(?:\s+Anterior|$)/i,
    );
    return m?.[1]?.trim().slice(0, 100) ?? null;
  }

  private extractEmissionDate(text: string): Date | null {
    const m = text.match(
      /Data\s+de\s+emiss[aã]o\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i,
    );
    if (!m?.[1] || !m?.[2] || !m?.[3]) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private extractPublicLighting(valoresFaturadosBlock: string): number | null {
    const m = valoresFaturadosBlock.match(
      /Contrib\s+Ilum[^\n]*\s+(\d+,\d{2})/i,
    );
    return m?.[1] ? this.parseBrl(m[1]) : null;
  }

  private extractInvoiceNumber(text: string): string | null {
    const m = text.match(
      /NOTA\s+FISCAL\s+N[º°]?\s*(\d[\d\s-]+?)(?:\s*-\s*S[EÉ]RIE|$)/i,
    );
    return m?.[1]?.trim().replace(/\s/g, '').slice(0, 100) ?? null;
  }

  /**
   * Extrai código de barra da fatura (linha de dígitos após mês/ano).
   */
  private extractBarcode(text: string): string | null {
    const m = text.match(
      /(?:Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\/\d{4}\s+([\d\s-]+)/i,
    );
    return m?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 300) ?? null;
  }

  /**
   * Extrai valor numérico do campo "SALDO ATUAL DE GERAÇÃO:" (kWh).
   */
  private extractCurrentGenerationBalance(text: string): number | null {
    const m = text.match(/SALDO\s+ATUAL\s+DE\s+GERA[CÇ][AÃ]O\s*:\s*([\d.,]+)/i);
    if (!m?.[1]) return null;
    const raw = m[1].replace(/\./g, '').replace(',', '.');
    const value = Number.parseFloat(raw);
    return Number.isNaN(value) ? null : value;
  }

  private extractItems(text: string): ParsedInvoiceItem[] {
    if (!text.trim()) return [];
    const blocks = text.split(
      /(?=ENERGIA|Contrib|Ilumina|SCEE|Compensada|OUTROS)/i,
    );

    const items = blocks
      .map((block) => this.buildItemFromBlock(block))
      .filter(Boolean) as ParsedInvoiceItem[];

    return items;
  }

  private buildItemFromBlock(block: string): ParsedInvoiceItem | null {
    const description = this.extractDescription(block);
    if (!description) return null;
    const d = description.trim().toUpperCase();
    if (d === 'TOTAL' || d.startsWith('TOTAL ') || d === 'VALORES FATURADOS')
      return null;

    const type = this.mapDescriptionToType(description);
    const amount = this.extractLastAmount(block);
    const consumptionKwh = this.extractKwh(block);
    const { unitPrice, icmsBase, icmsRate } = this.extractItemNumbers(block);

    return {
      type,
      description: description.slice(0, 255),
      quantity: consumptionKwh ?? null,
      unitPrice,
      amount,
      icmsBase,
      icmsRate,
      consumptionKwh,
    };
  }

  /**
   * Extrai Preço Unit, Base Calc. ICMS e ICMS (alíquota) da linha da tabela Valores Faturados.
   * Ordem típica: Quant. Preço Unit Valor (R$) [PIS/COFINS] Base ICMS Aliq. ICMS
   */
  private extractItemNumbers(block: string): {
    unitPrice: number | null;
    icmsBase: number | null;
    icmsRate: number | null;
  } {
    const amount = this.extractLastAmount(block);
    const currencyLike = block.match(/(-?\d+,\d+)/g);
    if (!currencyLike || currencyLike.length < 2) {
      return { unitPrice: null, icmsBase: null, icmsRate: null };
    }
    const parsed = currencyLike.map((s) => this.parseDecimal(s));
    const amountIdx = parsed.findIndex((n) => Math.abs(n - amount) < 0.02);
    if (amountIdx <= 0) {
      return {
        unitPrice: parsed[0] ?? null,
        icmsBase: null,
        icmsRate: null,
      };
    }
    const unitPrice = parsed[amountIdx - 1] ?? null;
    const icmsBase =
      amountIdx + 1 < parsed.length ? parsed[amountIdx + 1] : null;
    const icmsRate =
      amountIdx + 2 < parsed.length ? parsed[amountIdx + 2] : null;
    return {
      unitPrice: unitPrice >= 0 ? unitPrice : null,
      icmsBase: icmsBase != null && icmsBase >= 0 ? icmsBase : null,
      icmsRate:
        icmsRate != null && icmsRate >= 0 && icmsRate <= 1 ? icmsRate : null,
    };
  }

  private extractDescription(block: string): string {
    const match = block.match(/^([^\d\n]+)/);
    return match?.[1]?.trim() ?? block.slice(0, 80).trim();
  }

  private extractLastAmount(block: string): number {
    const r$Matches = [...block.matchAll(/R\$\s*([\d.,\s]+)/g)];
    if (r$Matches.length > 0) {
      const last = r$Matches[r$Matches.length - 1][1];
      return this.parseBrl(last);
    }
    const currencyLike = block.match(/(-?\d+,\d{2})(?=\s|$)/g);
    if (currencyLike?.length) {
      const last = currencyLike[currencyLike.length - 1];
      return this.parseDecimal(last);
    }
    return 0;
  }

  private extractKwh(block: string): number | undefined {
    const patterns = [/kWh\s+(\d+(?:[.,]\d+)?)/i, /(\d+(?:[.,]\d+)?)\s*kWh/i];
    for (const re of patterns) {
      const match = block.match(re);
      if (match?.[1]) return this.parseDecimal(match[1]);
    }
    return undefined;
  }

  private readonly descriptionMap: Record<InvoiceItemType, string[]> = {
    ENERGIA_ELETRICA: ['ENERGIA ELÉTRICA', 'ENERGIA ELETRICA'],
    ENERGIA_SCEE: ['ENERGIA SCEE', 'SCEE'],
    ENERGIA_COMPENSADA_GD: ['ENERGIA COMPENSADA', 'GD'],
    CONTRIB_ILUM_PUBLICA: ['ILUMINAÇÃO', 'ILUMINACAO', 'CONTRIB'],
    OUTROS: [],
  };

  private mapDescriptionToType(description: string): InvoiceItemType {
    const normalized = description.toUpperCase();

    for (const [type, keywords] of Object.entries(this.descriptionMap)) {
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        return type as InvoiceItemType;
      }
    }

    return 'OUTROS';
  }
}
