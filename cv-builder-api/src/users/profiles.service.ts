import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { StorageBackend } from '../storage/interfaces/storage-backend.enum';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  private toResponseDto(profile: Profile | null): ProfileResponseDto {
    return {
      bio: profile?.bio ?? null,
      headline: profile?.headline ?? null,
      phone: profile?.phone ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      nationality: profile?.nationality ?? null,
      linkedinUrl: profile?.linkedinUrl ?? null,
      githubUrl: profile?.githubUrl ?? null,
      portfolioUrl: profile?.portfolioUrl ?? null,
      hasAvatar: !!profile?.avatarKey,
    };
  }

  async findByUserId(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });
    return this.toResponseDto(profile);
  }

  async upsert(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    let profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profilesRepository.create({ userId, ...dto });
    } else {
      Object.assign(profile, dto);
    }

    const saved = await this.profilesRepository.save(profile);
    return this.toResponseDto(saved);
  }

  /**
   * Returns the existing avatar's storage key/backend for a user, or
   * null if none is set — used by AvatarsService to know whether an
   * old file needs deleting before/after a new one is uploaded.
   */
  async getAvatarLocation(
    userId: string,
  ): Promise<{ key: string; backend: StorageBackend } | null> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });
    if (!profile?.avatarKey || !profile.avatarBackend) {
      return null;
    }
    return { key: profile.avatarKey, backend: profile.avatarBackend };
  }

  async setAvatarLocation(
    userId: string,
    key: string,
    backend: StorageBackend,
  ): Promise<void> {
    let profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profilesRepository.create({
        userId,
        avatarKey: key,
        avatarBackend: backend,
      });
    } else {
      profile.avatarKey = key;
      profile.avatarBackend = backend;
    }

    await this.profilesRepository.save(profile);
  }

  async clearAvatar(userId: string): Promise<void> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    profile.avatarKey = null;
    profile.avatarBackend = null;
    await this.profilesRepository.save(profile);
  }
}
