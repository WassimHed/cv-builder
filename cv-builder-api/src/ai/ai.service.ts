import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiJob, AiJobDocument } from './schemas/ai-job.schema';
import { AI_QUEUE, AiJobType, AiJobStatus } from './constants/ai.constants';
import { RequestCvSuggestionsDto } from './dto/request-cv-suggestions.dto';
import { RequestLetterDraftDto } from './dto/request-letter-draft.dto';

@Injectable()
export class AiService {
  constructor(
    @InjectQueue(AI_QUEUE) private readonly aiQueue: Queue,
    @InjectModel(AiJob.name) private readonly aiJobModel: Model<AiJobDocument>,
  ) {}

  async requestCvSuggestions(
    cvId: string,
    userId: string,
    dto: RequestCvSuggestionsDto,
    sectionOrder: number,
  ) {
    const aiJob = await this.aiJobModel.create({
      type: AiJobType.CV_SUGGESTION,
      targetId: new Types.ObjectId(cvId),
      sectionType: dto.sectionType,
      sectionOrder,
      userId,
      status: AiJobStatus.PENDING,
    });

    await this.aiQueue.add(AiJobType.CV_SUGGESTION, {
      aiJobId: aiJob._id.toString(),
      type: AiJobType.CV_SUGGESTION,
      payload: dto,
    });

    return { jobId: aiJob._id.toString(), status: aiJob.status };
  }

  async requestLetterDraft(
    cvId: string,
    userId: string,
    dto: RequestLetterDraftDto & { cvSummary: string },
  ) {
    const aiJob = await this.aiJobModel.create({
      type: AiJobType.LETTER_DRAFT,
      targetId: new Types.ObjectId(cvId),
      metadata: {
        targetCompany: dto.targetCompany ?? null,
        targetRole: dto.programName,
      },
      userId,
      status: AiJobStatus.PENDING,
    });

    await this.aiQueue.add(AiJobType.LETTER_DRAFT, {
      aiJobId: aiJob._id.toString(),
      type: AiJobType.LETTER_DRAFT,
      payload: dto,
    });

    return { jobId: aiJob._id.toString(), status: aiJob.status };
  }

  async getJobStatus(jobId: string) {
    const aiJob = await this.aiJobModel.findById(jobId);
    if (!aiJob) {
      throw new NotFoundException('AI job not found');
    }
    return aiJob.toObject();
  }

  async findJobById(jobId: string) {
    const aiJob = await this.aiJobModel.findById(jobId);
    return aiJob ? aiJob.toObject() : null;
  }
}
