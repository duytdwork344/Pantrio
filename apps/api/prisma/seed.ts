import { Permission, ROLE_PERMISSIONS, type RoleName } from '@pantrio/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  USER: 'Default member — recipes, inventory, shopping',
  CREATOR: 'Can publish recipes and articles',
  BRAND: 'Brand / merchant content capabilities',
  MODERATOR: 'Community moderation and user management',
  ADMIN: 'Full system access',
};

async function seed() {
  for (const code of Object.values(Permission)) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        description: code,
      },
    });
  }

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS) as [
    RoleName,
    readonly Permission[],
  ][]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: ROLE_DESCRIPTIONS[roleName] },
      create: {
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
      },
    });

    for (const code of permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Seeded roles and permissions');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
