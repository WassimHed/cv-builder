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
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create(registerDto);
    return this.buildAuthResponse(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
    );
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.usersService.isLocked(user)) {
      throw new UnauthorizedException(
        'Account temporarily locked due to too many failed login attempts. Please try again later.',
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

    return this.buildAuthResponse(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
    );
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

    return { message: 'Password has been reset successfully.' };
  }

  private buildAuthResponse(
    id: string,
    email: string,
    firstName: string,
    lastName: string,
  ): AuthResponseDto {
    const payload = { sub: id, email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id, email, firstName, lastName },
    };
  }
}
