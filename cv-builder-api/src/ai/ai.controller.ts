import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Cv, SectionType } from '../cv/schemas/cv.schema';
import { CvService } from '../cv/cv.service';
import { LettersService } from '../letters/letters.service';
import { AiService } from './ai.service';
import { AiJobStatus, AiJobType } from './constants/ai.constants';
import { RequestAcceptCvSuggestionDto } from './dto/request-accept-cv-suggestion.dto';
import { RequestCvSuggestionsDto } from './dto/request-cv-suggestions.dto';
import { RequestLetterDraftDto } from './dto/request-letter-draft.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly cvService: CvService,
    private readonly lettersService: LettersService,
  ) {}

  private buildCvSummary(cv: Cv): string {
    const sections = [...(cv.sections ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((section) => `${section.type}: ${JSON.stringify(section.content)}`)
      .join('\n');

    return [
      `CV title: ${cv.title}`,
      cv.targetRole ? `Target role: ${cv.targetRole}` : '',
      sections ? `Sections:\n${sections}` : 'Sections: none',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  @Post('cv/:cvId/suggestions')
  async requestCvSuggestions(
    @Param('cvId') cvId: string,
    @Body() dto: RequestCvSuggestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cv = await this.cvService.findOne(cvId, user.userId);
    const matchingSection = cv.sections.find(
      (section) => section.type === dto.sectionType,
    );

    if (!matchingSection) {
      throw new BadRequestException('No matching CV section found');
    }

    return this.aiService.requestCvSuggestions(
      cvId,
      user.userId,
      dto,
      matchingSection.order,
    );
  }

  @Post('cv/:cvId/letter-draft')
  async requestLetterDraft(
    @Param('cvId') cvId: string,
    @Body() dto: RequestLetterDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cv = await this.cvService.findOne(cvId, user.userId);
    const cvSummary = this.buildCvSummary(cv);

    return this.aiService.requestLetterDraft(cvId, user.userId, {
      ...dto,
      cvSummary,
    });
  }

  @Post('jobs/:jobId/accept-letter')
  async acceptLetterDraft(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const job = await this.aiService.findJobById(jobId);

    if (!job || job.userId !== user.userId) {
      throw new BadRequestException('AI job not found');
    }

    if (
      job.status !== AiJobStatus.COMPLETED ||
      job.type !== AiJobType.LETTER_DRAFT
    ) {
      throw new BadRequestException('AI job is not ready to accept');
    }

    const draft = (job.result as { draft?: unknown } | null)?.draft;
    if (typeof draft !== 'string' || !draft.trim()) {
      throw new BadRequestException('AI job draft result is missing');
    }

    const metadata =
      (job.metadata as {
        targetCompany?: string;
        targetRole?: string;
      } | null) ?? {};

    return this.lettersService.create(user.userId, {
      cvId: String(job.targetId),
      targetCompany: metadata.targetCompany,
      targetRole: metadata.targetRole,
      content: draft,
    });
  }

  @Post('jobs/:jobId/accept-cv-suggestion')
  async acceptCvSuggestion(
    @Param('jobId') jobId: string,
    @Body() body: RequestAcceptCvSuggestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const job = await this.aiService.findJobById(jobId);

    if (!job || job.userId !== user.userId) {
      throw new BadRequestException('AI job not found');
    }

    if (
      job.status !== AiJobStatus.COMPLETED ||
      job.type !== AiJobType.CV_SUGGESTION
    ) {
      throw new BadRequestException('AI job is not ready to accept');
    }

    if (
      typeof job.sectionType !== 'string' ||
      typeof job.sectionOrder !== 'number'
    ) {
      throw new BadRequestException(
        'AI job section targeting metadata is missing',
      );
    }

    const jobResult = job.result as {
      suggestions?: Array<{ original: string; improved: string }>;
    } | null;
    const suggestions = Array.isArray(jobResult?.suggestions)
      ? jobResult.suggestions
      : null;

    if (!suggestions?.length) {
      throw new BadRequestException('AI job suggestions are missing');
    }

    const acceptedIndexes =
      body.acceptedIndexes?.length && body.acceptedIndexes.length > 0
        ? [...new Set(body.acceptedIndexes)]
        : suggestions.map((_, index) => index);

    const acceptedSuggestions = acceptedIndexes.map(
      (index) => suggestions[index],
    );
    if (acceptedSuggestions.some((suggestion) => !suggestion)) {
      throw new BadRequestException(
        'One or more accepted suggestion indexes are invalid',
      );
    }

    return this.cvService.applyAiSuggestions(
      String(job.targetId),
      user.userId,
      job.sectionType as SectionType,
      job.sectionOrder,
      acceptedSuggestions,
    );
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.aiService.getJobStatus(jobId);
  }
}
