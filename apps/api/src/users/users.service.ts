import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAuthUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const roles = user.roles.map((item) => item.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((item) =>
          item.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles,
      permissions,
    };
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    roleName?: string;
  }) {
    const roleName = input.roleName ?? 'USER';
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });

    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        roles: {
          create: [{ roleId: role.id }],
        },
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.findAuthUserById(userId);
    if (!user) {
      return null;
    }

    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return {
      ...record,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
