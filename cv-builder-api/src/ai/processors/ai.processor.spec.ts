import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AiProcessor } from './ai.processor';
import { GeminiService } from '../gemini/gemini.service';
import { LanguageToolService } from '../grammar/languagetool.service';
import { AiJobType, AiJobStatus } from '../constants/ai.constants';
import { SectionType } from '../../cv/schemas/cv.schema';

describe('AiProcessor', () => {
  let processor: AiProcessor;
  let aiJobModel: { findByIdAndUpdate: jest.Mock };
  let geminiService: { generateJson: jest.Mock };
  let languageToolService: { check: jest.Mock };

  beforeEach(async () => {
    aiJobModel = { findByIdAndUpdate: jest.fn() };
    geminiService = { generateJson: jest.fn() };
    languageToolService = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProcessor,
        { provide: getModelToken('AiJob'), useValue: aiJobModel },
        { provide: GeminiService, useValue: geminiService },
        { provide: LanguageToolService, useValue: languageToolService },
      ],
    }).compile();

    processor = module.get<AiProcessor>(AiProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('processes a CV suggestion job: runs grammar check, calls Gemini, saves result', async () => {
    languageToolService.check.mockResolvedValue([]);
    geminiService.generateJson.mockResolvedValue({
      suggestions: [{ original: 'a', improved: 'b', reason: 'c' }],
    });

    const job = {
      data: {
        aiJobId: 'job-1',
        type: AiJobType.CV_SUGGESTION,
        payload: {
          sectionType: SectionType.EXPERIENCE,
          content: { bullets: ['a'] },
          targetRole: 'Full Stack Developer',
          language: 'en',
        },
      },
    } as any;

    await processor.process(job);

    expect(aiJobModel.findByIdAndUpdate).toHaveBeenCalledWith('job-1', {
      status: AiJobStatus.PROCESSING,
    });
    expect(languageToolService.check).toHaveBeenCalledWith(
      JSON.stringify({ bullets: ['a'] }),
      'en',
    );
    expect(geminiService.generateJson).toHaveBeenCalled();
    expect(aiJobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        status: AiJobStatus.COMPLETED,
        result: {
          suggestions: [{ original: 'a', improved: 'b', reason: 'c' }],
        },
        grammarIssues: [],
      }),
    );
  });

  it('processes a letter draft job: calls Gemini, skips grammar check, saves result', async () => {
    geminiService.generateJson.mockResolvedValue({
      draft: 'Dear Sir...',
      keyPointsUsed: ['point one'],
    });

    const job = {
      data: {
        aiJobId: 'job-2',
        type: AiJobType.LETTER_DRAFT,
        payload: {
          cvSummary: 'summary text',
          programName: 'Master X',
          tone: 'formal',
          language: 'fr',
        },
      },
    } as any;

    await processor.process(job);

    expect(languageToolService.check).not.toHaveBeenCalled();
    expect(geminiService.generateJson).toHaveBeenCalled();
    expect(aiJobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-2',
      expect.objectContaining({
        status: AiJobStatus.COMPLETED,
        result: { draft: 'Dear Sir...', keyPointsUsed: ['point one'] },
      }),
    );
  });

  it('marks the job as failed and rethrows when Gemini throws', async () => {
    languageToolService.check.mockResolvedValue([]);
    geminiService.generateJson.mockRejectedValue(
      new Error('AI response was not valid JSON'),
    );

    const job = {
      data: {
        aiJobId: 'job-3',
        type: AiJobType.CV_SUGGESTION,
        payload: {
          sectionType: SectionType.EXPERIENCE,
          content: {},
        },
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow(
      'AI response was not valid JSON',
    );

    expect(aiJobModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-3',
      expect.objectContaining({
        status: AiJobStatus.FAILED,
        error: 'AI response was not valid JSON',
      }),
    );
  });

  it('throws for an unknown job type without calling Gemini', async () => {
    const job = {
      data: {
        aiJobId: 'job-4',
        type: 'not-a-real-type',
        payload: {},
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow('Unknown AI job type');
    expect(geminiService.generateJson).not.toHaveBeenCalled();
  });
});
