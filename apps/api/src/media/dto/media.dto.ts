import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MediaUploadResultDto {
  @ApiProperty({
    example: 'http://192.168.4.47:9000/pantrio-media/recipes/abc.jpg',
    description: 'Public URL clients should store on Recipe.imageUrl / Food.imageUrl',
  })
  url!: string;

  @ApiProperty({ example: 'recipes/cmxyz-abc.jpg' })
  key!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  contentType?: string;

  @ApiPropertyOptional({ example: 128000 })
  size?: number;
}
