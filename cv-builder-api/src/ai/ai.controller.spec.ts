import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CvService } from '../cv/cv.service';
import { LettersService } from '../letters/letters.service';
import { AiJobType, AiJobStatus } from './constants/ai.constants';
import { SectionType } from '../cv/schemas/cv.schema';

describe('AiController', () => {
  let controller: AiController;
  let aiService: {
    requestCvSuggestions: jest.Mock;
    requestLetterDraft: jest.Mock;
    getJobStatus: jest.Mock;
    findJobById: jest.Mock;
  };
  let cvService: { findOne: jest.Mock; applyAiSuggestions: jest.Mock };
  let lettersService: { create: jest.Mock };

  const user = { userId: 'user-1' } as any;

  beforeEach(async () => {
    aiService = {
      requestCvSuggestions: jest.fn(),
      requestLetterDraft: jest.fn(),
      getJobStatus: jest.fn(),
      findJobById: jest.fn(),
    };
    cvService = { findOne: jest.fn(), applyAiSuggestions: jest.fn() };
    lettersService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: CvService, useValue: cvService },
        { provide: LettersService, useValue: lettersService },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestCvSuggestions', () => {
    it('finds the matching section and delegates to AiService with its order', async () => {
      cvService.findOne.mockResolvedValue({
        sections: [
          { type: SectionType.EXPERIENCE, order: 1, content: {} },
          { type: SectionType.SKILLS, order: 3, content: {} },
        ],
      });
      aiService.requestCvSuggestions.mockResolvedValue({
        jobId: 'job-1',
        status: AiJobStatus.PENDING,
      });

      const dto = { sectionType: SectionType.SKILLS, content: {} } as any;
      const result = await controller.requestCvSuggestions('cv-1', dto, user);

      expect(aiService.requestCvSuggestions).toHaveBeenCalledWith(
        'cv-1',
        'user-1',
        dto,
        3,
      );
      expect(result).toEqual({ jobId: 'job-1', status: AiJobStatus.PENDING });
    });

    it('throws BadRequestException when no matching section exists', async () => {
      cvService.findOne.mockResolvedValue({ sections: [] });

      await expect(
        controller.requestCvSuggestions(
          'cv-1',
          { sectionType: SectionType.SKILLS } as any,
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestLetterDraft', () => {
    it('builds a CV summary and delegates to AiService', async () => {
      cvService.findOne.mockResolvedValue({
        title: 'My CV',
        targetRole: 'Full Stack Developer',
        sections: [
          {
            type: SectionType.SKILLS,
            order: 0,
            content: { items: ['NestJS'] },
          },
        ],
      });
      aiService.requestLetterDraft.mockResolvedValue({
        jobId: 'job-2',
        status: AiJobStatus.PENDING,
      });

      const dto = { programName: 'Master X' } as any;
      const result = await controller.requestLetterDraft('cv-1', dto, user);

      expect(aiService.requestLetterDraft).toHaveBeenCalledWith(
        'cv-1',
        'user-1',
        expect.objectContaining({
          programName: 'Master X',
          cvSummary: expect.stringContaining('My CV'),
        }),
      );
      expect(result).toEqual({ jobId: 'job-2', status: AiJobStatus.PENDING });
    });
  });

  describe('acceptLetterDraft', () => {
    it('creates a letter from the job result and metadata', async () => {
      aiService.findJobById.mockResolvedValue({
        userId: 'user-1',
        status: AiJobStatus.COMPLETED,
        type: AiJobType.LETTER_DRAFT,
        targetId: 'cv-1',
        result: { draft: 'Dear Sir...' },
        metadata: { targetCompany: 'Company X', targetRole: 'Role Y' },
      });
      lettersService.create.mockResolvedValue({ _id: 'letter-1' });

      const result = await controller.acceptLetterDraft('job-2', user);

      expect(lettersService.create).toHaveBeenCalledWith('user-1', {
        cvId: 'cv-1',
        targetCompany: 'Company X',
        targetRole: 'Role Y',
        content: 'Dear Sir...',
      });
      expect(result).toEqual({ _id: 'letter-1' });
    });

    it('throws when the job belongs to a different user', async () => {
      aiService.findJobById.mockResolvedValue({ userId: 'someone-else' });

      await expect(controller.acceptLetterDraft('job-2', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the job is not completed', async () => {
      aiService.findJobById.mockResolvedValue({
        userId: 'user-1',
        status: AiJobStatus.PROCESSING,
        type: AiJobType.LETTER_DRAFT,
      });

      await expect(controller.acceptLetterDraft('job-2', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when the draft text is missing from the result', async () => {
      aiService.findJobById.mockResolvedValue({
        userId: 'user-1',
        status: AiJobStatus.COMPLETED,
        type: AiJobType.LETTER_DRAFT,
        result: {},
      });

      await expect(controller.acceptLetterDraft('job-2', user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('acceptCvSuggestion', () => {
    const baseJob = {
      userId: 'user-1',
      status: AiJobStatus.COMPLETED,
      type: AiJobType.CV_SUGGESTION,
      targetId: 'cv-1',
      sectionType: SectionType.EXPERIENCE,
      sectionOrder: 1,
      result: {
        suggestions: [
          { original: 'a', improved: 'A' },
          { original: 'b', improved: 'B' },
          { original: 'c', improved: 'C' },
        ],
      },
    };

    it('applies all suggestions when acceptedIndexes is omitted', async () => {
      aiService.findJobById.mockResolvedValue(baseJob);
      cvService.applyAiSuggestions.mockResolvedValue({ _id: 'cv-1' });

      const result = await controller.acceptCvSuggestion('job-1', {}, user);

      expect(cvService.applyAiSuggestions).toHaveBeenCalledWith(
        'cv-1',
        'user-1',
        SectionType.EXPERIENCE,
        1,
        baseJob.result.suggestions,
      );
      expect(result).toEqual({ _id: 'cv-1' });
    });

    it('applies only the requested indexes', async () => {
      aiService.findJobById.mockResolvedValue(baseJob);
      cvService.applyAiSuggestions.mockResolvedValue({ _id: 'cv-1' });

      await controller.acceptCvSuggestion(
        'job-1',
        { acceptedIndexes: [0, 2] },
        user,
      );

      expect(cvService.applyAiSuggestions).toHaveBeenCalledWith(
        'cv-1',
        'user-1',
        SectionType.EXPERIENCE,
        1,
        [baseJob.result.suggestions[0], baseJob.result.suggestions[2]],
      );
    });

    it('throws when an accepted index is out of range', async () => {
      aiService.findJobById.mockResolvedValue(baseJob);

      await expect(
        controller.acceptCvSuggestion('job-1', { acceptedIndexes: [99] }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when section targeting metadata is missing', async () => {
      aiService.findJobById.mockResolvedValue({
        ...baseJob,
        sectionType: undefined,
        sectionOrder: undefined,
      });

      await expect(
        controller.acceptCvSuggestion('job-1', {}, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getJobStatus', () => {
    it('delegates to AiService', async () => {
      aiService.getJobStatus.mockResolvedValue({
        _id: 'job-1',
        status: AiJobStatus.PENDING,
      });

      const result = await controller.getJobStatus('job-1');

      expect(result).toEqual({ _id: 'job-1', status: AiJobStatus.PENDING });
    });
  });
});
