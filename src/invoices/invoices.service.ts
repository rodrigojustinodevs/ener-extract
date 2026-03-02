import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CemigExtractorService } from './services/cemig-extractor.service';
import type {
  ParsedInvoice,
  ParsedInvoiceItem,
} from './services/cemig-extractor.types';
import { PdfParserService } from './services/pdf-parser.service';
import type {
  ConsumerClass,
  InvoiceItemType,
} from '../../generated/prisma/enums.js';

export interface InvoiceUploadResult {
  id: number;
  installationId: number;
  referenceMonth: string;
  dueDate: Date;
  totalAmount: number;
  pdfPath: string | null;
  items: Array<{
    id: number;
    type: InvoiceItemType;
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number;
  }>;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfParser: PdfParserService,
    private readonly cemigExtractor: CemigExtractorService,
  ) {}

  async uploadAndProcess(
    filePath: string,
    userId: number,
  ): Promise<InvoiceUploadResult> {
    const parsed = await this.parseInvoice(filePath);

    this.validateParsedInvoice(parsed);

    const installation = await this.getOrCreateInstallation(parsed, userId);
    const installationId = installation.id;

    await this.ensureNoDuplicate(installationId, parsed.referenceMonth);

    const invoice = await this.persist(installationId, parsed, filePath);

    return this.mapToUploadResult(invoice);
  }

  /**
   * Busca instalação por Nº DA INSTALAÇÃO e usuário; se não existir, cria.
   */
  private async getOrCreateInstallation(
    parsed: ParsedInvoice,
    userId: number,
  ): Promise<{ id: number }> {
    const existing = await this.prisma.installation.findFirst({
      where: {
        installationNumber: parsed.installationNumber,
        userId,
      },
    });
    if (existing) return { id: existing.id };

    const rawClient = String(parsed.clientNumber ?? '').trim();
    const clientNumber =
      rawClient !== '' ? rawClient : parsed.installationNumber;

    const address: string | undefined =
      parsed.address != null ? String(parsed.address) : undefined;
    const consumerClass: ConsumerClass | undefined =
      parsed.consumerClass ?? undefined;
    const tariffModality: string | undefined =
      parsed.tariffModality != null ? String(parsed.tariffModality) : undefined;

    const created = await this.prisma.installation.create({
      data: {
        userId,
        installationNumber: parsed.installationNumber,
        clientNumber,
        address,
        consumerClass,
        tariffModality,
      },
    });
    return { id: created.id };
  }

  private async parseInvoice(filePath: string): Promise<ParsedInvoice> {
    const text = await this.pdfParser.parse(filePath);
    return this.cemigExtractor.extract(text);
  }

  private validateParsedInvoice(parsed: ParsedInvoice): void {
    this.assertRequired(parsed.installationNumber, 'installationNumber');
    this.assertRequired(parsed.referenceMonth, 'referenceMonth');
    this.assertValidDate(parsed.dueDate, 'dueDate');
    this.assertValidNumber(parsed.totalAmount, 'totalAmount');
  }

  private assertRequired(value: unknown, field: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} é obrigatório`);
    }
  }

  private assertValidDate(value: unknown, field: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      const message =
        field === 'dueDate'
          ? 'data de vencimento inválida: não foi possível extrair data de vencimento do PDF (esperado: DD/MM/AAAA, ex.: Vencimento 15/08/2024)'
          : `${field} inválido`;
      throw new BadRequestException(message);
    }
  }

  private assertValidNumber(value: unknown, field: string): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new BadRequestException(`${field} inválido`);
    }
  }

  private async ensureNoDuplicate(
    installationId: number,
    referenceMonth: string,
  ): Promise<void> {
    const existing = await this.prisma.invoice.findUnique({
      where: {
        installationId_referenceMonth: {
          installationId,
          referenceMonth,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe fatura para esta instalação no mês ${referenceMonth}`,
      );
    }
  }

  private async persist(
    installationId: number,
    parsed: ParsedInvoice,
    pdfPath: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const emissionDate: Date | undefined =
        parsed.emissionDate != null &&
        !Number.isNaN(parsed.emissionDate.getTime())
          ? parsed.emissionDate
          : undefined;
      const publicLighting: number | undefined =
        parsed.publicLighting ?? undefined;
      const invoiceNumber: string | undefined =
        parsed.invoiceNumber != null ? String(parsed.invoiceNumber) : undefined;
      const barcode: string | undefined =
        parsed.barcode != null
          ? String(parsed.barcode).trim().slice(0, 300)
          : undefined;
      const rawBalance = parsed.currentGenerationBalance as number | null;
      const currentGenerationBalance: number | undefined =
        typeof rawBalance === 'number' && !Number.isNaN(rawBalance)
          ? rawBalance
          : undefined;

      const invoice = await tx.invoice.create({
        data: {
          installationId,
          referenceMonth: parsed.referenceMonth,
          dueDate: parsed.dueDate,
          emissionDate,
          totalAmount: parsed.totalAmount,
          publicLighting,
          invoiceNumber,
          barcode,
          currentGenerationBalance,
          pdfPath,
          items: {
            createMany: {
              data: parsed.items
                .filter((item) => this.shouldPersistItem(item))
                .map((item) => this.mapItemForPersistence(item)),
            },
          },
        },
        include: { items: true },
      });

      await this.persistConsumptionIfPresent(tx, invoice.id, parsed);

      return invoice;
    });
  }

  /**
   * Não insere sub-item quando quantity, unitPrice ou amount forem vazios/null.
   * Insere apenas itens com amount válido (não null, não NaN).
   */
  private shouldPersistItem(item: ParsedInvoiceItem): boolean {
    const { quantity, unitPrice, amount } = item;
    if (amount == null || Number.isNaN(amount)) return false;
    if (quantity == null && unitPrice == null && amount === 0) return false;
    return true;
  }

  private mapItemForPersistence(item: ParsedInvoiceItem) {
    const quantity: number | undefined = item.quantity ?? undefined;
    const unitPrice: number | undefined = item.unitPrice ?? undefined;
    const icmsBase: number | undefined = item.icmsBase ?? undefined;
    const icmsRate: number | undefined = item.icmsRate ?? undefined;
    return {
      type: item.type,
      description: item.description,
      quantity,
      unitPrice,
      amount: item.amount,
      icmsBase,
      icmsRate,
    };
  }

  private async persistConsumptionIfPresent(
    tx: Pick<PrismaService, 'consumptionHistory'>,
    invoiceId: number,
    parsed: ParsedInvoice,
  ): Promise<void> {
    const consumption = parsed.items.find(
      (i) => i.consumptionKwh != null && i.consumptionKwh > 0,
    )?.consumptionKwh;

    if (!consumption) return;

    await tx.consumptionHistory.create({
      data: {
        invoiceId,
        referenceMonth: parsed.referenceMonth,
        consumptionKwh: consumption,
      },
    });
  }

  private mapToUploadResult(invoice: {
    id: number;
    installationId: number;
    referenceMonth: string;
    dueDate: Date;
    totalAmount: unknown;
    pdfPath: string | null;
    items: Array<{
      id: number;
      type: InvoiceItemType;
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      amount: unknown;
    }>;
  }): InvoiceUploadResult {
    return {
      id: invoice.id,
      installationId: invoice.installationId,
      referenceMonth: invoice.referenceMonth,
      dueDate: invoice.dueDate,
      totalAmount: this.safeNumber(invoice.totalAmount),
      pdfPath: invoice.pdfPath,
      items: invoice.items.map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        quantity: item.quantity != null ? this.safeNumber(item.quantity) : null,
        unitPrice:
          item.unitPrice != null ? this.safeNumber(item.unitPrice) : null,
        amount: this.safeNumber(item.amount),
      })),
    };
  }

  private safeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
