import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token JWT para obter novo par de tokens',
  })
  @IsString()
  @IsNotEmpty({ message: 'O refreshToken não pode ser vazio' })
  refreshToken!: string;
}
