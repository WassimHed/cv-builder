import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

  /**
   * Resolves the familyId for a given raw refresh token, without
   * throwing on invalid/expired/unknown tokens. Used by session listing
   * to identify "isCurrent" — an invalid token here just means no
   * session gets marked current, not an auth failure (the caller is
   * already authenticated via JWT for that endpoint).
   */
  async findFamilyIdForToken(rawToken: string): Promise<string | null> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
    });
    return existing?.familyId ?? null;
  }

  async listForUser(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokensRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revokes an entire session family, but only after confirming it
   * actually belongs to the requesting user — prevents one user from
   * revoking another user's session by guessing/passing an arbitrary
   * familyId.
   */
  async revokeFamilyForUser(userId: string, familyId: string): Promise<void> {
    const belongsToUser = await this.refreshTokensRepository.findOne({
      where: { userId, familyId },
    });
    if (!belongsToUser) {
      throw new NotFoundException('Session not found');
    }
    await this.revokeFamily(familyId);
  }

  /**
   * Permanently deletes all refresh token rows for a user — distinct
   * from revokeAllForUser, which only sets revokedAt. Used exclusively
   * by account deletion, since a deleted User row would otherwise leave
   * orphaned refresh_tokens rows referencing a nonexistent userId.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.refreshTokensRepository.delete({ userId });
  }
}
