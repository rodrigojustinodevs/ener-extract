import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvoiceConfig } from '../../config/invoice.config.js';
import type { IInvoiceExtractor } from './invoice-extractor.interface.js';
import { LlmExtractorService } from './llm-extractor.service.js';
import { PdfExtractorService } from './pdf-extractor.service.js';

@Injectable()
export class ExtractorFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly llmExtractor: LlmExtractorService,
  ) {}

  getExtractor(): IInvoiceExtractor {
    const config = this.configService.get<InvoiceConfig>('invoice');
    const mode = config?.extractorMode ?? 'pdf';
    return mode === 'llm' ? this.llmExtractor : this.pdfExtractor;
  }
}
