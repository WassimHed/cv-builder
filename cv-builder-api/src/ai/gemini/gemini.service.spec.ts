import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(async () => {
    mockGenerateContent.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiService],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parses a clean JSON response', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"suggestions":[{"original":"a","improved":"b","reason":"c"}]}',
    });

    const result = await service.generateJson<{
      suggestions: Array<{
        original: string;
        improved: string;
        reason: string;
      }>;
    }>('some prompt');

    expect(result).toEqual({
      suggestions: [{ original: 'a', improved: 'b', reason: 'c' }],
    });
  });

  it('strips markdown json fences before parsing', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '```json\n{"draft":"hello"}\n```',
    });

    const result = await service.generateJson<{ draft: string }>('some prompt');

    expect(result).toEqual({ draft: 'hello' });
  });

  it('throws when the response is not valid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Sure! Here is your letter: Dear Sir...',
    });

    await expect(service.generateJson('some prompt')).rejects.toThrow(
      'AI response was not valid JSON',
    );
  });

  it('throws when response text is empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    await expect(service.generateJson('some prompt')).rejects.toThrow(
      'AI response was not valid JSON',
    );
  });
});
