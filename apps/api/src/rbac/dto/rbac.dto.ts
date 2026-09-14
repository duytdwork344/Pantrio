import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'user_cuid' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({ example: 'CREATOR' })
  @IsString()
  @MinLength(2)
  roleName!: string;
}

export class RolePermissionDto {
  @ApiProperty()
  code!: string;
}

export class RoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}
