import { Test, TestingModule } from '@nestjs/testing';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';

describe('LettersController', () => {
  let controller: LettersController;
  let lettersService: {
    create: jest.Mock;
    findAllByUser: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    lettersService = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LettersController],
      providers: [
        {
          provide: LettersService,
          useValue: lettersService,
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
    controller.update(
      { userId: 'user-1' },
      'letter-1',
      { targetRole: 'Senior Developer' },
    );
    controller.remove({ userId: 'user-1' }, 'letter-1');

    expect(lettersService.findAllByUser).toHaveBeenCalledWith('user-1');
    expect(lettersService.findOne).toHaveBeenCalledWith('letter-1', 'user-1');
    expect(lettersService.update).toHaveBeenCalledWith('letter-1', 'user-1', {
      targetRole: 'Senior Developer',
    });
    expect(lettersService.remove).toHaveBeenCalledWith('letter-1', 'user-1');
  });
});