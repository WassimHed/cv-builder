import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { MailTemplate } from '../mail/dto/send-email-job.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
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

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      isEmailVerified: true,
    });
    usersService.isLocked.mockReturnValue(true);

    await expect(
      service.login({ email: 'jane@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersService.validatePassword).not.toHaveBeenCalled();
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
    });

    it('resets the password when the token is valid', async () => {
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
});
