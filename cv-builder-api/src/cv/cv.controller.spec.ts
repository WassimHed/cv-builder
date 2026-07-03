import { Test, TestingModule } from '@nestjs/testing';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfStatus } from '../common/pdf-status.enum';

describe('CvController', () => {
  let controller: CvController;
  let cvService: {
    create: jest.Mock;
    findAllByUser: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    addSection: jest.Mock;
    uploadPdf: jest.Mock;
    downloadPdf: jest.Mock;
  };
  let pdfService: {
    enqueueCvGeneration: jest.Mock;
    getCvStatus: jest.Mock;
  };

  beforeEach(async () => {
    cvService = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addSection: jest.fn(),
      uploadPdf: jest.fn(),
      downloadPdf: jest.fn(),
    };
    pdfService = {
      enqueueCvGeneration: jest.fn(),
      getCvStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CvController],
      providers: [
        {
          provide: CvService,
          useValue: cvService,
        },
        {
          provide: PdfService,
          useValue: pdfService,
        },
      ],
    }).compile();

    controller = module.get<CvController>(CvController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('queues PDF generation through the PDF service', async () => {
    await expect(
      controller.generatePdf('cv-1', { userId: 'user-1' } as any),
    ).resolves.toEqual({ status: 'queued' });

    expect(pdfService.enqueueCvGeneration).toHaveBeenCalledWith(
      'cv-1',
      'user-1',
    );
  });

  it('returns the PDF status through the PDF service', async () => {
    pdfService.getCvStatus.mockResolvedValue(PdfStatus.PROCESSING);

    await expect(
      controller.getPdfStatus('cv-1', { userId: 'user-1' } as any),
    ).resolves.toEqual({ status: PdfStatus.PROCESSING });

    expect(pdfService.getCvStatus).toHaveBeenCalledWith('cv-1', 'user-1');
  });
});