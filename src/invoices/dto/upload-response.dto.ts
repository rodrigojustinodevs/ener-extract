import { ApiProperty } from '@nestjs/swagger';

class InvoiceItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({
    enum: [
      'ENERGIA_ELETRICA',
      'ENERGIA_SCEE',
      'ENERGIA_COMPENSADA_GD',
      'CONTRIB_ILUM_PUBLICA',
      'OUTROS',
    ],
  })
  type!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  quantity!: number | null;

  @ApiProperty({ nullable: true })
  unitPrice!: number | null;

  @ApiProperty()
  amount!: number;
}

export class InvoiceUploadDataDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  installationId!: number;

  @ApiProperty({ example: 'JUL/2024' })
  referenceMonth!: string;

  @ApiProperty()
  dueDate!: Date;

  @ApiProperty({ example: 123.45 })
  totalAmount!: number;

  @ApiProperty({ nullable: true })
  pdfPath!: string | null;

  @ApiProperty({ type: [InvoiceItemDto] })
  items!: InvoiceItemDto[];
}

export class UploadResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: InvoiceUploadDataDto })
  data!: InvoiceUploadDataDto;
}
