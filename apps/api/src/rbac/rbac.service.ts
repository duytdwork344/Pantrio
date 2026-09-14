import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { code: 'asc' } },
        },
      },
    });
  }

  async assignRole(userId: string, roleName: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { name: roleName },
    });

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });

    return { userId, role: roleName };
  }
}
