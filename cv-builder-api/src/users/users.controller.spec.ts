import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { ProfilesService } from './profiles.service';

describe('UsersController', () => {
  let controller: UsersController;
  let profilesService: {
    findByUserId: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    profilesService = {
      findByUserId: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: ProfilesService,
          useValue: profilesService,
        },
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
});
