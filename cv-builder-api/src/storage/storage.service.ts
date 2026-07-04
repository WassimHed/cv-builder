import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageBackend } from './interfaces/storage-backend.enum';

export interface UploadResult {
  backend: StorageBackend;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly minioProvider: MinioStorageProvider,
    private readonly localProvider: LocalStorageProvider,
  ) {}

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    try {
      await this.minioProvider.upload(key, buffer, contentType);
      return { backend: StorageBackend.MINIO };
    } catch (error) {
      this.logger.warn(
        `MinIO upload failed for key "${key}", falling back to local disk: ${(error as Error).message}`,
      );
      await this.localProvider.upload(key, buffer, contentType);
      return { backend: StorageBackend.LOCAL };
    }
  }

  async download(key: string, backend: StorageBackend): Promise<Buffer> {
    const provider = this.resolveProvider(backend);
    return provider.download(key);
  }

  async delete(key: string, backend: StorageBackend): Promise<void> {
    const provider = this.resolveProvider(backend);
    await provider.delete(key);
  }

  private resolveProvider(backend: StorageBackend) {
    switch (backend) {
      case StorageBackend.MINIO:
        return this.minioProvider;
      case StorageBackend.LOCAL:
        return this.localProvider;
      default:
        throw new BadRequestException(
          `Unknown storage backend: ${backend as string}`,
        );
    }
  }
}
