import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CemigExtractorService } from './services/cemig-extractor.service';
import { PdfParserService } from './services/pdf-parser.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfParserService, CemigExtractorService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
