import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { MailTemplate } from '../mail/dto/send-email-job.dto';
import { RefreshTokensService } from './refresh-tokens.service';
import { CvService } from '../cv/cv.service';
import { LettersService } from '../letters/letters.service';
import { AvatarsService } from '../users/avatars.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    validatePassword: jest.Mock;
    isLocked: jest.Mock;
    registerFailedAttempt: jest.Mock;
    resetFailedAttempts: jest.Mock;
    generateResetToken: jest.Mock;
    findByResetToken: jest.Mock;
    resetPassword: jest.Mock;
    generateEmailVerificationToken: jest.Mock;
    findByEmailVerificationToken: jest.Mock;
    markEmailAsVerified: jest.Mock;
    changePassword: jest.Mock;
    delete: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };
  let mailService: {
    queueEmail: jest.Mock;
  };
  let configService: {
    getOrThrow: jest.Mock;
  };
  let refreshTokensService: {
    issueToken: jest.Mock;
    rotateToken: jest.Mock;
    revokeToken: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAllForUser: jest.Mock;
    findFamilyIdForToken: jest.Mock;
    listForUser: jest.Mock;
    revokeFamilyForUser: jest.Mock;
    deleteAllForUser: jest.Mock;
  };
  let cvService: {
    removeAllByUser: jest.Mock;
  };
  let lettersService: {
    removeAllByUser: jest.Mock;
  };
  let avatarsService: {
    deleteAvatarIfExists: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      validatePassword: jest.fn(),
      isLocked: jest.fn().mockReturnValue(false),
      registerFailedAttempt: jest.fn(),
      resetFailedAttempts: jest.fn(),
      generateResetToken: jest.fn(),
      findByResetToken: jest.fn(),
      resetPassword: jest.fn(),
      generateEmailVerificationToken: jest.fn(),
      findByEmailVerificationToken: jest.fn(),
      markEmailAsVerified: jest.fn(),
      changePassword: jest.fn(),
      delete: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('token-1'),
    };

    mailService = {
      queueEmail: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:4200'),
    };

    refreshTokensService = {
      issueToken: jest.fn().mockResolvedValue({
        rawToken: 'refresh-token-1',
        record: { id: 'rt-1', familyId: 'family-1' },
      }),
      rotateToken: jest.fn(),
      revokeToken: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
      findFamilyIdForToken: jest.fn(),
      listForUser: jest.fn(),
      revokeFamilyForUser: jest.fn(),
      deleteAllForUser: jest.fn(),
    };

    cvService = {
      removeAllByUser: jest.fn(),
    };

    lettersService = {
      removeAllByUser: jest.fn(),
    };

    avatarsService = {
      deleteAvatarIfExists: jest.fn(),
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
        {
          provide: MailService,
          useValue: mailService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: RefreshTokensService,
          useValue: refreshTokensService,
        },
        {
          provide: CvService,
          useValue: cvService,
        },
        {
          provide: LettersService,
          useValue: lettersService,
        },
        {
          provide: AvatarsService,
          useValue: avatarsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCurrentUser', () => {
    it('throws when the user cannot be found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the real DB user, excluding sensitive fields', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed-password',
        firstName: 'Jane',
        lastName: 'Doe',
        isEmailVerified: true,
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isEmailVerified: true,
        createdAt: new Date('2026-01-01'),
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('register', () => {
    it('creates the user, sends a verification email, and returns a generic message', async () => {
      const user = {
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      };
      usersService.create.mockResolvedValue(user);
      usersService.generateEmailVerificationToken.mockResolvedValue(
        'raw-verify-token',
      );

      const result = await service.register({
        email: 'jane@example.com',
        password: 'secret',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(usersService.generateEmailVerificationToken).toHaveBeenCalledWith(
        user,
      );
      expect(mailService.queueEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Verify your email',
        template: MailTemplate.EMAIL_VERIFICATION,
        context: {
          firstName: 'Jane',
          verifyUrl:
            'http://localhost:4200/verify-email?token=raw-verify-token',
        },
      });
      expect(result).toEqual({
        message: 'Registered. Please check your email to verify your account.',
      });
    });
  });

  it('logs in with valid credentials', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
      isEmailVerified: true,
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
    expect(refreshTokensService.issueToken).toHaveBeenCalledWith(
      'user-1',
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({
      accessToken: 'token-1',
      refreshToken: 'refresh-token-1',
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
      isEmailVerified: true,
    });
    usersService.isLocked.mockReturnValue(true);

    await expect(
      service.login({ email: 'jane@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.validatePassword).not.toHaveBeenCalled();
    expect(refreshTokensService.issueToken).not.toHaveBeenCalled();
  });

  it('rejects login for an unverified email without checking the password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
      isEmailVerified: false,
    });

    await expect(
      service.login({ email: 'jane@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.validatePassword).not.toHaveBeenCalled();
    expect(refreshTokensService.issueToken).not.toHaveBeenCalled();
  });

  it('registers a failed attempt on invalid password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'jane@example.com',
      password: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Doe',
      isEmailVerified: true,
    });
    usersService.validatePassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'jane@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.registerFailedAttempt).toHaveBeenCalled();
    expect(usersService.resetFailedAttempts).not.toHaveBeenCalled();
    expect(refreshTokensService.issueToken).not.toHaveBeenCalled();
  });

  describe('forgotPassword', () => {
    it('returns a generic message and does nothing when the email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'ghost@example.com',
      });

      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent.',
      });
      expect(usersService.generateResetToken).not.toHaveBeenCalled();
      expect(mailService.queueEmail).not.toHaveBeenCalled();
    });

    it('generates a token and queues an email when the user exists', async () => {
      const user = {
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      };
      usersService.findByEmail.mockResolvedValue(user);
      usersService.generateResetToken.mockResolvedValue('raw-token-123');

      const result = await service.forgotPassword({
        email: 'jane@example.com',
      });

      expect(usersService.generateResetToken).toHaveBeenCalledWith(user);
      expect(mailService.queueEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Reset your password',
        template: MailTemplate.PASSWORD_RESET,
        context: {
          firstName: 'Jane',
          resetUrl: 'http://localhost:4200/reset-password?token=raw-token-123',
          expiryMinutes: 15,
        },
      });
      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('throws when the token is invalid or expired', async () => {
      usersService.findByResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.resetPassword).not.toHaveBeenCalled();
      expect(refreshTokensService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('resets the password when the token is valid and revokes all refresh tokens', async () => {
      const user = { id: 'user-1', email: 'jane@example.com' };
      usersService.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({
        token: 'good-token',
        newPassword: 'NewPass123!',
      });

      expect(usersService.findByResetToken).toHaveBeenCalledWith('good-token');
      expect(usersService.resetPassword).toHaveBeenCalledWith(
        user,
        'NewPass123!',
      );
      expect(refreshTokensService.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({
        message: 'Password has been reset successfully.',
      });
    });
  });

  describe('verifyEmail', () => {
    it('throws when the token is invalid or expired', async () => {
      usersService.findByEmailVerificationToken.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'bad-token' })).rejects.toThrow(
        BadRequestException,
      );

      expect(usersService.markEmailAsVerified).not.toHaveBeenCalled();
    });

    it('marks the email as verified when the token is valid', async () => {
      const user = { id: 'user-1', email: 'jane@example.com' };
      usersService.findByEmailVerificationToken.mockResolvedValue(user);

      const result = await service.verifyEmail({ token: 'good-token' });

      expect(usersService.markEmailAsVerified).toHaveBeenCalledWith(user);
      expect(result).toEqual({ message: 'Email verified successfully.' });
    });
  });

  describe('resendVerification', () => {
    it('returns a generic message and does nothing when the email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({
        email: 'ghost@example.com',
      });

      expect(result.message).toContain('If that email exists');
      expect(
        usersService.generateEmailVerificationToken,
      ).not.toHaveBeenCalled();
      expect(mailService.queueEmail).not.toHaveBeenCalled();
    });

    it('returns a generic message and does nothing when the user is already verified', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        isEmailVerified: true,
      });

      const result = await service.resendVerification({
        email: 'jane@example.com',
      });

      expect(result.message).toContain('If that email exists');
      expect(
        usersService.generateEmailVerificationToken,
      ).not.toHaveBeenCalled();
      expect(mailService.queueEmail).not.toHaveBeenCalled();
    });

    it('generates a new token and queues an email for an unverified user', async () => {
      const user = {
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        isEmailVerified: false,
      };
      usersService.findByEmail.mockResolvedValue(user);
      usersService.generateEmailVerificationToken.mockResolvedValue(
        'raw-verify-token',
      );

      const result = await service.resendVerification({
        email: 'jane@example.com',
      });

      expect(usersService.generateEmailVerificationToken).toHaveBeenCalledWith(
        user,
      );
      expect(mailService.queueEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Verify your email',
        template: MailTemplate.EMAIL_VERIFICATION,
        context: {
          firstName: 'Jane',
          verifyUrl:
            'http://localhost:4200/verify-email?token=raw-verify-token',
        },
      });
      expect(result.message).toContain('If that email exists');
    });
  });

  describe('changePassword', () => {
    it('throws when the user cannot be found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'old',
          newPassword: 'NewStrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when the current password is incorrect', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed-password',
        firstName: 'Jane',
      });
      usersService.validatePassword.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'NewStrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.changePassword).not.toHaveBeenCalled();
      expect(refreshTokensService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('changes the password, revokes all refresh tokens, and sends a notification email', async () => {
      const user = {
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed-password',
        firstName: 'Jane',
      };
      usersService.findById.mockResolvedValue(user);
      usersService.validatePassword.mockResolvedValue(true);

      const result = await service.changePassword('user-1', {
        currentPassword: 'old-password',
        newPassword: 'NewStrongPassword123!',
      });

      expect(usersService.changePassword).toHaveBeenCalledWith(
        user,
        'NewStrongPassword123!',
      );
      expect(refreshTokensService.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(mailService.queueEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Your password was changed',
        template: MailTemplate.PASSWORD_CHANGED,
        context: { firstName: 'Jane' },
      });
      expect(result).toEqual({ message: 'Password changed successfully.' });
    });
  });

  describe('listSessions', () => {
    it('marks matching-family sessions as current and computes status correctly', async () => {
      refreshTokensService.findFamilyIdForToken.mockResolvedValue('family-1');
      refreshTokensService.listForUser.mockResolvedValue([
        {
          id: 'rt-1',
          familyId: 'family-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-01-01'),
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
        },
        {
          id: 'rt-2',
          familyId: 'family-2',
          userAgent: 'Firefox',
          ipAddress: '10.0.0.1',
          createdAt: new Date('2026-01-02'),
          expiresAt: new Date(Date.now() - 100000),
          revokedAt: null,
        },
        {
          id: 'rt-3',
          familyId: 'family-3',
          userAgent: 'Safari',
          ipAddress: '10.0.0.2',
          createdAt: new Date('2026-01-03'),
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: new Date(),
        },
      ]);

      const result = await service.listSessions('user-1', {
        refreshToken: 'current-raw-token',
      });

      expect(result).toEqual([
        expect.objectContaining({
          id: 'rt-1',
          status: 'active',
          isCurrent: true,
        }),
        expect.objectContaining({
          id: 'rt-2',
          status: 'expired',
          isCurrent: false,
        }),
        expect.objectContaining({
          id: 'rt-3',
          status: 'revoked',
          isCurrent: false,
        }),
      ]);
    });

    it('marks nothing as current when the submitted token is invalid', async () => {
      refreshTokensService.findFamilyIdForToken.mockResolvedValue(null);
      refreshTokensService.listForUser.mockResolvedValue([
        {
          id: 'rt-1',
          familyId: 'family-1',
          userAgent: null,
          ipAddress: null,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
        },
      ]);

      const result = await service.listSessions('user-1', {
        refreshToken: 'stale-or-invalid-token',
      });

      expect(result[0].isCurrent).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('delegates to refreshTokensService.revokeFamilyForUser', async () => {
      const result = await service.revokeSession('user-1', 'family-1');

      expect(refreshTokensService.revokeFamilyForUser).toHaveBeenCalledWith(
        'user-1',
        'family-1',
      );
      expect(result).toEqual({ message: 'Session revoked.' });
    });
  });

  describe('deleteAccount', () => {
    it('throws when the user cannot be found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.deleteAccount('user-1', { password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when the password is incorrect', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        password: 'hashed-password',
      });
      usersService.validatePassword.mockResolvedValue(false);

      await expect(
        service.deleteAccount('user-1', { password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(cvService.removeAllByUser).not.toHaveBeenCalled();
    });

    it('cascades deletion across avatar, CVs, letters, refresh tokens, and the user row', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        password: 'hashed-password',
      });
      usersService.validatePassword.mockResolvedValue(true);

      const result = await service.deleteAccount('user-1', {
        password: 'correct-password',
      });

      expect(avatarsService.deleteAvatarIfExists).toHaveBeenCalledWith(
        'user-1',
      );
      expect(cvService.removeAllByUser).toHaveBeenCalledWith('user-1');
      expect(lettersService.removeAllByUser).toHaveBeenCalledWith('user-1');
      expect(refreshTokensService.deleteAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(usersService.delete).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'Account deleted.' });
    });
  });
});
