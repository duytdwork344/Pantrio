import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '@pantrio/shared';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'cook@pantrio.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Pantrio Cook' })
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Preferred locale; omit to follow Accept-Language',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}
