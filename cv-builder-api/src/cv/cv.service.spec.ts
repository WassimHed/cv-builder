import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CvService } from './cv.service';
import { UsersService } from '../users/users.service';
import { SectionType } from './schemas/cv.schema';

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

  beforeEach(async () => {
    const save = jest.fn().mockResolvedValue({ id: 'cv-1' });
    cvModel = jest.fn().mockImplementation((doc) => ({
      ...doc,
      save,
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
    expect(result).toEqual({ id: 'cv-1' });
  });

  it('adds a section after validating the section content', async () => {
    const save = jest.fn().mockResolvedValue({ id: 'cv-1' });
    const cv = {
      sections: [] as Array<{ type: SectionType; order: number; content: unknown }>,
      save,
    };

    cvModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cv) });
    jest.spyOn(service as any, 'validateSectionContent').mockResolvedValue(undefined);

    const result = await service.addSection('cv-1', 'user-1', {
      type: SectionType.SKILLS,
      order: 0,
      content: {
        skills: ['NestJS'],
      },
    });

    expect(result).toEqual({ id: 'cv-1' });
    expect(cv.sections).toHaveLength(1);
    expect(cv.sections[0]).toEqual({
      type: SectionType.SKILLS,
      order: 0,
      content: {
        skills: ['NestJS'],
      },
    });
    expect(save).toHaveBeenCalled();
  });
});
