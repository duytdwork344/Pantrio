import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'vi',
    description: 'Preferred locale; null = follow Accept-Language',
  })
  locale?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}
