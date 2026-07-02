import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

@Module({
  providers: [StorageService, MinioStorageProvider, LocalStorageProvider],
  exports: [StorageService],
})
export class StorageModule {}
