import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockTokensResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: { id: 1, name: 'Test', email: 'test@email.com' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<jest.Mocked<AuthService>>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('deve chamar authService.register e retornar o resultado', async () => {
      authService.register.mockResolvedValue(mockTokensResponse);

      const dto = {
        name: 'Test',
        email: 'test@email.com',
        password: 'senha123',
      };
      const result = await controller.register(dto);

      expect(authService.register.mock.calls).toEqual([[dto]]);
      expect(result).toEqual(mockTokensResponse);
    });
  });

  describe('login', () => {
    it('deve chamar authService.login e retornar o resultado', async () => {
      authService.login.mockResolvedValue(mockTokensResponse);

      const dto = { email: 'test@email.com', password: 'senha123' };
      const result = await controller.login(dto);

      expect(authService.login.mock.calls).toEqual([[dto]]);
      expect(result).toEqual(mockTokensResponse);
    });
  });

  describe('refresh', () => {
    it('deve chamar authService.refresh com user e refreshToken do body', async () => {
      authService.refresh.mockResolvedValue(mockTokensResponse);

      const user = { userId: 1, email: 'test@email.com' };
      const dto = { refreshToken: 'my-refresh-token' };
      const result = await controller.refresh(user, dto);

      expect(authService.refresh.mock.calls).toEqual([
        [user, dto.refreshToken],
      ]);
      expect(result).toEqual(mockTokensResponse);
    });
  });

  describe('logout', () => {
    it('deve chamar authService.logout com userId do usuário autenticado', async () => {
      authService.logout.mockResolvedValue(undefined);

      const user = { userId: 1, email: 'test@email.com' };
      await controller.logout(user);

      expect(authService.logout.mock.calls).toEqual([[1]]);
    });
  });
});
