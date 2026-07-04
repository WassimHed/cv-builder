import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AI_QUEUE, AiJobType, AiJobStatus } from './constants/ai.constants';
import { SectionType } from '../cv/schemas/cv.schema';

describe('AiService', () => {
  let service: AiService;
  let aiJobModel: jest.Mock & {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let queue: { add: jest.Mock };

  const makeJobDocument = (plain: Record<string, unknown>) => {
    const doc: Record<string, unknown> = { ...plain };
    doc.toObject = jest.fn(() => ({ ...plain }));
    return doc;
  };

  beforeEach(async () => {
    aiJobModel = jest.fn().mockImplementation((doc) => ({
      ...makeJobDocument({ _id: 'job-1', status: AiJobStatus.PENDING, ...doc }),
    })) as jest.Mock & { findById: jest.Mock; findByIdAndUpdate: jest.Mock };

    aiJobModel.create = jest.fn().mockImplementation((doc) =>
      Promise.resolve(
        makeJobDocument({
          _id: { toString: () => 'job-1' },
          status: AiJobStatus.PENDING,
          ...doc,
        }),
      ),
    );
    aiJobModel.findById = jest.fn();
    aiJobModel.findByIdAndUpdate = jest.fn();

    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: getModelToken('AiJob'), useValue: aiJobModel },
        { provide: getQueueToken(AI_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a CV suggestion job and enqueues it', async () => {
    const dto = {
      sectionType: SectionType.EXPERIENCE,
      content: { bullets: ['did a thing'] },
      targetRole: 'Full Stack Developer',
      language: 'en',
    };

    const result = await service.requestCvSuggestions(
      '64f1a2b3c4d5e6f7a8b9c0d1',
      'user-1',
      dto,
      1,
    );

    expect(aiJobModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AiJobType.CV_SUGGESTION,
        sectionType: dto.sectionType,
        sectionOrder: 1,
        userId: 'user-1',
        status: AiJobStatus.PENDING,
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      AiJobType.CV_SUGGESTION,
      expect.objectContaining({
        aiJobId: 'job-1',
        type: AiJobType.CV_SUGGESTION,
        payload: dto,
      }),
    );
    expect(result).toEqual({ jobId: 'job-1', status: AiJobStatus.PENDING });
  });

  it('creates a letter draft job with metadata and enqueues it', async () => {
    const dto = {
      cvSummary: 'CV title: Wassim Hedhli...',
      programName: 'Master en Sciences des Données',
      targetCompany: 'Faculté des Sciences de Bizerte',
      tone: 'formal',
      language: 'fr',
    };

    const result = await service.requestLetterDraft(
      '64f1a2b3c4d5e6f7a8b9c0d1',
      'user-1',
      dto,
    );

    expect(aiJobModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AiJobType.LETTER_DRAFT,
        userId: 'user-1',
        status: AiJobStatus.PENDING,
        metadata: {
          targetCompany: 'Faculté des Sciences de Bizerte',
          targetRole: 'Master en Sciences des Données',
        },
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      AiJobType.LETTER_DRAFT,
      expect.objectContaining({ aiJobId: 'job-1', payload: dto }),
    );
    expect(result).toEqual({ jobId: 'job-1', status: AiJobStatus.PENDING });
  });

  it('returns a plain object for an existing job status', async () => {
    const job = makeJobDocument({
      _id: 'job-1',
      status: AiJobStatus.COMPLETED,
    });
    aiJobModel.findById.mockResolvedValue(job);

    const result = await service.getJobStatus('job-1');

    expect(result).toEqual({ _id: 'job-1', status: AiJobStatus.COMPLETED });
  });

  it('throws NotFoundException when job status is requested for a missing job', async () => {
    aiJobModel.findById.mockResolvedValue(null);

    await expect(service.getJobStatus('missing-job')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findJobById returns null for a missing job without throwing', async () => {
    aiJobModel.findById.mockResolvedValue(null);

    const result = await service.findJobById('missing-job');

    expect(result).toBeNull();
  });
});
