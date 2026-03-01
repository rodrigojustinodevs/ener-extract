import { registerAs } from '@nestjs/config';

export type AuthConfig = {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
};

export default registerAs('auth', (): AuthConfig => {
  const jwtAccessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret';
  const jwtRefreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret';
  const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '1h';
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

  return {
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresIn,
    jwtRefreshExpiresIn,
  };
});
