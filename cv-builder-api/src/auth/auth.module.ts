import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokensService } from './refresh-tokens.service';
import { CvModule } from '../cv/cv.module';
import { LettersModule } from '../letters/letters.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MailModule,
    TypeOrmModule.forFeature([RefreshToken]),
    CvModule,
    LettersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>(
            'JWT_EXPIRATION_TIME',
          ) as StringValue,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RefreshTokensService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
