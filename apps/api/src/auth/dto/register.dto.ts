import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
}
