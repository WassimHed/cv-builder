// src/pdf/pdf.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PdfDocType, PdfJobData } from './pdf-job.types';
import { CvService } from '../cv/cv.service';
import { LettersService } from '../letters/letters.service';
import { PdfStatus } from '../common/pdf-status.enum';

@Injectable()
export class PdfService {
  constructor(
    @InjectQueue('pdf-generation') private readonly queue: Queue<PdfJobData>,
    private readonly cvService: CvService,
    private readonly lettersService: LettersService,
  ) {}

  async enqueueCvGeneration(cvId: string, userId: string): Promise<void> {
    await this.cvService.setPdfStatus(cvId, userId, PdfStatus.QUEUED);
    await this.queue.add('generate', {
      docType: PdfDocType.CV,
      docId: cvId,
      userId,
    });
  }

  async enqueueLetterGeneration(
    letterId: string,
    userId: string,
  ): Promise<void> {
    await this.lettersService.setPdfStatus(letterId, userId, PdfStatus.QUEUED);
    await this.queue.add('generate', {
      docType: PdfDocType.LETTER,
      docId: letterId,
      userId,
    });
  }

  async getCvStatus(cvId: string, userId: string): Promise<PdfStatus> {
    return (await this.cvService.findOne(cvId, userId)).pdfStatus;
  }

  async getLetterStatus(letterId: string, userId: string): Promise<PdfStatus> {
    return (await this.lettersService.findOne(letterId, userId)).pdfStatus;
  }
}
