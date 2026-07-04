import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import puppeteer from 'puppeteer';
import { PdfDocType, PdfJobData } from './pdf-job.types';
import { PdfStatus } from '../common/pdf-status.enum';
import { CvService } from '../cv/cv.service';
import { LettersService } from '../letters/letters.service';
import { renderCvTemplate } from './templates/cv.template';
import { renderLetterTemplate } from './templates/letter.template';

@Processor('pdf-generation')
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private readonly cvService: CvService,
    private readonly lettersService: LettersService,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>): Promise<void> {
    const { docType, docId, userId } = job.data;
    const service =
      docType === PdfDocType.CV ? this.cvService : this.lettersService;

    try {
      await service.setPdfStatus(docId, userId, PdfStatus.PROCESSING);

      let html: string;
      if (docType === PdfDocType.CV) {
        const cv = await this.cvService.findOne(docId, userId);
        html = renderCvTemplate(cv);
      } else {
        const letter = await this.lettersService.findOne(docId, userId);
        html = renderLetterTemplate(letter);
      }

      const buffer = await this.renderPdf(html);
      // uploadPdf() sets pdfKey/pdfBackend AND pdfStatus: READY internally
      await service.uploadPdf(docId, userId, buffer);
    } catch (err) {
      this.logger.error(
        `PDF generation failed for ${docType} ${docId}`,
        err as Error,
      );
      await service.setPdfStatus(docId, userId, PdfStatus.FAILED);
      throw err;
    }
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        }),
      );
    } finally {
      await browser.close();
    }
  }
}
