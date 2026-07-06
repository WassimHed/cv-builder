import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
