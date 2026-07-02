import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageProvider } from '../interfaces/storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      endPoint: this.configService.getOrThrow<string>('MINIO_ENDPOINT'),
      port: this.configService.getOrThrow<number>('MINIO_API_PORT'),
      useSSL: false,
      accessKey: this.configService.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: this.configService.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });
    this.bucket = this.configService.getOrThrow<string>('MINIO_BUCKET');
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const exists = await this.client
      .bucketExists(this.bucket)
      .catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
