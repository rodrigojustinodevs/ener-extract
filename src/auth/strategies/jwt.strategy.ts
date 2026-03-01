import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthConfig } from '../../config/auth.config';

export type JwtPayload = {
  sub: number;
  email: string;
};

export type JwtValidateResult = {
  userId: number;
  email: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const authConfig = configService.get<AuthConfig>('auth');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig?.jwtAccessSecret ?? '',
    });
  }

  validate(payload: JwtPayload): JwtValidateResult {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
