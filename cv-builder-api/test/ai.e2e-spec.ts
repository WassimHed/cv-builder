import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GeminiService } from '../src/ai/gemini/gemini.service';
import { LanguageToolService } from '../src/ai/grammar/languagetool.service';
import { SectionType } from '../src/cv/schemas/cv.schema';

describe('AI module (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let cvId: string;

  const geminiMock = { generateJson: jest.fn() };
  const languageToolMock = { check: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GeminiService)
      .useValue(geminiMock)
      .overrideProvider(LanguageToolService)
      .useValue(languageToolMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const uniqueEmail = `ai-e2e-${Date.now()}@example.com`;

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail,
        password: 'StrongPassword123!',
        firstName: 'AI',
        lastName: 'Tester',
      })
      .expect(201);

    accessToken = registerRes.body.accessToken;

    const cvRes = await request(app.getHttpServer())
      .post('/cv')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'E2E Test CV',
        targetRole: 'Full Stack Developer',
        sections: [
          {
            type: SectionType.EXPERIENCE,
            order: 0,
            content: {
              company: 'Acme Corp',
              role: 'Developer',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
              bullets: ['Did a thing', 'Did another thing'],
            },
          },
        ],
      })
      .expect(201);

    cvId = cvRes.body._id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    geminiMock.generateJson.mockReset();
    languageToolMock.check.mockClear();
  });

  describe('CV suggestions flow', () => {
    it('requests suggestions, polls to completion, and accepts them into the CV', async () => {
      geminiMock.generateJson.mockResolvedValue({
        suggestions: [
          {
            original: 'Did a thing',
            improved: 'Accomplished a thing',
            reason: 'stronger verb',
          },
        ],
      });

      const requestRes = await request(app.getHttpServer())
        .post(`/ai/cv/${cvId}/suggestions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sectionType: SectionType.EXPERIENCE,
          content: {
            company: 'Acme Corp',
            role: 'Developer',
            bullets: ['Did a thing', 'Did another thing'],
          },
          language: 'en',
        })
        .expect(201);

      const jobId = requestRes.body.jobId;
      expect(requestRes.body.status).toBe('pending');

      let job: any;
      for (let i = 0; i < 20; i++) {
        const statusRes = await request(app.getHttpServer())
          .get(`/ai/jobs/${jobId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        job = statusRes.body;
        if (job.status === 'completed' || job.status === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      expect(job.status).toBe('completed');
      expect(job.result.suggestions).toHaveLength(1);

      const acceptRes = await request(app.getHttpServer())
        .post(`/ai/jobs/${jobId}/accept-cv-suggestion`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      const updatedSection = acceptRes.body.sections.find(
        (s: any) => s.type === SectionType.EXPERIENCE,
      );
      expect(updatedSection.content.bullets).toContain('Accomplished a thing');
    });

    it('rejects requests without a valid auth token', async () => {
      await request(app.getHttpServer())
        .post(`/ai/cv/${cvId}/suggestions`)
        .send({ sectionType: SectionType.EXPERIENCE, content: {} })
        .expect(401);
    });
  });

  describe('Letter draft flow', () => {
    it('requests a draft from a CV, polls to completion, and accepting creates a new letter', async () => {
      geminiMock.generateJson.mockResolvedValue({
        draft: 'Dear Sir or Madam, I am writing to apply...',
        keyPointsUsed: ['Experience at Acme Corp'],
      });

      const requestRes = await request(app.getHttpServer())
        .post(`/ai/cv/${cvId}/letter-draft`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          programName: 'Master in Computer Science',
          targetCompany: 'Test University',
          tone: 'formal',
          language: 'en',
        })
        .expect(201);

      const jobId = requestRes.body.jobId;

      let job: any;
      for (let i = 0; i < 20; i++) {
        const statusRes = await request(app.getHttpServer())
          .get(`/ai/jobs/${jobId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        job = statusRes.body;
        if (job.status === 'completed' || job.status === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      expect(job.status).toBe('completed');
      expect(job.result.draft).toContain('Dear Sir or Madam');

      const acceptRes = await request(app.getHttpServer())
        .post(`/ai/jobs/${jobId}/accept-letter`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(acceptRes.body.cvId).toBe(cvId);
      expect(acceptRes.body.targetCompany).toBe('Test University');
      expect(acceptRes.body.content).toContain('Dear Sir or Madam');
    });
  });
});
