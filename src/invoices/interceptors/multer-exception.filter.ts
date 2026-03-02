import {
  type ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(Error)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      throw exception;
    }
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const message = exception.message ?? '';

    const isMulterOrFileError =
      message.includes('PDF') ||
      message.includes('file size') ||
      message.includes('File too large') ||
      message.includes('Unexpected field') ||
      (exception as Error & { code?: string }).code === 'LIMIT_FILE_SIZE';

    if (isMulterOrFileError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: message || 'Arquivo inválido (apenas PDF, máx. 10MB).',
      });
      return;
    }
    throw exception;
  }
}
