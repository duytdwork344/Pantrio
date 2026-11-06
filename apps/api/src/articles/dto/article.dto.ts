import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '@pantrio/shared';
import { TranslationOrigin } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  RecipeLocaleInfoDto,
  RecipeSummaryDto,
} from '../../recipes/dto/recipe.dto';

/** Text of one locale, without the locale (moderator PUT …/translations/:locale). */
export class ArticleTranslationBodyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  summary?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}

export class ArticleTranslationInputDto extends ArticleTranslationBodyDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'en' })
  @IsIn(SUPPORTED_LOCALES)
  locale!: string;
}

export class ArticleTranslationDto {
  @ApiProperty()
  locale!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  summary?: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: TranslationOrigin })
  origin!: TranslationOrigin;

  @ApiPropertyOptional({ nullable: true })
  translatedById?: string | null;
}

export class ArticleSummaryDto extends RecipeLocaleInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  publishedAt?: Date | null;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  authorName!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Number of tagged recipes (list endpoints)',
  })
  recipeCount?: number;
}

export class ArticleDetailDto extends ArticleSummaryDto {
  @ApiProperty()
  body!: string;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [RecipeSummaryDto] })
  recipes!: RecipeSummaryDto[];

  @ApiPropertyOptional({
    type: [ArticleTranslationDto],
    description: 'Every locale (source first); author and moderators only',
  })
  translations?: ArticleTranslationDto[];
}

export class CreateArticleDto {
  @ApiProperty({ example: 'Pantry tips for weeknight cooking' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ example: 'Markdown or plain text body…' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({
    description: 'If true, set publishedAt = now',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  publish?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Recipe ids to tag (order preserved)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  recipeIds?: string[];

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description:
      'Language of title / summary / body. Default: current source, else request locale',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  sourceLocale?: string;

  @ApiPropertyOptional({
    type: [ArticleTranslationInputDto],
    description:
      'Other locales. When sent it replaces all non-source translations; omit to keep them',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleTranslationInputDto)
  translations?: ArticleTranslationInputDto[];
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {
  @ApiPropertyOptional({
    description: 'true = publish now; false = unpublish (draft)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  publish?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replace tagged recipes (omit to leave unchanged)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  recipeIds?: string[];
}
