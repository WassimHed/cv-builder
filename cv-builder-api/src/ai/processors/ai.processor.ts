import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiJob, AiJobDocument } from '../schemas/ai-job.schema';
import { AI_QUEUE, AiJobType, AiJobStatus } from '../constants/ai.constants';
import { GeminiService } from '../gemini/gemini.service';
import { LanguageToolService } from '../grammar/languagetool.service';
import { buildCvSuggestionPrompt } from '../prompts/cv-suggestion.prompts';
import { buildLetterDraftPrompt } from '../prompts/letter-draft.prompts';
import { SectionType } from '../../cv/schemas/cv.schema';

interface CvSuggestionPayload {
  sectionType: SectionType;
  content: unknown;
  targetRole?: string;
  language?: string;
}

interface LetterDraftPayload {
  cvSummary: string;
  programName: string;
  programDescription?: string;
  tone?: string;
  language?: string;
  currentDate?: string;
  academicYear?: string;
}

interface AiJobData {
  aiJobId: string;
  type: AiJobType;
  payload: CvSuggestionPayload | LetterDraftPayload;
}

@Processor(AI_QUEUE)
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    @InjectModel(AiJob.name) private aiJobModel: Model<AiJobDocument>,
    private readonly geminiService: GeminiService,
    private readonly languageToolService: LanguageToolService,
  ) {
    super();
  }

  async process(job: Job<AiJobData>): Promise<void> {
    const { aiJobId, type, payload } = job.data;

    await this.aiJobModel.findByIdAndUpdate(aiJobId, {
      status: AiJobStatus.PROCESSING,
    });

    try {
      let result: Record<string, unknown>;
      let grammarIssues: Awaited<ReturnType<LanguageToolService['check']>> = [];

      if (type === AiJobType.CV_SUGGESTION) {
        const cvPayload = payload as CvSuggestionPayload;
        const textToCheck = JSON.stringify(cvPayload.content);
        grammarIssues = await this.languageToolService.check(
          textToCheck,
          cvPayload.language ?? 'auto',
        );

        const prompt = buildCvSuggestionPrompt(
          cvPayload.sectionType,
          cvPayload.content,
          cvPayload.targetRole,
        );
        result = await this.geminiService.generateJson(prompt);
      } else if (type === AiJobType.LETTER_DRAFT) {
        const letterPayload = payload as LetterDraftPayload;
        const prompt = buildLetterDraftPrompt(
          letterPayload.cvSummary,
          letterPayload.programName,
          letterPayload.programDescription,
          letterPayload.tone,
          letterPayload.language,
          letterPayload.currentDate,
          letterPayload.academicYear,
        );
        result = await this.geminiService.generateJson(prompt);
      } else {
        throw new Error(`Unknown AI job type: ${String(type)}`);
      }

      await this.aiJobModel.findByIdAndUpdate(aiJobId, {
        status: AiJobStatus.COMPLETED,
        result,
        grammarIssues,
        completedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`AI job ${aiJobId} failed: ${message}`);
      await this.aiJobModel.findByIdAndUpdate(aiJobId, {
        status: AiJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      });
      throw err;
    }
  }
}
