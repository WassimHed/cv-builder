import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { MailTemplate } from '../mail/dto/send-email-job.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RefreshTokensService } from './refresh-tokens.service';
import { User } from '../users/entities/user.entity';

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const user = await this.usersService.create(registerDto);

    const rawToken =
      await this.usersService.generateEmailVerificationToken(user);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    await this.mailService.queueEmail({
      to: user.email,
      subject: 'Verify your email',
      template: MailTemplate.EMAIL_VERIFICATION,
      context: {
        firstName: user.firstName,
        verifyUrl,
      },
    });

    return {
      message: 'Registered. Please check your email to verify your account.',
    };
  }

  async login(
    loginDto: LoginDto,
    ctx: RequestContext = {},
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.usersService.isLocked(user)) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed login attempts. Please try again later.',
      );
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      await this.usersService.registerFailedAttempt(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.resetFailedAttempts(user);

    // New login = new session lineage (new familyId).
    return this.buildAuthResponse(user, undefined, ctx);
  }

  async refresh(
    dto: RefreshTokenDto,
    ctx: RequestContext = {},
  ): Promise<AuthResponseDto> {
    const { userId, issued } = await this.refreshTokensService.rotateToken(
      dto.refreshToken,
      ctx.userAgent,
      ctx.ipAddress,
    );

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: issued.rawToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async logout(dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.refreshTokensService.revokeToken(dto.refreshToken);
    return { message: 'Logged out.' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.refreshTokensService.revokeAllForUser(userId);
    return { message: 'Logged out of all devices.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const genericResponse = {
      message: 'If that email exists, a reset link has been sent.',
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return genericResponse;
    }

    const rawToken = await this.usersService.generateResetToken(user);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.mailService.queueEmail({
      to: user.email,
      subject: 'Reset your password',
      template: MailTemplate.PASSWORD_RESET,
      context: {
        firstName: user.firstName,
        resetUrl,
        expiryMinutes: 15,
      },
    });

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByResetToken(dto.token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.usersService.resetPassword(user, dto.newPassword);
    // A password reset is a full session invalidation event, same as
    // change-password below — kill every refresh token, not just access
    // tokens via passwordChangedAt.
    await this.refreshTokensService.revokeAllForUser(user.id);

    return { message: 'Password has been reset successfully.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmailVerificationToken(
      dto.token,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.markEmailAsVerified(user);

    return { message: 'Email verified successfully.' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If that email exists and is not yet verified, a new verification link has been sent.',
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.isEmailVerified) {
      return genericResponse;
    }

    const rawToken =
      await this.usersService.generateEmailVerificationToken(user);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    await this.mailService.queueEmail({
      to: user.email,
      subject: 'Verify your email',
      template: MailTemplate.EMAIL_VERIFICATION,
      context: {
        firstName: user.firstName,
        verifyUrl,
      },
    });

    return genericResponse;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const isCurrentPasswordValid = await this.usersService.validatePassword(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.usersService.changePassword(user, dto.newPassword);
    await this.refreshTokensService.revokeAllForUser(user.id);

    await this.mailService.queueEmail({
      to: user.email,
      subject: 'Your password was changed',
      template: MailTemplate.PASSWORD_CHANGED,
      context: { firstName: user.firstName },
    });

    return { message: 'Password changed successfully.' };
  }

  private async buildAuthResponse(
    user: User,
    familyId: string | undefined,
    ctx: RequestContext,
  ): Promise<AuthResponseDto> {
    const payload = { sub: user.id, email: user.email };
    const issued = await this.refreshTokensService.issueToken(
      user.id,
      familyId,
      ctx.userAgent,
      ctx.ipAddress,
    );

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: issued.rawToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
