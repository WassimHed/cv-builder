import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

type ProfileFields = Omit<
  Profile,
  'id' | 'userId' | 'user' | 'createdAt' | 'updatedAt'
>;

const EMPTY_PROFILE: ProfileFields = {
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
};

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /**
   * Returns the user's profile fields, or an all-null placeholder if
   * no Profile row exists yet (lazy creation — a row is only written
   * on the first update, not at registration).
   */
  async findByUserId(userId: string): Promise<ProfileFields> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });
    return profile ?? EMPTY_PROFILE;
  }

  /**
   * Upserts profile fields for a user. Creates the row on first call,
   * otherwise applies a partial update (only fields present in dto
   * are touched — untouched fields keep their existing value).
   */
  async upsert(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    let profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profilesRepository.create({ userId, ...dto });
    } else {
      Object.assign(profile, dto);
    }

    return this.profilesRepository.save(profile);
  }
}
