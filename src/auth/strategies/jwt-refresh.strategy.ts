import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthConfig } from '../../config/auth.config.js';

export type JwtRefreshPayload = {
  sub: number;
  email: string;
};

export type JwtRefreshValidateResult = {
  userId: number;
  email: string;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const authConfig = configService.get<AuthConfig>('auth');
    super({
      jwtFromRequest: (req: Request): string | null => {
        const token = (req.body as { refreshToken?: string })?.refreshToken;
        return token ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: authConfig?.jwtRefreshSecret ?? '',
      passReqToCallback: true,
    });
  }

  validate(
    _req: Request,
    payload: JwtRefreshPayload,
  ): JwtRefreshValidateResult {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
