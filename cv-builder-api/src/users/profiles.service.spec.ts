import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { Profile } from './entities/profile.entity';
import { StorageBackend } from '../storage/interfaces/storage-backend.enum';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => ({ id: 'generated-id', ...entity })),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getRepositoryToken(Profile),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('returns an all-null response with hasAvatar false when no profile row exists yet', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByUserId('user-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual({
        bio: null,
        headline: null,
        phone: null,
        city: null,
        country: null,
        dateOfBirth: null,
        nationality: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        hasAvatar: false,
      });
    });

    it('returns the existing profile fields when one exists', async () => {
      repository.findOne.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        bio: 'Backend developer',
        headline: 'Full-Stack Developer',
        phone: null,
        city: 'Bizerte',
        country: 'Tunisia',
        dateOfBirth: null,
        nationality: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        avatarKey: null,
        avatarBackend: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(
        expect.objectContaining({
          bio: 'Backend developer',
          headline: 'Full-Stack Developer',
          city: 'Bizerte',
          country: 'Tunisia',
          hasAvatar: false,
        }),
      );
    });

    it('sets hasAvatar to true when an avatarKey is present', async () => {
      repository.findOne.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        bio: null,
        headline: null,
        phone: null,
        city: null,
        country: null,
        dateOfBirth: null,
        nationality: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        avatarKey: 'avatars/user-1.webp',
        avatarBackend: StorageBackend.MINIO,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findByUserId('user-1');

      expect(result.hasAvatar).toBe(true);
    });
  });

  describe('upsert', () => {
    it('creates a new profile row when none exists yet', async () => {
      repository.findOne.mockResolvedValue(null);

      const dto = { bio: 'New bio', city: 'Tunis' };
      const result = await service.upsert('user-1', dto);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        bio: 'New bio',
        city: 'Tunis',
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.bio).toBe('New bio');
      expect(result.city).toBe('Tunis');
    });

    it('applies a partial update to an existing profile, leaving other fields untouched', async () => {
      repository.findOne.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        bio: 'Old bio',
        headline: 'Old headline',
        phone: '+21600000000',
        city: 'Bizerte',
        country: 'Tunisia',
        dateOfBirth: null,
        nationality: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        avatarKey: null,
        avatarBackend: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.upsert('user-1', { bio: 'Updated bio' });

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'Updated bio',
          headline: 'Old headline',
          phone: '+21600000000',
          city: 'Bizerte',
        }),
      );
      expect(result.bio).toBe('Updated bio');
      expect(result.headline).toBe('Old headline');
    });
  });

  describe('getAvatarLocation', () => {
    it('returns null when no profile exists', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getAvatarLocation('user-1');

      expect(result).toBeNull();
    });

    it('returns null when the profile has no avatar set', async () => {
      repository.findOne.mockResolvedValue({
        avatarKey: null,
        avatarBackend: null,
      });

      const result = await service.getAvatarLocation('user-1');

      expect(result).toBeNull();
    });

    it('returns the key and backend when an avatar is set', async () => {
      repository.findOne.mockResolvedValue({
        avatarKey: 'avatars/user-1.webp',
        avatarBackend: StorageBackend.MINIO,
      });

      const result = await service.getAvatarLocation('user-1');

      expect(result).toEqual({
        key: 'avatars/user-1.webp',
        backend: StorageBackend.MINIO,
      });
    });
  });

  describe('setAvatarLocation', () => {
    it('creates a profile row when none exists yet', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.setAvatarLocation(
        'user-1',
        'avatars/user-1.webp',
        StorageBackend.MINIO,
      );

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        avatarKey: 'avatars/user-1.webp',
        avatarBackend: StorageBackend.MINIO,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('updates the avatar fields on an existing profile', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        bio: 'Existing bio',
        avatarKey: null,
        avatarBackend: null,
      };
      repository.findOne.mockResolvedValue(profile);

      await service.setAvatarLocation(
        'user-1',
        'avatars/user-1.webp',
        StorageBackend.LOCAL,
      );

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'Existing bio',
          avatarKey: 'avatars/user-1.webp',
          avatarBackend: StorageBackend.LOCAL,
        }),
      );
    });
  });

  describe('clearAvatar', () => {
    it('throws NotFoundException when no profile exists', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.clearAvatar('user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('clears avatarKey and avatarBackend on an existing profile', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        avatarKey: 'avatars/user-1.webp',
        avatarBackend: StorageBackend.MINIO,
      };
      repository.findOne.mockResolvedValue(profile);

      await service.clearAvatar('user-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarKey: null,
          avatarBackend: null,
        }),
      );
    });
  });
});
