import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CemigExtractorService } from './services/cemig-extractor.service';
import { PdfParserService } from './services/pdf-parser.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ExtractorFactory } from './extractors/extractor.factory';
import { PdfExtractorService } from './extractors/pdf-extractor.service';
import { LlmExtractorService } from './extractors/llm-extractor.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    PdfParserService,
    CemigExtractorService,
    PdfExtractorService,
    LlmExtractorService,
    ExtractorFactory,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
