import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MotivationLetter } from './schemas/motivation-letter.schema';
import { CreateMotivationLetterDto } from './dto/create-motivation-letter.dto';
import { UpdateMotivationLetterDto } from './dto/update-motivation-letter.dto';
import { UsersService } from '../users/users.service';
import { CvService } from '../cv/cv.service';
import { StorageService } from '../storage/storage.service';
import { StorageBackend } from '../storage/interfaces/storage-backend.enum';

@Injectable()
export class LettersService {
  constructor(
    @InjectModel(MotivationLetter.name)
    private readonly letterModel: Model<MotivationLetter>,
    private readonly usersService: UsersService,
    private readonly cvService: CvService,
    private readonly storageService: StorageService,
  ) {}

  private toPlain(letter: MotivationLetter): MotivationLetter {
    return letter.toJSON() as MotivationLetter;
  }

  private async findOneDocument(
    id: string,
    userId: string,
  ): Promise<MotivationLetter> {
    const letter = await this.letterModel.findOne({ _id: id, userId }).exec();
    if (!letter) throw new NotFoundException('Motivation letter not found');
    return letter;
  }

  async create(
    userId: string,
    dto: CreateMotivationLetterDto,
  ): Promise<MotivationLetter> {
    await this.usersService.findById(userId);

    if (dto.cvId) {
      await this.cvService.findOne(dto.cvId, userId);
    }

    const created = new this.letterModel({ ...dto, userId });
    const saved = await created.save();
    return this.toPlain(saved);
  }

  async findAllByUser(userId: string): Promise<MotivationLetter[]> {
    const letters = await this.letterModel.find({ userId }).exec();
    return letters.map((letter) => this.toPlain(letter));
  }

  async findOne(id: string, userId: string): Promise<MotivationLetter> {
    const letter = await this.findOneDocument(id, userId);
    return this.toPlain(letter);
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
    return this.toPlain(letter);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.letterModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('Motivation letter not found');
  }

  async uploadPdf(
    letterId: string,
    userId: string,
    buffer: Buffer,
  ): Promise<MotivationLetter> {
    const letter = await this.findOneDocument(letterId, userId);
    const key = `letter-pdfs/${letterId}.pdf`;

    const { backend } = await this.storageService.upload(
      key,
      buffer,
      'application/pdf',
    );

    letter.pdfKey = key;
    letter.pdfBackend = backend;
    const saved = await letter.save();
    return this.toPlain(saved);
  }

  async downloadPdf(
    letterId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const letter = await this.findOneDocument(letterId, userId);

    if (!letter.pdfKey || !letter.pdfBackend) {
      throw new NotFoundException('This letter has no generated PDF yet');
    }

    const buffer = await this.storageService.download(
      letter.pdfKey,
      letter.pdfBackend as StorageBackend,
    );
    const filename = letter.targetCompany
      ? `Letter - ${letter.targetCompany}.pdf`
      : 'Motivation Letter.pdf';

    return { buffer, filename };
  }
}