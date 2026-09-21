import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RecipeSummaryDto } from '../../recipes/dto/recipe.dto';

export class ArticleSummaryDto {
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
