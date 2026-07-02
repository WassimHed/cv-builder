import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    usersRepository = {
      create: jest.fn((user) => user),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a user after checking for an existing email', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    usersRepository.save.mockResolvedValue({ id: 'user-1' });

    const result = await service.create({
      email: 'jane@example.com',
      password: 'secret',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'jane@example.com' },
    });
    expect(usersRepository.create).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: expect.any(String),
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(usersRepository.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-1' });
  });
});
