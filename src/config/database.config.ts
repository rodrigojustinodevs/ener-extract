import { registerAs } from '@nestjs/config';

export type DatabaseConfig = {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export default registerAs('database', (): DatabaseConfig => {
  const url =
    process.env.DATABASE_URL ??
    `mysql://${process.env.MYSQL_USER ?? 'app'}:${process.env.MYSQL_PASSWORD ?? 'app'}@${process.env.MYSQL_HOST ?? 'localhost'}:${process.env.MYSQL_PORT ?? '3309'}/${process.env.MYSQL_DATABASE ?? 'ener_extract'}`;

  return {
    url,
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: parseInt(process.env.MYSQL_PORT ?? '3309', 10),
    username: process.env.MYSQL_USER ?? 'app',
    password: process.env.MYSQL_PASSWORD ?? 'app',
    database: process.env.MYSQL_DATABASE ?? 'ener_extract',
  };
});
