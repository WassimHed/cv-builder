import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
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

  it('forwards login requests to the service', async () => {
    await controller.login({
      email: 'jane@example.com',
      password: 'secret',
    });

    expect(authService.login).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'secret',
    });
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
