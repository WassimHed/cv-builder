import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
    changePassword: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      changePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards register requests to the service', async () => {
    await controller.register({
      email: 'jane@example.com',
      password: 'secret',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(authService.register).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'secret',
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('forwards login requests to the service along with request context', async () => {
    const fakeReq = {
      headers: { 'user-agent': 'jest-test-agent' },
      ip: '127.0.0.1',
    } as any;

    await controller.login(
      {
        email: 'jane@example.com',
        password: 'secret',
      },
      fakeReq,
    );

    expect(authService.login).toHaveBeenCalledWith(
      {
        email: 'jane@example.com',
        password: 'secret',
      },
      { userAgent: 'jest-test-agent', ipAddress: '127.0.0.1' },
    );
  });

  it('builds an empty request context when req has no headers/ip (defensive default)', async () => {
    await controller.login(
      { email: 'jane@example.com', password: 'secret' },
      {} as any,
    );

    expect(authService.login).toHaveBeenCalledWith(
      { email: 'jane@example.com', password: 'secret' },
      { userAgent: undefined, ipAddress: undefined },
    );
  });

  it('forwards refresh requests to the service along with request context', async () => {
    const fakeReq = {
      headers: { 'user-agent': 'jest-test-agent' },
      ip: '127.0.0.1',
    } as any;

    await controller.refresh({ refreshToken: 'raw-refresh-token' }, fakeReq);

    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: 'raw-refresh-token' },
      { userAgent: 'jest-test-agent', ipAddress: '127.0.0.1' },
    );
  });

  it('forwards logout requests to the service', async () => {
    await controller.logout({ refreshToken: 'raw-refresh-token' });

    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: 'raw-refresh-token',
    });
  });

  it('forwards logout-all requests to the service using the current user id', async () => {
    await controller.logoutAll({
      userId: 'user-1',
      email: 'jane@example.com',
    });

    expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
  });

  it('forwards forgot-password requests to the service', async () => {
    await controller.forgotPassword({ email: 'jane@example.com' });

    expect(authService.forgotPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
    });
  });

  it('forwards reset-password requests to the service', async () => {
    await controller.resetPassword({
      token: 'some-token',
      newPassword: 'NewPass123!',
    });

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'some-token',
      newPassword: 'NewPass123!',
    });
  });

  it('forwards verify-email requests to the service', async () => {
    await controller.verifyEmail({ token: 'some-token' });

    expect(authService.verifyEmail).toHaveBeenCalledWith({
      token: 'some-token',
    });
  });

  it('forwards resend-verification requests to the service', async () => {
    await controller.resendVerification({ email: 'jane@example.com' });

    expect(authService.resendVerification).toHaveBeenCalledWith({
      email: 'jane@example.com',
    });
  });

  it('forwards change-password requests to the service', async () => {
    await controller.changePassword(
      { userId: 'user-1', email: 'jane@example.com' },
      { currentPassword: 'old-password', newPassword: 'NewPass123!' },
    );

    expect(authService.changePassword).toHaveBeenCalledWith('user-1', {
      currentPassword: 'old-password',
      newPassword: 'NewPass123!',
    });
  });
});
