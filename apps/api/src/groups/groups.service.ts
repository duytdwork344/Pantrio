import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGroupDto,
  InventoryGroupDto,
  JoinGroupDto,
} from './dto/groups.dto';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string): Promise<InventoryGroupDto | null> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: { user: { select: { id: true, displayName: true } } },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });
    if (!membership) {
      return null;
    }
    return this.toDto(membership.group, membership.role);
  }

  async create(userId: string, dto: CreateGroupDto): Promise<InventoryGroupDto> {
    const existing = await this.prisma.groupMembership.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException(
        'You already belong to a group; leave it before creating another (MVP: 1 group per user)',
      );
    }

    const inviteCode = await this.generateUniqueInviteCode();
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryGroup.create({
        data: {
          name: dto.name.trim(),
          createdByUserId: userId,
          inviteCode,
          inviteMaxUses: dto.inviteMaxUses ?? null,
          members: {
            create: {
              userId,
              role: GroupMemberRole.OWNER,
            },
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, displayName: true } } },
            orderBy: { joinedAt: 'asc' },
          },
        },
      });
      return created;
    });

    return this.toDto(group, GroupMemberRole.OWNER);
  }

  async join(userId: string, dto: JoinGroupDto): Promise<InventoryGroupDto> {
    const existing = await this.prisma.groupMembership.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException(
        'You already belong to a group; leave it before joining another (MVP: 1 group per user)',
      );
    }

    const code = dto.code.trim().toUpperCase();
    const group = await this.prisma.inventoryGroup.findUnique({
      where: { inviteCode: code },
    });
    if (!group) {
      throw new NotFoundException('Invalid invite code');
    }
    if (group.inviteExpiresAt && group.inviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invite code has expired');
    }
    if (
      group.inviteMaxUses != null &&
      group.inviteUseCount >= group.inviteMaxUses
    ) {
      throw new BadRequestException('Invite code has reached max uses');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.groupMembership.create({
          data: {
            groupId: group.id,
            userId,
            role: GroupMemberRole.MEMBER,
          },
        });
        await tx.inventoryGroup.update({
          where: { id: group.id },
          data: { inviteUseCount: { increment: 1 } },
        });
        return tx.inventoryGroup.findUniqueOrThrow({
          where: { id: group.id },
          include: {
            members: {
              include: { user: { select: { id: true, displayName: true } } },
              orderBy: { joinedAt: 'asc' },
            },
          },
        });
      });
      return this.toDto(updated, GroupMemberRole.MEMBER);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You already belong to a group (MVP: 1 group per user)',
        );
      }
      throw err;
    }
  }

  async leave(userId: string): Promise<{ left: true; dissolved?: boolean }> {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId },
      include: { group: { include: { members: true } } },
    });
    if (!membership) {
      throw new NotFoundException('You are not in a group');
    }

    const others = membership.group.members.filter((m) => m.userId !== userId);

    if (membership.role === GroupMemberRole.OWNER && others.length > 0) {
      throw new BadRequestException(
        'Owner cannot leave while other members remain; transfer ownership or ask members to leave first',
      );
    }

    if (membership.role === GroupMemberRole.OWNER && others.length === 0) {
      // Cascades memberships, group inventory, group shopping lists.
      await this.prisma.inventoryGroup.delete({
        where: { id: membership.groupId },
      });
      return { left: true, dissolved: true };
    }

    await this.prisma.groupMembership.delete({
      where: { id: membership.id },
    });
    return { left: true };
  }

  async rotateInvite(userId: string): Promise<InventoryGroupDto> {
    const membership = await this.requireMembership(userId);
    if (membership.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException('Only the group owner can rotate the invite');
    }

    const inviteCode = await this.generateUniqueInviteCode();
    const group = await this.prisma.inventoryGroup.update({
      where: { id: membership.groupId },
      data: {
        inviteCode,
        inviteUseCount: 0,
        inviteExpiresAt: null,
      },
      include: {
        members: {
          include: { user: { select: { id: true, displayName: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    return this.toDto(group, membership.role);
  }

  /** Assert caller is a member of groupId; returns membership. */
  async requireMembership(userId: string, groupId?: string) {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { userId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not in a group');
    }
    if (groupId != null && membership.groupId !== groupId) {
      throw new ForbiddenException('Not a member of this group');
    }
    return membership;
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.randomInviteCode(8);
      const clash = await this.prisma.inventoryGroup.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!clash) {
        return code;
      }
    }
    throw new BadRequestException('Could not allocate invite code; retry');
  }

  private randomInviteCode(length: number): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
    }
    return out;
  }

  private toDto(
    group: {
      id: string;
      name: string;
      inviteCode: string;
      inviteExpiresAt: Date | null;
      inviteMaxUses: number | null;
      inviteUseCount: number;
      members: Array<{
        userId: string;
        role: GroupMemberRole;
        joinedAt: Date;
        user: { id: string; displayName: string };
      }>;
    },
    myRole: GroupMemberRole,
  ): InventoryGroupDto {
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      inviteExpiresAt: group.inviteExpiresAt?.toISOString() ?? null,
      inviteMaxUses: group.inviteMaxUses,
      inviteUseCount: group.inviteUseCount,
      myRole,
      members: group.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }
}
