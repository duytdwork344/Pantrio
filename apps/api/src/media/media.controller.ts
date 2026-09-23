import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MediaUploadResultDto } from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload an image (multipart form-data). Returns a public URL for Recipe.imageUrl / Food.imageUrl.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Object key prefix (default: recipes)',
    example: 'recipes',
  })
  @ApiOkResponse({ type: MediaUploadResultDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ): Promise<MediaUploadResultDto> {
    if (!file) {
      throw new BadRequestException('file field is required');
    }
    const safeFolder = (folder?.trim() || 'recipes').replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    );
    return this.mediaService.uploadImage(file, safeFolder || 'recipes');
  }
}
