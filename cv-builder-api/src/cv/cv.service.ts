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
import { StorageService } from '../storage/storage.service';
import { PdfStatus } from '../common/pdf-status.enum';

type AiSuggestion = {
  original: string;
  improved: string;
};

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
    private readonly storageService: StorageService,
  ) {}

  private async validateSectionContent(
    section: CreateSectionDto,
  ): Promise<void> {
    const DtoClass = CONTENT_DTO_MAP[section.type];
    const instance = plainToInstance(DtoClass, section.content);
    await validateOrReject(instance);
  }

  private toPlain(cv: Cv): Cv {
    return cv.toJSON() as Cv;
  }

  private async findOneDocument(id: string, userId: string): Promise<Cv> {
    const cv = await this.cvModel.findOne({ _id: id, userId }).exec();
    if (!cv) throw new NotFoundException('CV not found');
    return cv;
  }

  async create(userId: string, dto: CreateCvDto): Promise<Cv> {
    await this.usersService.findById(userId); // throws if userId doesn't exist — app-level FK check

    if (dto.sections?.length) {
      await Promise.all(
        dto.sections.map((s) => this.validateSectionContent(s)),
      );
    }

    const created = new this.cvModel({ ...dto, userId });
    const saved = await created.save();
    return this.toPlain(saved);
  }

  async findAllByUser(userId: string): Promise<Cv[]> {
    const cvs = await this.cvModel.find({ userId }).exec();
    return cvs.map((cv) => this.toPlain(cv));
  }

  async findOne(id: string, userId: string): Promise<Cv> {
    const cv = await this.findOneDocument(id, userId);
    return this.toPlain(cv);
  }

  async update(id: string, userId: string, dto: UpdateCvDto): Promise<Cv> {
    const cv = await this.cvModel
      .findOneAndUpdate({ _id: id, userId }, dto, { new: true })
      .exec();
    if (!cv) throw new NotFoundException('CV not found');
    return this.toPlain(cv);
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
    const cv = await this.findOneDocument(cvId, userId);
    cv.sections.push({ ...dto });
    const saved = await cv.save();
    return this.toPlain(saved);
  }

  private replaceText(
    value: unknown,
    original: string,
    improved: string,
  ): unknown {
    if (typeof value === 'string') {
      if (value === original) {
        return improved;
      }

      return value.includes(original)
        ? value.split(original).join(improved)
        : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.replaceText(item, original, improved));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          this.replaceText(entry, original, improved),
        ]),
      );
    }

    return value;
  }

  async applyAiSuggestions(
    cvId: string,
    userId: string,
    sectionType: SectionType,
    sectionOrder: number,
    suggestions: AiSuggestion[],
  ): Promise<Cv> {
    const cv = await this.findOneDocument(cvId, userId);
    const section = cv.sections.find(
      (entry) => entry.type === sectionType && entry.order === sectionOrder,
    );

    if (!section) {
      throw new NotFoundException('CV section not found');
    }

    section.content = suggestions.reduce(
      (content, suggestion) =>
        this.replaceText(content, suggestion.original, suggestion.improved),
      section.content,
    );

    const saved = await cv.save();
    return this.toPlain(saved);
  }
  async uploadPdf(cvId: string, userId: string, buffer: Buffer): Promise<Cv> {
    const cv = await this.findOneDocument(cvId, userId); // throws NotFoundException if not owned

    const key = `cv-pdfs/${cvId}.pdf`;
    const { backend } = await this.storageService.upload(
      key,
      buffer,
      'application/pdf',
    );

    cv.pdfKey = key;
    cv.pdfBackend = backend;
    cv.pdfStatus = PdfStatus.READY;
    const saved = await cv.save();
    return this.toPlain(saved);
  }

  async downloadPdf(
    cvId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const cv = await this.findOne(cvId, userId);

    if (!cv.pdfKey || !cv.pdfBackend) {
      throw new NotFoundException('This CV has no generated PDF yet');
    }

    const buffer = await this.storageService.download(cv.pdfKey, cv.pdfBackend);
    return { buffer, filename: `${cv.title}.pdf` };
  }

  async setPdfStatus(
    id: string,
    userId: string,
    status: PdfStatus,
  ): Promise<void> {
    const cv = await this.findOneDocument(id, userId);
    cv.pdfStatus = status;
    await cv.save();
  }

  /**
   * Deletes every CV owned by a user, including each one's generated
   * PDF file in storage (if any) — the existing single-record remove()
   * doesn't clean up storage, so this is handled explicitly here for
   * the bulk/account-deletion path.
   */
  async removeAllByUser(userId: string): Promise<void> {
    const cvs = await this.cvModel.find({ userId }).exec();

    for (const cv of cvs) {
      if (cv.pdfKey && cv.pdfBackend) {
        await this.storageService.delete(cv.pdfKey, cv.pdfBackend);
      }
    }

    await this.cvModel.deleteMany({ userId }).exec();
  }
}
