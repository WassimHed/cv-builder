import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

describe('StorageService (integration)', () => {
  let service: StorageService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [StorageService, MinioStorageProvider, LocalStorageProvider],
    }).compile();
    service = module.get(StorageService);
  });

  it('uploads to MinIO and downloads it back', async () => {
    const buffer = Buffer.from('hello world');
    const result = await service.upload('test/hello.txt', buffer, 'text/plain');
    expect(result.backend).toBe('minio');

    const downloaded = await service.download('test/hello.txt', result.backend);
    expect(downloaded.toString()).toBe('hello world');
  });
});
