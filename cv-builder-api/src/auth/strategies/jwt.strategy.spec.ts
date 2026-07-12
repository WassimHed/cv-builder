import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('throws when the user no longer exists', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'user-1', email: 'jane@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns the user payload when passwordChangedAt is null', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      passwordChangedAt: null,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'jane@example.com',
      iat: Math.floor(Date.now() / 1000),
    });

    expect(result).toEqual({ userId: 'user-1', email: 'jane@example.com' });
  });

  it('rejects a token issued before the last password change', async () => {
    const passwordChangedAt = new Date();
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      passwordChangedAt,
    });

    const tokenIssuedBefore = Math.floor(
      (passwordChangedAt.getTime() - 60_000) / 1000,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'jane@example.com',
        iat: tokenIssuedBefore,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a token issued after the last password change', async () => {
    const passwordChangedAt = new Date(Date.now() - 60_000);
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      passwordChangedAt,
    });

    const tokenIssuedAfter = Math.floor(Date.now() / 1000);

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'jane@example.com',
      iat: tokenIssuedAfter,
    });

    expect(result).toEqual({ userId: 'user-1', email: 'jane@example.com' });
  });
});
