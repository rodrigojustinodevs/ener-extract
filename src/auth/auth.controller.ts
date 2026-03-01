import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthService,
  type AuthUserResponse,
  type TokensResponse,
} from './auth.service';
import {
  AuthUserResponseDto,
  TokensResponseDto,
} from './dto/auth-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado e tokens retornados',
    type: TokensResponseDto,
  })
  @ApiResponse({ status: 409, description: 'E-mail já em uso' })
  async register(@Body() dto: RegisterDto): Promise<TokensResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  @ApiResponse({
    status: 200,
    description: 'Tokens e dados do usuário',
    type: TokensResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() dto: LoginDto): Promise<TokensResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access e refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Novo par de tokens',
    type: TokensResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RefreshTokenDto,
  ): Promise<TokensResponse> {
    return this.authService.refresh(user, dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (invalida refresh token)' })
  @ApiResponse({ status: 204, description: 'Logout realizado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async logout(@CurrentUser() user: CurrentUserPayload): Promise<void> {
    await this.authService.logout(user.userId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário',
    type: AuthUserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async profile(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AuthUserResponse> {
    return this.authService.getProfile(user.userId);
  }
}
