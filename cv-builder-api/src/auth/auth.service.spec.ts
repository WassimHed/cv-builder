import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    validatePassword: jest.Mock;
    isLocked: jest.Mock;
    registerFailedAttempt: jest.Mock;
    resetFailedAttempts: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      validatePassword: jest.fn(),
      isLocked: jest.fn().mockReturnValue(false),
      registerFailedAttempt: jest.fn(),
      resetFailedAttempts: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('token-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs in with valid credentials', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    usersService.validatePassword.mockResolvedValue(true);

    const result = await service.login({
      email: 'jane@example.com',
      password: 'secret',
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(usersService.isLocked).toHaveBeenCalled();
    expect(usersService.validatePassword).toHaveBeenCalledWith(
      'secret',
      'hashed-password',
    );
    expect(usersService.resetFailedAttempts).toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
    });
    expect(result).toEqual({
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });
  });

  it('rejects login for a locked account without checking the password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    usersService.isLocked.mockReturnValue(true);

    await expect(
      service.login({ email: 'jane@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.validatePassword).not.toHaveBeenCalled();
  });

  it('registers a failed attempt on invalid password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    usersService.validatePassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'jane@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.registerFailedAttempt).toHaveBeenCalled();
    expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
  });
});
