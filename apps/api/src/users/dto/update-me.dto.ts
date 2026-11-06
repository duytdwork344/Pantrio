import { ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '@pantrio/shared';
import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    nullable: true,
    description: 'Preferred locale; null = follow Accept-Language / device',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(SUPPORTED_LOCALES)
  locale?: string | null;

  @ApiPropertyOptional({ example: 'Pantrio Cook' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;
}
