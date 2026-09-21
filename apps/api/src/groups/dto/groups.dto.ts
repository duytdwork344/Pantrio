import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Nhà mình' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    description: 'Invite max uses (omit = unlimited)',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  inviteMaxUses?: number;
}

export class JoinGroupDto {
  @ApiProperty({ example: 'AB12CD34' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}

export class GroupMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: GroupMemberRole })
  role!: GroupMemberRole;

  @ApiProperty()
  joinedAt!: string;
}

export class InventoryGroupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  inviteCode!: string;

  @ApiPropertyOptional({ nullable: true })
  inviteExpiresAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  inviteMaxUses?: number | null;

  @ApiProperty()
  inviteUseCount!: number;

  @ApiProperty({ enum: GroupMemberRole })
  myRole!: GroupMemberRole;

  @ApiProperty({ type: [GroupMemberDto] })
  members!: GroupMemberDto[];
}
