import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfStatus } from '../common/pdf-status.enum';

describe('LettersController', () => {
  let controller: LettersController;
  let lettersService: {
    create: jest.Mock;
    findAllByUser: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    uploadPdf: jest.Mock;
    downloadPdf: jest.Mock;
  };
  let pdfService: {
    enqueueLetterGeneration: jest.Mock;
    getLetterStatus: jest.Mock;
  };

  beforeEach(async () => {
    lettersService = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadPdf: jest.fn(),
      downloadPdf: jest.fn(),
    };
    pdfService = {
      enqueueLetterGeneration: jest.fn(),
      getLetterStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LettersController],
      providers: [
        {
          provide: LettersService,
          useValue: lettersService,
        },
        {
          provide: PdfService,
          useValue: pdfService,
        },
      ],
    }).compile();

    controller = module.get<LettersController>(LettersController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards create requests to the service with the current user', () => {
    controller.create(
      { userId: 'user-1' },
      {
        content: 'Cover letter content',
      },
    );

    expect(lettersService.create).toHaveBeenCalledWith('user-1', {
      content: 'Cover letter content',
    });
  });

  it('forwards cv-linked create requests to the service', () => {
    controller.create(
      { userId: 'user-1' },
      {
        cvId: 'cv-1',
        content: 'Cover letter content',
      },
    );

    expect(lettersService.create).toHaveBeenCalledWith('user-1', {
      cvId: 'cv-1',
      content: 'Cover letter content',
    });
  });

  it('forwards reads and mutations to the service', () => {
    controller.findAll({ userId: 'user-1' });
    controller.findOne({ userId: 'user-1' }, 'letter-1');
    controller.update({ userId: 'user-1' }, 'letter-1', {
      targetRole: 'Senior Developer',
    });
    controller.remove({ userId: 'user-1' }, 'letter-1');

    expect(lettersService.findAllByUser).toHaveBeenCalledWith('user-1');
    expect(lettersService.findOne).toHaveBeenCalledWith('letter-1', 'user-1');
    expect(lettersService.update).toHaveBeenCalledWith('letter-1', 'user-1', {
      targetRole: 'Senior Developer',
    });
    expect(lettersService.remove).toHaveBeenCalledWith('letter-1', 'user-1');
  });

  it('rejects upload when no file is provided', async () => {
    await expect(
      controller.uploadPdf({ userId: 'user-1' }, 'letter-1', undefined as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects upload when file is not a PDF', async () => {
    await expect(
      controller.uploadPdf({ userId: 'user-1' }, 'letter-1', {
        mimetype: 'image/png',
        buffer: Buffer.from('bytes'),
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  it('forwards PDF upload to the service', async () => {
    const file = {
      mimetype: 'application/pdf',
      buffer: Buffer.from('bytes'),
    } as Express.Multer.File;

    await controller.uploadPdf({ userId: 'user-1' }, 'letter-1', file);

    expect(lettersService.uploadPdf).toHaveBeenCalledWith(
      'letter-1',
      'user-1',
      file.buffer,
    );
  });

  it('sets response headers and sends buffer on PDF download', async () => {
    const buffer = Buffer.from('pdf-bytes');
    lettersService.downloadPdf.mockResolvedValue({
      buffer,
      filename: 'Motivation Letter.pdf',
    });

    const res = {
      set: jest.fn(),
      send: jest.fn(),
    } as any;

    await controller.downloadPdf({ userId: 'user-1' }, 'letter-1', res);

    expect(lettersService.downloadPdf).toHaveBeenCalledWith(
      'letter-1',
      'user-1',
    );
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Motivation Letter.pdf"',
    });
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('queues PDF generation through the PDF service', async () => {
    await expect(
      controller.generatePdf('letter-1', { userId: 'user-1' } as any),
    ).resolves.toEqual({ status: 'queued' });

    expect(pdfService.enqueueLetterGeneration).toHaveBeenCalledWith(
      'letter-1',
      'user-1',
    );
  });

  it('returns the PDF status through the PDF service', async () => {
    pdfService.getLetterStatus.mockResolvedValue(PdfStatus.READY);

    await expect(
      controller.getPdfStatus('letter-1', { userId: 'user-1' } as any),
    ).resolves.toEqual({ status: PdfStatus.READY });

    expect(pdfService.getLetterStatus).toHaveBeenCalledWith(
      'letter-1',
      'user-1',
    );
  });
});
