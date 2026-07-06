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

  describe('account lockout', () => {
    const buildUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed',
        firstName: 'Jane',
        lastName: 'Doe',
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...overrides,
      }) as User;

    it('reports not locked when lockedUntil is null', () => {
      const user = buildUser();
      expect(service.isLocked(user)).toBe(false);
    });

    it('reports locked when lockedUntil is in the future', () => {
      const user = buildUser({
        lockedUntil: new Date(Date.now() + 60_000),
      });
      expect(service.isLocked(user)).toBe(true);
    });

    it('reports not locked when lockedUntil is in the past', () => {
      const user = buildUser({
        lockedUntil: new Date(Date.now() - 60_000),
      });
      expect(service.isLocked(user)).toBe(false);
    });

    it('increments failed attempts without locking below the threshold', async () => {
      const user = buildUser({ failedLoginAttempts: 2 });
      usersRepository.save.mockResolvedValue(user);

      await service.registerFailedAttempt(user);

      expect(user.failedLoginAttempts).toBe(3);
      expect(user.lockedUntil).toBeNull();
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });

    it('locks the account once failed attempts reach the threshold', async () => {
      const user = buildUser({ failedLoginAttempts: 4 });
      usersRepository.save.mockResolvedValue(user);

      await service.registerFailedAttempt(user);

      expect(user.failedLoginAttempts).toBe(5);
      expect(user.lockedUntil).toBeInstanceOf(Date);
      expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });

    it('resets failed attempts and clears lockout', async () => {
      const user = buildUser({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      usersRepository.save.mockResolvedValue(user);

      await service.resetFailedAttempts(user);

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });
  });
});
