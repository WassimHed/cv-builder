// src/pdf/pdf.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CvModule } from '../cv/cv.module';
import { LettersModule } from '../letters/letters.module';
import { PdfService } from './pdf.service';
import { PdfProcessor } from './pdf.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('BULL_REDIS_HOST'),
          port: config.get<number>('BULL_REDIS_PORT'),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'pdf-generation' }),
    forwardRef(() => CvModule),
    forwardRef(() => LettersModule),
  ],
  providers: [PdfService, PdfProcessor],
  exports: [PdfService],
})
export class PdfModule {}
