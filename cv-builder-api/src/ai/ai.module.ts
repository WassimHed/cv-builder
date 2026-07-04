import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProcessor } from './processors/ai.processor';
import { GeminiService } from './gemini/gemini.service';
import { LanguageToolService } from './grammar/languagetool.service';
import { AiJob, AiJobSchema } from './schemas/ai-job.schema';
import { AI_QUEUE } from './constants/ai.constants';
import { CvModule } from '../cv/cv.module';
import { LettersModule } from '../letters/letters.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: AI_QUEUE }),
    MongooseModule.forFeature([{ name: AiJob.name, schema: AiJobSchema }]),
    forwardRef(() => CvModule),
    forwardRef(() => LettersModule),
  ],
  controllers: [AiController],
  providers: [AiService, AiProcessor, GeminiService, LanguageToolService],
  exports: [AiService],
})
export class AiModule {}
