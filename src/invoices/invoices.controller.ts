import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadResponseDto } from './dto/upload-response.dto';
import { MulterExceptionFilter } from './interceptors/multer-exception.filter';
import { multerConfig } from './interceptors/multer.config';
import type { InvoiceUploadResult } from './invoices.service';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Upload e processamento de fatura em PDF (extrator LLM ou PDF conforme INVOICE_EXTRACTOR_MODE)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF da fatura.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Fatura processada e persistida',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Arquivo inválido ou dados obrigatórios ausentes',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Instalação não encontrada ou sem permissão',
  })
  @ApiResponse({
    status: 409,
    description: 'Fatura duplicada (mesmo mês/instalação)',
  })
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: true; data: InvoiceUploadResult }> {
    if (!file?.path) {
      throw new BadRequestException('Arquivo PDF é obrigatório');
    }
    const data = await this.invoicesService.processUpload(
      file,
      user.userId,
    );
    return { success: true, data };
  }
}
