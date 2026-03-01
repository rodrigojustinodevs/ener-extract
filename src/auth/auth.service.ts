import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthConfig } from '../config/auth.config.js';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { CurrentUserPayload } from './decorators/current-user.decorator';

const SALT_ROUNDS = 10;

export type AuthUserResponse = {
  id: number;
  name: string;
  email: string;
};

export type TokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get authConfig(): AuthConfig {
    const config = this.configService.get<AuthConfig>('auth');
    if (!config) {
      throw new HttpException(
        'Configuração de autenticação não encontrada',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return config;
  }

  private toUserResponse(user: {
    id: number;
    name: string;
    email: string;
  }): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  private async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, SALT_ROUNDS);
  }

  private async compareRefreshToken(
    plain: string,
    hashed: string | null,
  ): Promise<boolean> {
    if (!hashed) return false;
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Valida e-mail e senha para a LocalStrategy (Passport).
   * Retorna o usuário ou null se credenciais inválidas.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUserResponse | null> {
    type LoginUser = {
      id: number;
      name: string;
      email: string;
      passwordHash: string;
    };
    type UserDelegate = {
      findUnique: (args: {
        where: { email: string };
        select: {
          id: true;
          name: true;
          email: true;
          passwordHash: true;
        };
      }) => Promise<LoginUser | null>;
    };
    const db = this.prisma as unknown as { user: UserDelegate };
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return this.toUserResponse(user);
  }

  private generateTokens(user: { id: number; name: string; email: string }): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload = { sub: user.id, email: user.email };
    const { jwtAccessSecret, jwtRefreshSecret } = this.authConfig;
    const accessExpiresInSeconds = 15 * 60; // 15m
    const refreshExpiresInSeconds = 7 * 24 * 60 * 60; // 7d

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtAccessSecret,
      expiresIn: accessExpiresInSeconds,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: jwtRefreshSecret,
      expiresIn: refreshExpiresInSeconds,
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<TokensResponse> {
    type UserByEmail = { id: number; email: string } | null;
    type CreateUserResult = { id: number; name: string; email: string };
    type UserDelegate = {
      findUnique: (args: { where: { email: string } }) => Promise<UserByEmail>;
      create: (args: {
        data: {
          name: string;
          email: string;
          passwordHash: string;
          refreshToken: string;
        };
        select: { id: true; name: true; email: true };
      }) => Promise<CreateUserResult>;
    };
    const db = this.prisma as unknown as { user: UserDelegate };
    const existing = await db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Este e-mail já está em uso');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { accessToken, refreshToken } = this.generateTokens({
      id: 0,
      name: dto.name,
      email: dto.email.toLowerCase(),
    });
    const hashedRefresh = await this.hashRefreshToken(refreshToken);

    const createData: {
      name: string;
      email: string;
      passwordHash: string;
      refreshToken: string;
    } = {
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      refreshToken: hashedRefresh,
    };
    const user = await db.user.create({
      data: createData,
      select: { id: true, name: true, email: true },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
    };
  }

  async login(dto: LoginDto): Promise<TokensResponse> {
    type LoginUser = {
      id: number;
      name: string;
      email: string;
      passwordHash: string;
    };
    type LoginUserDelegate = {
      findUnique: (args: {
        where: { email: string };
        select: {
          id: true;
          name: true;
          email: true;
          passwordHash: true;
        };
      }) => Promise<LoginUser | null>;
      update: (args: {
        where: { id: number };
        data: { refreshToken: string };
      }) => Promise<unknown>;
    };
    const db = this.prisma as unknown as { user: LoginUserDelegate };
    const user = await db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { accessToken, refreshToken } = this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    const hashedRefresh = await this.hashRefreshToken(refreshToken);

    await db.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
    };
  }

  async refresh(
    userPayload: CurrentUserPayload,
    refreshTokenPlain: string,
  ): Promise<TokensResponse> {
    type RefreshUser = {
      id: number;
      name: string;
      email: string;
      refreshToken: string | null;
    };
    type RefreshUserDelegate = {
      findUnique: (args: {
        where: { id: number };
        select: {
          id: true;
          name: true;
          email: true;
          refreshToken: true;
        };
      }) => Promise<RefreshUser | null>;
      update: (args: {
        where: { id: number };
        data: { refreshToken: string };
      }) => Promise<unknown>;
    };
    const db = this.prisma as unknown as { user: RefreshUserDelegate };
    const user = await db.user.findUnique({
      where: { id: userPayload.userId },
      select: { id: true, name: true, email: true, refreshToken: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const isRefreshValid = await this.compareRefreshToken(
      refreshTokenPlain,
      user.refreshToken,
    );
    if (!isRefreshValid) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const { accessToken, refreshToken } = this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    const hashedRefresh = await this.hashRefreshToken(refreshToken);

    await db.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
    };
  }

  async logout(userId: number): Promise<void> {
    type LogoutUserDelegate = {
      update: (args: {
        where: { id: number };
        data: { refreshToken: null };
      }) => Promise<unknown>;
    };
    const db = this.prisma as unknown as { user: LogoutUserDelegate };
    await db.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async getProfile(userId: number): Promise<AuthUserResponse> {
    type ProfileUserDelegate = {
      findUnique: (args: {
        where: { id: number };
        select: { id: true; name: true; email: true };
      }) => Promise<{ id: number; name: string; email: string } | null>;
    };
    const db = this.prisma as unknown as { user: ProfileUserDelegate };
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return this.toUserResponse(user);
  }
}
