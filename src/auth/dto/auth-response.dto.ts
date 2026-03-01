import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'João Silva' })
  name!: string;

  @ApiProperty({ example: 'joao@email.com' })
  email!: string;
}

export class TokensResponseDto {
  @ApiProperty({ description: 'JWT de acesso (Bearer)' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT para renovar o access token' })
  refreshToken!: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
