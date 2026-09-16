import { Permission, ROLE_PERMISSIONS, type RoleName } from '@pantrio/shared';
import {
  MeasurementType,
  PrismaClient,
  RecipeDifficulty,
  RecipeVisibility,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Local / staging bootstrap only — change before any shared environment. */
const BOOTSTRAP_PASSWORD = 'password123';

const BOOTSTRAP_USERS: Array<{
  email: string;
  displayName: string;
  roleName: RoleName;
}> = [
  {
    email: 'admin@pantrio.app',
    displayName: 'Pantrio Admin',
    roleName: 'ADMIN',
  },
  {
    email: 'creator@pantrio.app',
    displayName: 'Pantrio Creator',
    roleName: 'CREATOR',
  },
];

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  USER: 'Default member — recipes, inventory, shopping',
  CREATOR: 'Can publish recipes and articles',
  BRAND: 'Brand / merchant content capabilities',
  MODERATOR: 'Community moderation and user management',
  ADMIN: 'Full system access',
};

const SAMPLE_FOODS: Array<{
  slug: string;
  measurementType: MeasurementType;
  baseUnit: string;
  translations: Array<{ locale: string; name: string; category: string }>;
}> = [
  {
    slug: 'chicken',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Chicken', category: 'protein' },
      { locale: 'vi', name: 'Gà', category: 'protein' },
    ],
  },
  {
    slug: 'egg',
    measurementType: MeasurementType.COUNT,
    baseUnit: 'pcs',
    translations: [
      { locale: 'en', name: 'Egg', category: 'protein' },
      { locale: 'vi', name: 'Trứng', category: 'protein' },
    ],
  },
  {
    slug: 'milk',
    measurementType: MeasurementType.VOLUME,
    baseUnit: 'ml',
    translations: [
      { locale: 'en', name: 'Milk', category: 'dairy' },
      { locale: 'vi', name: 'Sữa', category: 'dairy' },
    ],
  },
  {
    slug: 'tomato',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Tomato', category: 'produce' },
      { locale: 'vi', name: 'Cà chua', category: 'produce' },
    ],
  },
  {
    slug: 'onion',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Onion', category: 'produce' },
      { locale: 'vi', name: 'Hành tây', category: 'produce' },
    ],
  },
  {
    slug: 'pasta',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Pasta', category: 'pantry' },
      { locale: 'vi', name: 'Mì ống', category: 'pantry' },
    ],
  },
  {
    slug: 'bacon',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Bacon', category: 'protein' },
      { locale: 'vi', name: 'Thịt xông khói', category: 'protein' },
    ],
  },
  {
    slug: 'cheese',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Cheese', category: 'dairy' },
      { locale: 'vi', name: 'Phô mai', category: 'dairy' },
    ],
  },
];

async function seedRoles() {
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

async function seedFoods() {
  for (const food of SAMPLE_FOODS) {
    const record = await prisma.food.upsert({
      where: { slug: food.slug },
      update: {
        measurementType: food.measurementType,
        baseUnit: food.baseUnit,
      },
      create: {
        slug: food.slug,
        measurementType: food.measurementType,
        baseUnit: food.baseUnit,
      },
    });

    for (const translation of food.translations) {
      await prisma.foodTranslation.upsert({
        where: {
          foodId_locale: {
            foodId: record.id,
            locale: translation.locale,
          },
        },
        update: {
          name: translation.name,
          category: translation.category,
        },
        create: {
          foodId: record.id,
          locale: translation.locale,
          name: translation.name,
          category: translation.category,
        },
      });
    }
  }

  console.log(`Seeded ${SAMPLE_FOODS.length} foods with EN+VI translations`);
}

async function seedBootstrapUsers() {
  const passwordHash = await bcrypt.hash(BOOTSTRAP_PASSWORD, 10);

  for (const account of BOOTSTRAP_USERS) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: account.roleName },
    });

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        displayName: account.displayName,
        passwordHash,
      },
      create: {
        email: account.email,
        displayName: account.displayName,
        passwordHash,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  console.log(
    `Seeded bootstrap users (${BOOTSTRAP_USERS.map((u) => u.email).join(', ')}); password: ${BOOTSTRAP_PASSWORD}`,
  );
}

