import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import ms from 'ms';
import type { StringValue } from 'ms';
import { RefreshToken } from './entities/refresh-token.entity';

export interface IssuedRefreshToken {
  rawToken: string;
  record: RefreshToken;
}

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getExpiryDate(): Date {
    const expiration = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRATION_TIME',
    ) as StringValue;
    return new Date(Date.now() + ms(expiration));
  }

  /**
   * Issues a brand new refresh token. Called at login (new familyId,
   * starts a new session lineage) and internally by rotateToken
   * (same familyId, continues an existing lineage).
   */
  async issueToken(
    userId: string,
    familyId: string = randomUUID(),
    userAgent?: string,
    ipAddress?: string,
  ): Promise<IssuedRefreshToken> {
    const rawToken = randomUUID();
    const record = this.refreshTokensRepository.create({
      userId,
      tokenHash: this.hashToken(rawToken),
      familyId,
      expiresAt: this.getExpiryDate(),
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    });
    await this.refreshTokensRepository.save(record);
    return { rawToken, record };
  }

  /**
   * Exchanges a valid, unused refresh token for a new one in the same
   * family. If the presented token has already been revoked (i.e. it
   * was already rotated once before, or explicitly logged out), that's
   * a reuse signal — someone is presenting a stale token, which only
   * happens if it leaked. We revoke the entire family defensively.
   */
  async rotateToken(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ userId: string; issued: IssuedRefreshToken }> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException(
        'Refresh token reuse detected; all sessions in this family were revoked',
      );
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    existing.revokedAt = new Date();
    await this.refreshTokensRepository.save(existing);

    const issued = await this.issueToken(
      existing.userId,
      existing.familyId,
      userAgent,
      ipAddress,
    );

    return { userId: existing.userId, issued };
  }

  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });
    if (!existing || existing.revokedAt) {
      return;
    }
    existing.revokedAt = new Date();
    await this.refreshTokensRepository.save(existing);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokensRepository.update(
      { familyId },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokensRepository.update(
      { userId },
      { revokedAt: new Date() },
    );
  }
}
