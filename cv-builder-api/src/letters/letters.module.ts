import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MotivationLetter,
  MotivationLetterSchema,
} from './schemas/motivation-letter.schema';
import { LettersService } from './letters.service';
import { LettersController } from './letters.controller';
import { UsersModule } from '../users/users.module';
import { CvModule } from '../cv/cv.module';
import { StorageModule } from '../storage/storage.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MotivationLetter.name, schema: MotivationLetterSchema },
    ]),
    UsersModule,
    forwardRef(() => CvModule),
    StorageModule,
    forwardRef(() => PdfModule),
  ],
  controllers: [LettersController],
  providers: [LettersService],
  exports: [LettersService],
})
export class LettersModule {}
