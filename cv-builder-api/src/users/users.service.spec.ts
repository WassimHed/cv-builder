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

  describe('email verification', () => {
    const buildUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed',
        firstName: 'Jane',
        lastName: 'Doe',
        isEmailVerified: false,
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiry: null,
        ...overrides,
      }) as User;

    it('generates a token, hashes it, and sets an expiry', async () => {
      const user = buildUser();
      usersRepository.save.mockResolvedValue(user);

      const rawToken = await service.generateEmailVerificationToken(user);

      expect(rawToken).toEqual(expect.any(String));
      expect(user.emailVerificationTokenHash).toEqual(expect.any(String));
      expect(user.emailVerificationTokenHash).not.toEqual(rawToken);
      expect(user.emailVerificationTokenExpiry).toBeInstanceOf(Date);
      expect(user.emailVerificationTokenExpiry!.getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });

    it('finds a user by a valid, unexpired verification token', async () => {
      const user = buildUser();
      usersRepository.save.mockResolvedValue(user);
      const rawToken = await service.generateEmailVerificationToken(user);
      usersRepository.findOne.mockResolvedValue(user);

      const found = await service.findByEmailVerificationToken(rawToken);

      expect(found).toEqual(user);
    });

    it('returns null when the verification token is expired', async () => {
      const user = buildUser({
        emailVerificationTokenHash: 'some-hash',
        emailVerificationTokenExpiry: new Date(Date.now() - 60_000),
      });
      usersRepository.findOne.mockResolvedValue(user);

      const found = await service.findByEmailVerificationToken('raw-token');

      expect(found).toBeNull();
    });

    it('returns null when no user matches the token', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const found = await service.findByEmailVerificationToken('raw-token');

      expect(found).toBeNull();
    });

    it('marks the email as verified and clears the token fields', async () => {
      const user = buildUser({
        emailVerificationTokenHash: 'some-hash',
        emailVerificationTokenExpiry: new Date(Date.now() + 60_000),
      });
      usersRepository.save.mockResolvedValue(user);

      await service.markEmailAsVerified(user);

      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerificationTokenHash).toBeNull();
      expect(user.emailVerificationTokenExpiry).toBeNull();
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });
  });
  describe('changePassword', () => {
    it('hashes the new password and sets passwordChangedAt', async () => {
      const user = {
        id: 'user-1',
        email: 'jane@example.com',
        password: 'old-hashed',
        firstName: 'Jane',
        lastName: 'Doe',
        passwordChangedAt: null,
      } as User;
      usersRepository.save.mockResolvedValue(user);

      await service.changePassword(user, 'NewStrongPassword123!');

      expect(user.password).not.toBe('old-hashed');
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
      expect(usersRepository.save).toHaveBeenCalledWith(user);
    });
  });
});
