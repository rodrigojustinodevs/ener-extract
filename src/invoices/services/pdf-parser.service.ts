import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfParserService {
  /**
   * Extrai o texto bruto completo do PDF.
   * @param filePath Caminho absoluto ou relativo ao arquivo PDF
   */
  async parse(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
}
