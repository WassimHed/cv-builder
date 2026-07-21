import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ProfilesService } from './profiles.service';
import { AvatarsService } from './avatars.service';

describe('UsersController', () => {
  let controller: UsersController;
  let profilesService: {
    findByUserId: jest.Mock;
    upsert: jest.Mock;
  };
  let avatarsService: {
    uploadAvatar: jest.Mock;
    getAvatar: jest.Mock;
    deleteAvatar: jest.Mock;
  };

  beforeEach(async () => {
    profilesService = {
      findByUserId: jest.fn(),
      upsert: jest.fn(),
    };

    avatarsService = {
      uploadAvatar: jest.fn(),
      getAvatar: jest.fn(),
      deleteAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: ProfilesService, useValue: profilesService },
        { provide: AvatarsService, useValue: avatarsService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards get-profile requests to the service with the current user id', async () => {
    await controller.getMyProfile({
      userId: 'user-1',
      email: 'jane@example.com',
    });

    expect(profilesService.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('forwards update-profile requests to the service with the current user id and dto', async () => {
    await controller.updateMyProfile(
      { userId: 'user-1', email: 'jane@example.com' },
      { bio: 'New bio', city: 'Tunis' },
    );

    expect(profilesService.upsert).toHaveBeenCalledWith('user-1', {
      bio: 'New bio',
      city: 'Tunis',
    });
  });

  describe('uploadAvatar', () => {
    const fakeFile = {
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake-image-bytes'),
    } as Express.Multer.File;

    it('throws when no file is provided', async () => {
      await expect(
        controller.uploadAvatar(
          { userId: 'user-1', email: 'jane@example.com' },
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects disallowed mime types', async () => {
      await expect(
        controller.uploadAvatar(
          { userId: 'user-1', email: 'jane@example.com' },
          { ...fakeFile, mimetype: 'application/pdf' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(avatarsService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('rejects files over the size limit', async () => {
      await expect(
        controller.uploadAvatar(
          { userId: 'user-1', email: 'jane@example.com' },
          { ...fakeFile, size: 4 * 1024 * 1024 },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(avatarsService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('forwards a valid upload to the service', async () => {
      const result = await controller.uploadAvatar(
        { userId: 'user-1', email: 'jane@example.com' },
        fakeFile,
      );

      expect(avatarsService.uploadAvatar).toHaveBeenCalledWith(
        'user-1',
        fakeFile.buffer,
      );
      expect(result).toEqual({ message: 'Avatar uploaded.' });
    });
  });

  describe('getAvatar', () => {
    it('streams the avatar buffer with the correct content type', async () => {
      avatarsService.getAvatar.mockResolvedValue({
        buffer: Buffer.from('image-bytes'),
        contentType: 'image/webp',
      });
      const res = {
        set: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.getAvatar(
        { userId: 'user-1', email: 'jane@example.com' },
        res,
      );

      expect(avatarsService.getAvatar).toHaveBeenCalledWith('user-1');
      expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'image/webp' });
      expect(res.send).toHaveBeenCalledWith(Buffer.from('image-bytes'));
    });
  });

  describe('deleteAvatar', () => {
    it('forwards delete requests to the service', async () => {
      const result = await controller.deleteAvatar({
        userId: 'user-1',
        email: 'jane@example.com',
      });

      expect(avatarsService.deleteAvatar).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'Avatar deleted.' });
    });
  });
});
