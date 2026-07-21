import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfilesService } from './profiles.service';
import { Profile } from './entities/profile.entity';

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
    it('returns an all-null placeholder when no profile row exists yet', async () => {
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
      });
    });

    it('returns the existing profile when one exists', async () => {
      const existing = {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findOne.mockResolvedValue(existing);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(existing);
    });
  });

  describe('upsert', () => {
    it('creates a new profile row when none exists yet', async () => {
      repository.findOne.mockResolvedValue(null);

      const dto = { bio: 'New bio', city: 'Tunis' };
      await service.upsert('user-1', dto);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        bio: 'New bio',
        city: 'Tunis',
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('applies a partial update to an existing profile, leaving other fields untouched', async () => {
      const existing = {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repository.findOne.mockResolvedValue(existing);

      const result = await service.upsert('user-1', { bio: 'Updated bio' });

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: 'Updated bio',
          // untouched fields survive the partial update
          headline: 'Old headline',
          phone: '+21600000000',
          city: 'Bizerte',
        }),
      );
      expect(result.bio).toBe('Updated bio');
    });
  });
});
