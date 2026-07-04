import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { LanguageToolService } from './languagetool.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LanguageToolService', () => {
  let service: LanguageToolService;

  beforeEach(async () => {
    mockedAxios.post.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LanguageToolService],
    }).compile();

    service = module.get<LanguageToolService>(LanguageToolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('maps matches from a successful response', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        matches: [
          {
            message: 'Possible spelling mistake found',
            offset: 5,
            length: 4,
            replacements: [
              { value: 'their' },
              { value: 'there' },
              { value: 'they' },
            ],
            context: { text: 'over their house' },
          },
        ],
      },
    });

    const result = await service.check('some text', 'en');

    expect(result).toEqual([
      {
        message: 'Possible spelling mistake found',
        offset: 5,
        length: 4,
        replacements: ['their', 'there', 'they'],
        context: 'over their house',
      },
    ]);
  });

  it('caps replacements at 3 even if more are returned', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        matches: [
          {
            message: 'msg',
            offset: 0,
            length: 1,
            replacements: [
              { value: 'a' },
              { value: 'b' },
              { value: 'c' },
              { value: 'd' },
            ],
          },
        ],
      },
    });

    const result = await service.check('text');

    expect(result[0].replacements).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when there are no matches', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });

    const result = await service.check('clean text');

    expect(result).toEqual([]);
  });

  it('fails soft and returns an empty array on network error', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.check('some text');

    expect(result).toEqual([]);
  });
});
