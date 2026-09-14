import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
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
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.createUser({
      email: dto.email.toLowerCase(),
      displayName: dto.displayName,
      passwordHash,
      roleName: 'USER',
    });

    return this.buildAuthResponse(user.id);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user.id);
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponseDto> {
    const profile = await this.usersService.getProfile(userId);
    if (!profile) {
      throw new UnauthorizedException('User not found');
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
