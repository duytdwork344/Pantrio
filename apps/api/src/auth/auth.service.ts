import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@pantrio/shared';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/errors/app-exception';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AUTH_EMAIL_TAKEN,
        'Email already registered',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      email: dto.email.toLowerCase(),
      displayName: dto.displayName,
      passwordHash,
      roleName: 'USER',
      locale: dto.locale ?? null,
    });

    return this.buildAuthResponse(user.id);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    const valid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid email or password',
      );
    }

    return this.buildAuthResponse(user.id);
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponseDto> {
    const profile = await this.usersService.getProfile(userId);
    if (!profile) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.USER_NOT_FOUND,
        'User not found',
      );
    }

    // signOptions (secret / expiresIn) come from JwtModule.registerAsync
    const accessToken = await this.jwtService.signAsync({
      sub: profile.id,
      email: profile.email,
    });

    return {
      accessToken,
      user: profile,
    };
  }
}
