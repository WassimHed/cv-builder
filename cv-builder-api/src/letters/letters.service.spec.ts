import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { LettersService } from './letters.service';
import { UsersService } from '../users/users.service';
import { CvService } from '../cv/cv.service';
import { StorageService } from '../storage/storage.service';
import { StorageBackend } from '../storage/interfaces/storage-backend.enum';

describe('LettersService', () => {
  let service: LettersService;
  let letterModel: jest.Mock & {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let usersService: {
    findById: jest.Mock;
  };
  let cvService: {
    findOne: jest.Mock;
  };
  let storageService: {
    upload: jest.Mock;
    download: jest.Mock;
  };

  const makeLetterDocument = (plain: Record<string, unknown>) => {
    const doc: Record<string, unknown> = {
      ...plain,
      $__: { tracked: true },
      _doc: { ...plain },
      $isNew: false,
    };

    doc.toJSON = jest.fn(() => {
      const {
        $__: _,
        _doc: __,
        $isNew: ___,
        save: ____,
        toJSON: _____,
        ...rest
      } = doc;
      return {
        ...rest,
        _id: String(rest._id ?? 'letter-1'),
      };
    });

    doc.save = jest.fn(async () => doc);
    return doc;
  };

  beforeEach(async () => {
    letterModel = jest.fn().mockImplementation((doc) => ({
      ...makeLetterDocument({ _id: 'letter-1', ...doc }),
    })) as jest.Mock & {
      find: jest.Mock;
      findOne: jest.Mock;
      findOneAndUpdate: jest.Mock;
      deleteOne: jest.Mock;
    };

    letterModel.find = jest.fn();
    letterModel.findOne = jest.fn();
    letterModel.findOneAndUpdate = jest.fn();
    letterModel.deleteOne = jest.fn();

    usersService = {
      findById: jest.fn(),
    };

    cvService = {
      findOne: jest.fn(),
    };

    storageService = {
      upload: jest.fn(),
      download: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LettersService,
        {
          provide: getModelToken('MotivationLetter'),
          useValue: letterModel,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: CvService,
          useValue: cvService,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<LettersService>(LettersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a standalone letter without cvId', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });

    const result = await service.create('user-1', {
      content: 'Cover letter content',
    });

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(cvService.findOne).not.toHaveBeenCalled();
    expect(letterModel).toHaveBeenCalledWith({
      content: 'Cover letter content',
      userId: 'user-1',
    });
    expect(result).toEqual({
      _id: 'letter-1',
      content: 'Cover letter content',
      userId: 'user-1',
    });
  });

  it('creates a letter linked to an owned cv', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    cvService.findOne.mockResolvedValue({ id: 'cv-1' });

    const result = await service.create('user-1', {
      cvId: 'cv-1',
      content: 'Cover letter content',
    });

    expect(cvService.findOne).toHaveBeenCalledWith('cv-1', 'user-1');
    expect(letterModel).toHaveBeenCalledWith({
      cvId: 'cv-1',
      content: 'Cover letter content',
      userId: 'user-1',
    });
    expect(result).toEqual({
      _id: 'letter-1',
      cvId: 'cv-1',
      content: 'Cover letter content',
      userId: 'user-1',
    });
  });

  it('rejects when the cv reference is not owned', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    cvService.findOne.mockRejectedValue(new NotFoundException('CV not found'));

    await expect(
      service.create('user-1', {
        cvId: 'cv-1',
        content: 'Cover letter content',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(letterModel).not.toHaveBeenCalled();
  });

  it('uploads a PDF using the letter key namespace', async () => {
    const letter = makeLetterDocument({
      _id: 'letter-1',
      userId: 'user-1',
      content: 'Cover letter content',
    });

    letterModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(letter),
    });
    storageService.upload.mockResolvedValue({ backend: StorageBackend.LOCAL });

    const result = await service.uploadPdf(
      'letter-1',
      'user-1',
      Buffer.from('pdf-bytes'),
    );

    expect(storageService.upload).toHaveBeenCalledWith(
      'letter-pdfs/letter-1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(letter.save as jest.Mock).toHaveBeenCalled();
    expect(result).toMatchObject({
      _id: 'letter-1',
      pdfKey: 'letter-pdfs/letter-1.pdf',
      pdfBackend: StorageBackend.LOCAL,
    });
  });

  it('downloads a PDF and returns filename using target company when present', async () => {
    const letter = makeLetterDocument({
      _id: 'letter-1',
      userId: 'user-1',
      content: 'Cover letter content',
      targetCompany: 'Acme',
      pdfKey: 'letter-pdfs/letter-1.pdf',
      pdfBackend: StorageBackend.MINIO,
    });

    letterModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(letter),
    });
    storageService.download.mockResolvedValue(Buffer.from('pdf-bytes'));

    const result = await service.downloadPdf('letter-1', 'user-1');

    expect(storageService.download).toHaveBeenCalledWith(
      'letter-pdfs/letter-1.pdf',
      StorageBackend.MINIO,
    );
    expect(result).toEqual({
      buffer: Buffer.from('pdf-bytes'),
      filename: 'Letter - Acme.pdf',
    });
  });
});
