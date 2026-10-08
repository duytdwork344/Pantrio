import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import type { MediaUploadResultDto } from './dto/media.dto';

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Short demo clips — raise later with presign / HLS. */
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

@Injectable()
export class MediaService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKeyId =
      this.config.get<string>('S3_ACCESS_KEY') ?? 'pantrio';
    const secretAccessKey =
      this.config.get<string>('S3_SECRET_KEY') ?? 'pantriodev';

    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'pantrio-media';
    this.publicBase = (
      this.config.get<string>('S3_PUBLIC_BASE_URL') ?? endpoint
    ).replace(/\/$/, '');

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'recipes',
  ): Promise<MediaUploadResultDto> {
    return this.upload(file, folder, 'image');
  }

  async uploadVideo(
    file: Express.Multer.File,
    folder = 'recipes',
  ): Promise<MediaUploadResultDto> {
    return this.upload(file, folder, 'video');
  }

  private async upload(
    file: Express.Multer.File,
    folder: string,
    kind: 'image' | 'video',
  ): Promise<MediaUploadResultDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }

    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large (max ${maxBytes / (1024 * 1024)}MB)`,
      );
    }

    const contentType = (file.mimetype || '').toLowerCase();
    const allowed = kind === 'video' ? VIDEO_MIME : IMAGE_MIME;
    if (!allowed.has(contentType)) {
      throw new BadRequestException(
        kind === 'video'
          ? 'Only mp4, webm, or mov videos are allowed'
          : 'Only jpeg, png, or webp images are allowed',
      );
    }

    const ext = this.extensionFor(contentType, file.originalname, kind);
    const key = `${folder.replace(/\/$/, '')}/${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      throw new ServiceUnavailableException(
        `Could not store ${kind} in object storage: ${message}`,
      );
    }

    return {
      url: `${this.publicBase}/${this.bucket}/${key}`,
      key,
      contentType,
      size: file.size,
    };
  }

  private extensionFor(
    contentType: string,
    originalName: string | undefined,
    kind: 'image' | 'video',
  ): string {
    if (contentType === 'image/png') return '.png';
    if (contentType === 'image/webp') return '.webp';
    if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
      return '.jpg';
    }
    if (contentType === 'video/mp4') return '.mp4';
    if (contentType === 'video/webm') return '.webm';
    if (contentType === 'video/quicktime') return '.mov';

    const fromName = extname(originalName ?? '').toLowerCase();
    if (kind === 'video') {
      if (['.mp4', '.webm', '.mov'].includes(fromName)) return fromName;
      return '.mp4';
    }
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(fromName)) {
      return fromName === '.jpeg' ? '.jpg' : fromName;
    }
    return '.jpg';
  }
}