async function seedRecipes() {
  const creator = await prisma.user.findUniqueOrThrow({
    where: { email: 'creator@pantrio.app' },
  });

  const foods = await prisma.food.findMany({
    where: {
      slug: {
        in: [
          'pasta',
          'egg',
          'bacon',
          'cheese',
          'chicken',
          'tomato',
          'onion',
        ],
      },
    },
  });
  const foodBySlug = Object.fromEntries(foods.map((food) => [food.slug, food]));

  const samples: Array<{
    slug: string;
    title: string;
    description: string;
    servings: number;
    prepTimeMin: number;
    cookTimeMin: number;
    difficulty: RecipeDifficulty;
    instructions: string;
    ingredients: Array<{
      foodSlug: string;
      quantity: number;
      unit: string;
      optional?: boolean;
      sortOrder: number;
    }>;
  }> = [
    {
      slug: 'classic-carbonara',
      title: 'Classic Carbonara',
      description: 'Roman pasta with egg, cheese, and bacon.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 15,
      difficulty: RecipeDifficulty.MEDIUM,
      instructions:
        '1. Boil pasta in salted water.\n2. Cook bacon until crisp.\n3. Whisk eggs with cheese.\n4. Toss hot pasta with bacon, then off-heat fold in egg mixture.\n5. Serve immediately.',
      ingredients: [
        { foodSlug: 'pasta', quantity: 200, unit: 'g', sortOrder: 0 },
        { foodSlug: 'egg', quantity: 2, unit: 'pcs', sortOrder: 1 },
        { foodSlug: 'bacon', quantity: 100, unit: 'g', sortOrder: 2 },
        { foodSlug: 'cheese', quantity: 50, unit: 'g', sortOrder: 3 },
      ],
    },
    {
      slug: 'chicken-tomato-pasta',
      title: 'Chicken Tomato Pasta',
      description: 'Weeknight pasta with chicken, tomato, and onion.',
      servings: 3,
      prepTimeMin: 15,
      cookTimeMin: 25,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Cook pasta.\n2. Sauté onion, then brown chicken.\n3. Add tomato and simmer.\n4. Toss with pasta and serve.',
      ingredients: [
        { foodSlug: 'pasta', quantity: 250, unit: 'g', sortOrder: 0 },
        { foodSlug: 'chicken', quantity: 300, unit: 'g', sortOrder: 1 },
        { foodSlug: 'tomato', quantity: 400, unit: 'g', sortOrder: 2 },
        { foodSlug: 'onion', quantity: 100, unit: 'g', sortOrder: 3 },
        {
          foodSlug: 'cheese',
          quantity: 30,
          unit: 'g',
          optional: true,
          sortOrder: 4,
        },
      ],
    },
  ];

  for (const sample of samples) {
    const missing = sample.ingredients.filter(
      (item) => !foodBySlug[item.foodSlug],
    );
    if (missing.length) {
      throw new Error(
        `Missing foods for recipe ${sample.slug}: ${missing
          .map((item) => item.foodSlug)
          .join(', ')}`,
      );
    }

    const recipe = await prisma.recipe.upsert({
      where: { slug: sample.slug },
      update: {
        title: sample.title,
        description: sample.description,
        servings: sample.servings,
        prepTimeMin: sample.prepTimeMin,
        cookTimeMin: sample.cookTimeMin,
        difficulty: sample.difficulty,
        instructions: sample.instructions,
        visibility: RecipeVisibility.PUBLIC,
        authorId: creator.id,
      },
      create: {
        slug: sample.slug,
        title: sample.title,
        description: sample.description,
        servings: sample.servings,
        prepTimeMin: sample.prepTimeMin,
        cookTimeMin: sample.cookTimeMin,
        difficulty: sample.difficulty,
        instructions: sample.instructions,
        visibility: RecipeVisibility.PUBLIC,
        authorId: creator.id,
      },
    });

    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: recipe.id },
    });

    await prisma.recipeIngredient.createMany({
      data: sample.ingredients.map((item) => ({
        recipeId: recipe.id,
        foodId: foodBySlug[item.foodSlug].id,
        quantity: item.quantity,
        unit: item.unit,
        optional: item.optional ?? false,
        sortOrder: item.sortOrder,
      })),
    });
  }

  console.log(`Seeded ${samples.length} sample recipes`);
}

async function seed() {
  await seedRoles();
  await seedBootstrapUsers();
  await seedFoods();
  await seedRecipes();
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
