import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Cv, SectionType } from './schemas/cv.schema';
import { CreateCvDto } from './dto/create-cv.dto';
import { UpdateCvDto } from './dto/update-cv.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UsersService } from '../users/users.service';
import { PersonalInfoContentDto } from './dto/section-content/personal-info-content.dto';
import { ExperienceContentDto } from './dto/section-content/experience-content.dto';
import { EducationContentDto } from './dto/section-content/education-content.dto';
import { SkillsContentDto } from './dto/section-content/skills-content.dto';
import { ProjectsContentDto } from './dto/section-content/projects-content.dto';
import { CertificationsContentDto } from './dto/section-content/certifications-content.dto';
import { LanguagesContentDto } from './dto/section-content/languages-content.dto';

const CONTENT_DTO_MAP: Record<SectionType, new () => object> = {
  [SectionType.PERSONAL_INFO]: PersonalInfoContentDto,
  [SectionType.EXPERIENCE]: ExperienceContentDto,
  [SectionType.EDUCATION]: EducationContentDto,
  [SectionType.SKILLS]: SkillsContentDto,
  [SectionType.PROJECTS]: ProjectsContentDto,
  [SectionType.CERTIFICATIONS]: CertificationsContentDto,
  [SectionType.LANGUAGES]: LanguagesContentDto,
};

@Injectable()
export class CvService {
  constructor(
    @InjectModel(Cv.name) private readonly cvModel: Model<Cv>,
    private readonly usersService: UsersService,
  ) {}

  private async validateSectionContent(
    section: CreateSectionDto,
  ): Promise<void> {
    const DtoClass = CONTENT_DTO_MAP[section.type];
    const instance = plainToInstance(DtoClass, section.content);
    await validateOrReject(instance);
  }

  async create(userId: string, dto: CreateCvDto): Promise<Cv> {
    await this.usersService.findById(userId); // throws if userId doesn't exist — app-level FK check

    if (dto.sections?.length) {
      await Promise.all(
        dto.sections.map((s) => this.validateSectionContent(s)),
      );
    }

    const created = new this.cvModel({ ...dto, userId });
    return created.save();
  }

  async findAllByUser(userId: string): Promise<Cv[]> {
    return this.cvModel.find({ userId }).exec();
  }

  async findOne(id: string, userId: string): Promise<Cv> {
    const cv = await this.cvModel.findOne({ _id: id, userId }).exec();
    if (!cv) throw new NotFoundException('CV not found');
    return cv;
  }

  async update(id: string, userId: string, dto: UpdateCvDto): Promise<Cv> {
    const cv = await this.cvModel
      .findOneAndUpdate({ _id: id, userId }, dto, { new: true })
      .exec();
    if (!cv) throw new NotFoundException('CV not found');
    return cv;
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleteResult = (await this.cvModel
      .deleteOne({ _id: id, userId })
      .exec()) as {
      deletedCount?: number;
    };
    const deletedCount = deleteResult.deletedCount ?? 0;
    if (deletedCount === 0) throw new NotFoundException('CV not found');
  }

  async addSection(
    cvId: string,
    userId: string,
    dto: CreateSectionDto,
  ): Promise<Cv> {
    await this.validateSectionContent(dto);
    const cv = await this.findOne(cvId, userId);
    cv.sections.push({ ...dto });
    return cv.save();
  }
}
