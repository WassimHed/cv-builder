import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CvService } from './cv.service';
import { UsersService } from '../users/users.service';
import { SectionType } from './schemas/cv.schema';
import { StorageService } from '../storage/storage.service';

describe('CvService', () => {
  let service: CvService;
  let cvModel: jest.Mock & {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let usersService: {
    findById: jest.Mock;
  };
  let storageService: {
    upload: jest.Mock;
    download: jest.Mock;
  };

  const makeCvDocument = (plain: Record<string, unknown>) => {
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

      const rawId = rest._id;
      const serializedId =
        typeof rawId === 'object' &&
        rawId !== null &&
        typeof (rawId as { toString?: unknown }).toString === 'function'
          ? (rawId as { toString: () => string }).toString()
          : String(rawId ?? 'cv-1');

      return {
        ...rest,
        _id: serializedId,
      };
    });

    doc.save = jest.fn(async () => doc);

    return doc;
  };

  beforeEach(async () => {
    cvModel = jest.fn().mockImplementation((doc) => ({
      ...makeCvDocument({ _id: 'cv-1', ...doc }),
    })) as jest.Mock & {
      find: jest.Mock;
      findOne: jest.Mock;
      findOneAndUpdate: jest.Mock;
      deleteOne: jest.Mock;
    };

    cvModel.find = jest.fn();
    cvModel.findOne = jest.fn();
    cvModel.findOneAndUpdate = jest.fn();
    cvModel.deleteOne = jest.fn();

    usersService = {
      findById: jest.fn(),
    };

    storageService = {
      upload: jest.fn(),
      download: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvService,
        {
          provide: getModelToken('Cv'),
          useValue: cvModel,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<CvService>(CvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a cv after checking the user exists', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });

    const result = await service.create('user-1', {
      title: 'Frontend CV',
      sections: [],
    });

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(cvModel).toHaveBeenCalledWith({
      title: 'Frontend CV',
      sections: [],
      userId: 'user-1',
    });
    expect(result).toEqual({
      _id: 'cv-1',
      title: 'Frontend CV',
      sections: [],
      userId: 'user-1',
    });
  });

  it('adds a section after validating the section content', async () => {
    const cv = makeCvDocument({
      _id: 'cv-1',
      userId: 'user-1',
      title: 'Frontend CV',
      sections: [] as Array<{
        type: SectionType;
        order: number;
        content: unknown;
      }>,
    });

    cvModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cv) });
    jest
      .spyOn(service as any, 'validateSectionContent')
      .mockResolvedValue(undefined);

    const result = await service.addSection('cv-1', 'user-1', {
      type: SectionType.SKILLS,
      order: 0,
      content: {
        skills: ['NestJS'],
      },
    });

    expect(result).toMatchObject({
      _id: 'cv-1',
      userId: 'user-1',
      title: 'Frontend CV',
    });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toEqual({
      type: SectionType.SKILLS,
      order: 0,
      content: {
        skills: ['NestJS'],
      },
    });
    expect(cv.save as jest.Mock).toHaveBeenCalled();
  });

  it('returns plain JSON for created and fetched CVs', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    const expectedHexId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const existingCv = makeCvDocument({
      _id: {
        toString: () => expectedHexId,
      },
      userId: 'user-1',
      title: 'Backend CV',
      sections: [],
    });

    cvModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingCv),
    });

    const created = await service.create('user-1', {
      title: 'Frontend CV',
      sections: [],
    });
    const fetched = await service.findOne('cv-2', 'user-1');

    expect(created).not.toHaveProperty('$__');
    expect(created).not.toHaveProperty('_doc');
    expect(created).not.toHaveProperty('$isNew');
    expect(typeof (created as Record<string, unknown>)._id).toBe('string');

    expect(fetched).not.toHaveProperty('$__');
    expect(fetched).not.toHaveProperty('_doc');
    expect(fetched).not.toHaveProperty('$isNew');
    expect(typeof (fetched as Record<string, unknown>)._id).toBe('string');
    expect((fetched as Record<string, unknown>)._id).toBe(expectedHexId);

    const serialized = JSON.stringify(fetched);
    expect(serialized).toContain(`"_id":"${expectedHexId}"`);
    expect(serialized).not.toContain('"buffer"');
  });
});
