import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cv, CvSchema } from './schemas/cv.schema';
import { CvService } from './cv.service';
import { CvController } from './cv.controller';
import { UsersModule } from '../users/users.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cv.name, schema: CvSchema }]),
    UsersModule,
    StorageModule,
  ],
  controllers: [CvController],
  providers: [CvService],
  exports: [CvService],
})
export class CvModule {}
