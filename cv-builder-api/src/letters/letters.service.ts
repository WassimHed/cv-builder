import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MotivationLetter } from './schemas/motivation-letter.schema';
import { CreateMotivationLetterDto } from './dto/create-motivation-letter.dto';
import { UpdateMotivationLetterDto } from './dto/update-motivation-letter.dto';
import { UsersService } from '../users/users.service';
import { CvService } from '../cv/cv.service';

@Injectable()
export class LettersService {
  constructor(
    @InjectModel(MotivationLetter.name)
    private readonly letterModel: Model<MotivationLetter>,
    private readonly usersService: UsersService,
    private readonly cvService: CvService,
  ) {}

  async create(
    userId: string,
    dto: CreateMotivationLetterDto,
  ): Promise<MotivationLetter> {
    await this.usersService.findById(userId);

    if (dto.cvId) {
      await this.cvService.findOne(dto.cvId, userId);
    }

    const created = new this.letterModel({ ...dto, userId });
    return created.save();
  }

  async findAllByUser(userId: string): Promise<MotivationLetter[]> {
    return this.letterModel.find({ userId }).exec();
  }

  async findOne(id: string, userId: string): Promise<MotivationLetter> {
    const letter = await this.letterModel.findOne({ _id: id, userId }).exec();
    if (!letter) throw new NotFoundException('Motivation letter not found');
    return letter;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateMotivationLetterDto,
  ): Promise<MotivationLetter> {
    if (dto.cvId) {
      await this.cvService.findOne(dto.cvId, userId);
    }

    const letter = await this.letterModel
      .findOneAndUpdate({ _id: id, userId }, dto, { new: true })
      .exec();
    if (!letter) throw new NotFoundException('Motivation letter not found');
    return letter;
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.letterModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('Motivation letter not found');
  }
}