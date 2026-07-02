import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    validatePassword: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      validatePassword: jest.fn(),
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
    expect(usersService.validatePassword).toHaveBeenCalledWith(
      'secret',
      'hashed-password',
    );
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
});
