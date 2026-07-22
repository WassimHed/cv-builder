import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshTokensService } from './refresh-tokens.service';
import { RefreshToken } from './entities/refresh-token.entity';

describe('RefreshTokensService', () => {
  let service: RefreshTokensService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ id: 'generated-id', ...entity })),
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('30d'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokensService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<RefreshTokensService>(RefreshTokensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issueToken', () => {
    it('creates and saves a new refresh token record', async () => {
      const result = await service.issueToken('user-1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          familyId: expect.any(String),
          expiresAt: expect.any(Date),
          userAgent: null,
          ipAddress: null,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.rawToken).toEqual(expect.any(String));
      expect(result.record.userId).toBe('user-1');
    });

    it('reuses the provided familyId when given (rotation case)', async () => {
      await service.issueToken('user-1', 'existing-family-id');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'existing-family-id' }),
      );
    });

    it('generates a new familyId when none is provided (fresh login)', async () => {
      const first = await service.issueToken('user-1');
      const second = await service.issueToken('user-1');

      expect(first.record.familyId).not.toBe(second.record.familyId);
    });

    it('stores userAgent and ipAddress when provided', async () => {
      await service.issueToken('user-1', undefined, 'Mozilla/5.0', '127.0.0.1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('sets expiresAt based on JWT_REFRESH_EXPIRATION_TIME config', async () => {
      const before = Date.now();
      const result = await service.issueToken('user-1');
      const after = Date.now();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(result.record.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + thirtyDaysMs - 1000,
      );
      expect(result.record.expiresAt.getTime()).toBeLessThanOrEqual(
        after + thirtyDaysMs + 1000,
      );
    });
  });

  describe('rotateToken', () => {
    const validRecord = () => ({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hashed-value',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      userAgent: null,
      ipAddress: null,
      createdAt: new Date(),
    });

    it('throws UnauthorizedException when token does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.rotateToken('nonexistent-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token is expired', async () => {
      const expired = validRecord();
      expired.expiresAt = new Date(Date.now() - 1000);
      repository.findOne.mockResolvedValue(expired);

      await expect(service.rotateToken('some-raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the existing token and issues a new one in the same family', async () => {
      const existing = validRecord();
      repository.findOne.mockResolvedValue(existing);

      const result = await service.rotateToken('some-raw-token');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'token-1', revokedAt: expect.any(Date) }),
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'family-1', userId: 'user-1' }),
      );
      expect(result.userId).toBe('user-1');
      expect(result.issued.rawToken).toEqual(expect.any(String));
    });

    it('passes userAgent/ipAddress through to the newly issued token', async () => {
      repository.findOne.mockResolvedValue(validRecord());

      await service.rotateToken('some-raw-token', 'Mozilla/5.0', '10.0.0.1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('detects reuse of an already-revoked token and revokes the whole family', async () => {
      const reused = validRecord();
      reused.revokedAt = new Date();

      repository.findOne.mockResolvedValue(reused);

      await expect(service.rotateToken('stale-raw-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(repository.update).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { revokedAt: expect.any(Date) },
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('does nothing when the token does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.revokeToken('nonexistent');

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does nothing when the token is already revoked (idempotent)', async () => {
      repository.findOne.mockResolvedValue({
        id: 'token-1',
        revokedAt: new Date(),
      });

      await service.revokeToken('already-revoked');

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('marks an active token as revoked', async () => {
      const record = { id: 'token-1', revokedAt: null };
      repository.findOne.mockResolvedValue(record);

      await service.revokeToken('active-token');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'token-1', revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('revokeFamily', () => {
    it('revokes all tokens matching the familyId', async () => {
      await service.revokeFamily('family-1');

      expect(repository.update).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('revokes all tokens matching the userId, across families', async () => {
      await service.revokeAllForUser('user-1');

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('findFamilyIdForToken', () => {
    it('returns null when the token does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findFamilyIdForToken('unknown-token');

      expect(result).toBeNull();
    });

    it('returns the familyId when the token exists', async () => {
      repository.findOne.mockResolvedValue({ familyId: 'family-1' });

      const result = await service.findFamilyIdForToken('known-token');

      expect(result).toBe('family-1');
    });
  });

  describe('listForUser', () => {
    it('queries by userId ordered by createdAt descending', async () => {
      repository.find.mockResolvedValue([]);

      await service.listForUser('user-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('revokeFamilyForUser', () => {
    it('throws NotFoundException when the family does not belong to the user', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeFamilyForUser('user-1', 'someone-elses-family'),
      ).rejects.toThrow('Session not found');

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('revokes the family when it belongs to the user', async () => {
      repository.findOne.mockResolvedValue({
        userId: 'user-1',
        familyId: 'family-1',
      });

      await service.revokeFamilyForUser('user-1', 'family-1');

      expect(repository.update).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('deleteAllForUser', () => {
    it('deletes all refresh token rows for the user', async () => {
      await service.deleteAllForUser('user-1');

      expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });
});
