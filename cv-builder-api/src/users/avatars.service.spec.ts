import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { StorageService } from '../storage/storage.service';
import { ProfilesService } from './profiles.service';
import { StorageBackend } from '../storage/interfaces/storage-backend.enum';

const mockWebpBuffer = Buffer.from('fake-webp-bytes');

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(mockWebpBuffer),
  }));
});

describe('AvatarsService', () => {
  let service: AvatarsService;
  let storageService: {
    upload: jest.Mock;
    download: jest.Mock;
    delete: jest.Mock;
  };
  let profilesService: {
    getAvatarLocation: jest.Mock;
    setAvatarLocation: jest.Mock;
    clearAvatar: jest.Mock;
  };

  beforeEach(async () => {
    storageService = {
      upload: jest.fn().mockResolvedValue({ backend: StorageBackend.MINIO }),
      download: jest.fn(),
      delete: jest.fn(),
    };

    profilesService = {
      getAvatarLocation: jest.fn().mockResolvedValue(null),
      setAvatarLocation: jest.fn(),
      clearAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarsService,
        { provide: StorageService, useValue: storageService },
        { provide: ProfilesService, useValue: profilesService },
      ],
    }).compile();

    service = module.get<AvatarsService>(AvatarsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAvatar', () => {
    it('processes the image and uploads it under a deterministic key', async () => {
      await service.uploadAvatar('user-1', Buffer.from('raw-image-bytes'));

      expect(storageService.upload).toHaveBeenCalledWith(
        'avatars/user-1.webp',
        mockWebpBuffer,
        'image/webp',
      );
      expect(profilesService.setAvatarLocation).toHaveBeenCalledWith(
        'user-1',
        'avatars/user-1.webp',
        StorageBackend.MINIO,
      );
    });

    it('throws BadRequestException when sharp cannot decode the buffer', async () => {
      const sharp = jest.requireMock('sharp');
      sharp.mockImplementationOnce(() => ({
        resize: jest.fn().mockReturnThis(),
        webp: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('not an image')),
      }));

      await expect(
        service.uploadAvatar('user-1', Buffer.from('garbage')),
      ).rejects.toThrow(BadRequestException);

      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('deletes the old file when the backend changed between uploads', async () => {
      profilesService.getAvatarLocation.mockResolvedValue({
        key: 'avatars/user-1.webp',
        backend: StorageBackend.LOCAL,
      });
      storageService.upload.mockResolvedValue({
        backend: StorageBackend.MINIO,
      });

      await service.uploadAvatar('user-1', Buffer.from('raw-image-bytes'));

      expect(storageService.delete).toHaveBeenCalledWith(
        'avatars/user-1.webp',
        StorageBackend.LOCAL,
      );
    });

    it('does not delete anything when the backend is unchanged (deterministic key overwrote in place)', async () => {
      profilesService.getAvatarLocation.mockResolvedValue({
        key: 'avatars/user-1.webp',
        backend: StorageBackend.MINIO,
      });
      storageService.upload.mockResolvedValue({
        backend: StorageBackend.MINIO,
      });

      await service.uploadAvatar('user-1', Buffer.from('raw-image-bytes'));

      expect(storageService.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAvatar', () => {
    it('throws NotFoundException when no avatar is set', async () => {
      profilesService.getAvatarLocation.mockResolvedValue(null);

      await expect(service.getAvatar('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('downloads and returns the avatar buffer with content type', async () => {
      profilesService.getAvatarLocation.mockResolvedValue({
        key: 'avatars/user-1.webp',
        backend: StorageBackend.MINIO,
      });
      storageService.download.mockResolvedValue(Buffer.from('image-bytes'));

      const result = await service.getAvatar('user-1');

      expect(storageService.download).toHaveBeenCalledWith(
        'avatars/user-1.webp',
        StorageBackend.MINIO,
      );
      expect(result).toEqual({
        buffer: Buffer.from('image-bytes'),
        contentType: 'image/webp',
      });
    });
  });

  describe('deleteAvatar', () => {
    it('throws NotFoundException when no avatar is set', async () => {
      profilesService.getAvatarLocation.mockResolvedValue(null);

      await expect(service.deleteAvatar('user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(storageService.delete).not.toHaveBeenCalled();
    });

    it('deletes the file from storage and clears the profile fields', async () => {
      profilesService.getAvatarLocation.mockResolvedValue({
        key: 'avatars/user-1.webp',
        backend: StorageBackend.MINIO,
      });

      await service.deleteAvatar('user-1');

      expect(storageService.delete).toHaveBeenCalledWith(
        'avatars/user-1.webp',
        StorageBackend.MINIO,
      );
      expect(profilesService.clearAvatar).toHaveBeenCalledWith('user-1');
    });
  });
});
