import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';
import { ProfilesService } from './profiles.service';

const MAX_DIMENSION = 512;
const OUTPUT_CONTENT_TYPE = 'image/webp';

@Injectable()
export class AvatarsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly profilesService: ProfilesService,
  ) {}

  /**
   * Validates the upload is a real, decodable image (not just trusting
   * the declared Content-Type), resizes/crops it to a fixed square,
   * strips EXIF metadata, and re-encodes to WebP.
   *
   * NOTE: avatars aren't sensitive data — unlike CV/letter PDFs, they
   * could reasonably be served via a public URL/CDN instead of
   * proxying through this app. Kept as an authenticated proxy for now
   * to match the existing StorageService pattern; worth revisiting if
   * this app ever needs to scale avatar serving.
   */
  async uploadAvatar(userId: string, buffer: Buffer): Promise<void> {
    let processed: Buffer;
    try {
      processed = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('File is not a valid image');
    }

    const existing = await this.profilesService.getAvatarLocation(userId);

    const key = `avatars/${userId}.webp`;
    const result = await this.storageService.upload(
      key,
      processed,
      OUTPUT_CONTENT_TYPE,
    );

    await this.profilesService.setAvatarLocation(userId, key, result.backend);

    // Deterministic key means a same-backend upload already overwrote
    // the old file in place. But if the backend changed between
    // uploads (e.g. MinIO was briefly down and it fell back to local
    // disk), the old file on the previous backend is now orphaned —
    // clean it up explicitly in that case.
    if (existing && existing.backend !== result.backend) {
      await this.storageService.delete(existing.key, existing.backend);
    }
  }

  async getAvatar(
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const location = await this.profilesService.getAvatarLocation(userId);
    if (!location) {
      throw new NotFoundException('No avatar set');
    }
    const buffer = await this.storageService.download(
      location.key,
      location.backend,
    );
    return { buffer, contentType: OUTPUT_CONTENT_TYPE };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const location = await this.profilesService.getAvatarLocation(userId);
    if (!location) {
      throw new NotFoundException('No avatar set');
    }
    await this.storageService.delete(location.key, location.backend);
    await this.profilesService.clearAvatar(userId);
  }
}
