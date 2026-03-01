import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do usuário' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha123', description: 'Senha do usuário' })
  @IsString()
  password!: string;
}
