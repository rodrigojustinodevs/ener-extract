import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

type PrismaUserMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
type PrismaServiceMock = { user: PrismaUserMock };

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaServiceMock;
  let jwtService: jest.Mocked<JwtService>;

  const authConfig = {
    jwtAccessSecret: 'access-secret',
    jwtRefreshSecret: 'refresh-secret',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@email.com',
    passwordHash: 'hashed',
    refreshToken: 'hashed-refresh',
  };

  beforeEach(async () => {
    const prismaMock: PrismaServiceMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- provider token and mock value
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'auth' ? authConfig : null)),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = prismaMock;
    jwtService = module.get<jest.Mocked<JwtService>>(JwtService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('deve lançar ConflictException quando o e-mail já existe', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@email.com',
          password: 'senha123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('deve criar usuário e retornar tokens quando o e-mail não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null as never);
      (bcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('hashed-password')
        .mockResolvedValueOnce('hashed-refresh');
      prisma.user.create.mockResolvedValue({
        id: 1,
        name: 'Test',
        email: 'test@email.com',
      } as never);

      const result = await service.register({
        name: 'Test',
        email: 'test@email.com',
        password: 'senha123',
      });

      expect(result.user).toEqual({
        id: 1,
        name: 'Test',
        email: 'test@email.com',
      });
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      const expectedCreateData: Record<string, unknown> = {
        name: 'Test',
        email: 'test@email.com',
        passwordHash: 'hashed-password',
        refreshToken: 'hashed-refresh',
      };
      const createCalls = prisma.user.create.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >;
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0]?.[0]).toMatchObject({
        data: expectedCreateData,
      });
    });
  });

  describe('login', () => {
    it('deve lançar UnauthorizedException quando o usuário não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null as never);

      await expect(
        service.login({
          email: 'test@email.com',
          password: 'senha123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando a senha está incorreta', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@email.com',
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve retornar tokens quando as credenciais são válidas', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');
      prisma.user.update.mockResolvedValue(mockUser as never);

      const result = await service.login({
        email: 'test@email.com',
        password: 'senha123',
      });

      expect(result.user.email).toBe('test@email.com');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(jwtService.sign.mock.calls).toEqual(
        expect.arrayContaining([
          [{ sub: 1, email: 'test@email.com' }, expect.any(Object)],
        ]),
      );
    });
  });

  describe('refresh', () => {
    it('deve lançar UnauthorizedException quando o usuário não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null as never);

      await expect(
        service.refresh(
          { userId: 1, email: 'test@email.com' },
          'some-refresh-token',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException quando o refresh token não confere', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refresh(
          { userId: 1, email: 'test@email.com' },
          'wrong-refresh-token',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve retornar novo par de tokens quando o refresh token é válido', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh');
      prisma.user.update.mockResolvedValue(mockUser as never);

      const result = await service.refresh(
        { userId: 1, email: 'test@email.com' },
        'valid-refresh-token',
      );

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { refreshToken: 'new-hashed-refresh' },
      });
    });
  });

  describe('logout', () => {
    it('deve limpar o refreshToken do usuário no banco', async () => {
      prisma.user.update.mockResolvedValue(mockUser as never);

      await service.logout(1);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { refreshToken: null },
      });
    });
  });
});
