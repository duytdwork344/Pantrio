import { Permission, ROLE_PERMISSIONS, type RoleName } from '@pantrio/shared';
import {
  MeasurementType,
  NutrientGroup,
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
  {
    email: 'creator2@pantrio.app',
    displayName: 'Lan Kitchen',
    roleName: 'CREATOR',
  },
  {
    email: 'creator3@pantrio.app',
    displayName: 'Minh Home Cook',
    roleName: 'CREATOR',
  },
  {
    email: 'moderator@pantrio.app',
    displayName: 'Pantrio Moderator',
    roleName: 'MODERATOR',
  },
];

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  USER: 'Default member — recipes, inventory, shopping',
  CREATOR: 'Can publish recipes and articles',
  BRAND: 'Brand / merchant content capabilities',
  MODERATOR: 'Community moderation and user management',
  ADMIN: 'Full system access',
};

function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function slugifyTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
  {
    slug: 'rice',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Rice', category: 'pantry' },
      { locale: 'vi', name: 'Gạo', category: 'pantry' },
    ],
  },
  {
    slug: 'garlic',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Garlic', category: 'produce' },
      { locale: 'vi', name: 'Tỏi', category: 'produce' },
    ],
  },
  {
    slug: 'ginger',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Ginger', category: 'produce' },
      { locale: 'vi', name: 'Gừng', category: 'produce' },
    ],
  },
  {
    slug: 'carrot',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Carrot', category: 'produce' },
      { locale: 'vi', name: 'Cà rốt', category: 'produce' },
    ],
  },
  {
    slug: 'potato',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Potato', category: 'produce' },
      { locale: 'vi', name: 'Khoai tây', category: 'produce' },
    ],
  },
  {
    slug: 'pork',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Pork', category: 'protein' },
      { locale: 'vi', name: 'Thịt heo', category: 'protein' },
    ],
  },
  {
    slug: 'beef',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Beef', category: 'protein' },
      { locale: 'vi', name: 'Thịt bò', category: 'protein' },
    ],
  },
  {
    slug: 'shrimp',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Shrimp', category: 'protein' },
      { locale: 'vi', name: 'Tôm', category: 'protein' },
    ],
  },
  {
    slug: 'tofu',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Tofu', category: 'protein' },
      { locale: 'vi', name: 'Đậu hũ', category: 'protein' },
    ],
  },
  {
    slug: 'mushroom',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Mushroom', category: 'produce' },
      { locale: 'vi', name: 'Nấm', category: 'produce' },
    ],
  },
  {
    slug: 'cucumber',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Cucumber', category: 'produce' },
      { locale: 'vi', name: 'Dưa leo', category: 'produce' },
    ],
  },
  {
    slug: 'green-onion',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Green onion', category: 'produce' },
      { locale: 'vi', name: 'Hành lá', category: 'produce' },
    ],
  },
  {
    slug: 'soy-sauce',
    measurementType: MeasurementType.VOLUME,
    baseUnit: 'ml',
    translations: [
      { locale: 'en', name: 'Soy sauce', category: 'condiment' },
      { locale: 'vi', name: 'Nước tương', category: 'condiment' },
    ],
  },
  {
    slug: 'fish-sauce',
    measurementType: MeasurementType.VOLUME,
    baseUnit: 'ml',
    translations: [
      { locale: 'en', name: 'Fish sauce', category: 'condiment' },
      { locale: 'vi', name: 'Nước mắm', category: 'condiment' },
    ],
  },
  {
    slug: 'oil',
    measurementType: MeasurementType.VOLUME,
    baseUnit: 'ml',
    translations: [
      { locale: 'en', name: 'Cooking oil', category: 'pantry' },
      { locale: 'vi', name: 'Dầu ăn', category: 'pantry' },
    ],
  },
  {
    slug: 'butter',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Butter', category: 'dairy' },
      { locale: 'vi', name: 'Bơ', category: 'dairy' },
    ],
  },
  {
    slug: 'flour',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Flour', category: 'pantry' },
      { locale: 'vi', name: 'Bột mì', category: 'pantry' },
    ],
  },
  {
    slug: 'sugar',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Sugar', category: 'pantry' },
      { locale: 'vi', name: 'Đường', category: 'pantry' },
    ],
  },
  {
    slug: 'rice-noodles',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Rice noodles', category: 'pantry' },
      { locale: 'vi', name: 'Bún / phở khô', category: 'pantry' },
    ],
  },
  {
    slug: 'lettuce',
    measurementType: MeasurementType.WEIGHT,
    baseUnit: 'g',
    translations: [
      { locale: 'en', name: 'Lettuce', category: 'produce' },
      { locale: 'vi', name: 'Xà lách', category: 'produce' },
    ],
  },
];

type SeedIngredient = {
  foodSlug: string;
  quantity: number;
  unit: string;
  optional?: boolean;
  sortOrder: number;
};

type SeedRecipe = {
  /** Prefer `seed-…` for disposable Discover content. */
  slug: string;
  title: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
  instructions: string;
  ingredients: SeedIngredient[];
  /** Author bootstrap email */
  authorEmail: string;
  /** Age of createdAt for Discover “Mới” */
  daysAgo: number;
};

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

const NUTRIENTS: Array<{
  code: string;
  nameEn: string;
  nameVi: string;
  unit: string;
  group: NutrientGroup;
  sortOrder: number;
}> = [
  {
    code: 'energy_kcal',
    nameEn: 'Energy',
    nameVi: 'Năng lượng',
    unit: 'kcal',
    group: NutrientGroup.ENERGY,
    sortOrder: 10,
  },
  {
    code: 'protein',
    nameEn: 'Protein',
    nameVi: 'Protein',
    unit: 'g',
    group: NutrientGroup.MACRO,
    sortOrder: 20,
  },
  {
    code: 'carb',
    nameEn: 'Carbohydrate',
    nameVi: 'Carbohydrate',
    unit: 'g',
    group: NutrientGroup.MACRO,
    sortOrder: 30,
  },
  {
    code: 'fat',
    nameEn: 'Fat',
    nameVi: 'Chất béo',
    unit: 'g',
    group: NutrientGroup.MACRO,
    sortOrder: 40,
  },
  {
    code: 'fiber',
    nameEn: 'Fiber',
    nameVi: 'Chất xơ',
    unit: 'g',
    group: NutrientGroup.CARB_DETAIL,
    sortOrder: 50,
  },
  {
    code: 'sugar',
    nameEn: 'Sugars',
    nameVi: 'Đường',
    unit: 'g',
    group: NutrientGroup.CARB_DETAIL,
    sortOrder: 60,
  },
  {
    code: 'sodium',
    nameEn: 'Sodium',
    nameVi: 'Natri',
    unit: 'mg',
    group: NutrientGroup.MINERAL,
    sortOrder: 70,
  },
];

/** Approximate per-basis values for seed foods (USDA-ish; not medical-grade). */
const FOOD_NUTRIENTS: Record<
  string,
  {
    basisQty: number;
    basisUnit: string;
    values: Partial<
      Record<
        'energy_kcal' | 'protein' | 'carb' | 'fat' | 'fiber' | 'sugar' | 'sodium',
        number
      >
    >;
  }
> = {
  chicken: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 165, protein: 31, carb: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
  },
  egg: {
    basisQty: 1,
    basisUnit: 'pcs',
    values: { energy_kcal: 72, protein: 6.3, carb: 0.4, fat: 4.8, fiber: 0, sugar: 0.2, sodium: 71 },
  },
  milk: {
    basisQty: 100,
    basisUnit: 'ml',
    values: { energy_kcal: 42, protein: 3.4, carb: 5, fat: 1, fiber: 0, sugar: 5, sodium: 44 },
  },
  tomato: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 18, protein: 0.9, carb: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5 },
  },
  onion: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 40, protein: 1.1, carb: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium: 4 },
  },
  pasta: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 371, protein: 13, carb: 75, fat: 1.5, fiber: 3.2, sugar: 2.7, sodium: 6 },
  },
  bacon: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 541, protein: 37, carb: 1.4, fat: 42, fiber: 0, sugar: 0, sodium: 1717 },
  },
  cheese: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 402, protein: 25, carb: 1.3, fat: 33, fiber: 0, sugar: 0.5, sodium: 621 },
  },
  rice: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 365, protein: 7.1, carb: 80, fat: 0.7, fiber: 1.3, sugar: 0.1, sodium: 5 },
  },
  garlic: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 149, protein: 6.4, carb: 33, fat: 0.5, fiber: 2.1, sugar: 1, sodium: 17 },
  },
  oil: {
    basisQty: 100,
    basisUnit: 'ml',
    values: { energy_kcal: 884, protein: 0, carb: 0, fat: 100, fiber: 0, sugar: 0, sodium: 0 },
  },
  butter: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 717, protein: 0.9, carb: 0.1, fat: 81, fiber: 0, sugar: 0.1, sodium: 11 },
  },
  flour: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 364, protein: 10, carb: 76, fat: 1, fiber: 2.7, sugar: 0.3, sodium: 2 },
  },
  sugar: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 387, protein: 0, carb: 100, fat: 0, fiber: 0, sugar: 100, sodium: 1 },
  },
  'white-sugar': {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 387, protein: 0, carb: 100, fat: 0, fiber: 0, sugar: 100, sodium: 1 },
  },
  pork: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 242, protein: 27, carb: 0, fat: 14, fiber: 0, sugar: 0, sodium: 62 },
  },
  beef: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 250, protein: 26, carb: 0, fat: 15, fiber: 0, sugar: 0, sodium: 72 },
  },
  tofu: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 76, protein: 8, carb: 1.9, fat: 4.8, fiber: 0.3, sugar: 0.6, sodium: 7 },
  },
  shrimp: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 99, protein: 24, carb: 0.2, fat: 0.3, fiber: 0, sugar: 0, sodium: 111 },
  },
  carrot: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 41, protein: 0.9, carb: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69 },
  },
  potato: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 77, protein: 2, carb: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, sodium: 6 },
  },
  ginger: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 80, protein: 1.8, carb: 18, fat: 0.8, fiber: 2, sugar: 1.7, sodium: 13 },
  },
  mushroom: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 22, protein: 3.1, carb: 3.3, fat: 0.3, fiber: 1, sugar: 2, sodium: 5 },
  },
  cucumber: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 15, protein: 0.7, carb: 3.6, fat: 0.1, fiber: 0.5, sugar: 1.7, sodium: 2 },
  },
  'green-onion': {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 32, protein: 1.8, carb: 7.3, fat: 0.2, fiber: 2.6, sugar: 2.3, sodium: 16 },
  },
  lettuce: {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 15, protein: 1.4, carb: 2.9, fat: 0.2, fiber: 1.3, sugar: 0.8, sodium: 28 },
  },
  'soy-sauce': {
    basisQty: 100,
    basisUnit: 'ml',
    values: { energy_kcal: 53, protein: 8.1, carb: 4.9, fat: 0.1, fiber: 0.8, sugar: 0.4, sodium: 5493 },
  },
  'fish-sauce': {
    basisQty: 100,
    basisUnit: 'ml',
    values: { energy_kcal: 35, protein: 5.1, carb: 3.6, fat: 0, fiber: 0, sugar: 3.6, sodium: 7880 },
  },
  'rice-noodles': {
    basisQty: 100,
    basisUnit: 'g',
    values: { energy_kcal: 364, protein: 3.4, carb: 83, fat: 0.6, fiber: 1.6, sugar: 0.1, sodium: 182 },
  },
};

async function seedNutrition() {
  for (const nutrient of NUTRIENTS) {
    await prisma.nutrient.upsert({
      where: { code: nutrient.code },
      update: {
        nameEn: nutrient.nameEn,
        nameVi: nutrient.nameVi,
        unit: nutrient.unit,
        group: nutrient.group,
        sortOrder: nutrient.sortOrder,
      },
      create: nutrient,
    });
  }

  const nutrients = await prisma.nutrient.findMany();
  const nutrientByCode = Object.fromEntries(
    nutrients.map((row) => [row.code, row]),
  );
  const foods = await prisma.food.findMany({
    where: { slug: { in: Object.keys(FOOD_NUTRIENTS) } },
  });

  let rows = 0;
  for (const food of foods) {
    const spec = FOOD_NUTRIENTS[food.slug];
    if (!spec) continue;
    for (const [code, amount] of Object.entries(spec.values)) {
      if (amount == null) continue;
      const nutrient = nutrientByCode[code];
      if (!nutrient) continue;
      await prisma.foodNutrient.upsert({
        where: {
          foodId_nutrientId: {
            foodId: food.id,
            nutrientId: nutrient.id,
          },
        },
        update: {
          amount,
          basisQty: spec.basisQty,
          basisUnit: spec.basisUnit,
        },
        create: {
          foodId: food.id,
          nutrientId: nutrient.id,
          amount,
          basisQty: spec.basisQty,
          basisUnit: spec.basisUnit,
        },
      });
      rows += 1;
    }
  }

  console.log(
    `Seeded ${NUTRIENTS.length} nutrients and ${rows} FoodNutrient rows`,
  );
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

function buildDiscoverRecipes(): SeedRecipe[] {
  const c1 = 'creator@pantrio.app';
  const c2 = 'creator2@pantrio.app';
  const c3 = 'creator3@pantrio.app';

  const defs: Array<Omit<SeedRecipe, 'slug'> & { slug?: string }> = [
    // Keep legacy slugs for existing links
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
      authorEmail: c1,
      daysAgo: 40,
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
      authorEmail: c1,
      daysAgo: 35,
    },
    // Discover bulk — seed-* (disposable)
    {
      title: 'Cơm gà xào nấm',
      description: 'Cơm nóng với gà xào nấm và hành.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 20,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Nấu cơm.\n2. Xào tỏi, cho gà vào.\n3. Thêm nấm, nước tương.\n4. Ăn kèm cơm.',
      ingredients: [
        { foodSlug: 'rice', quantity: 300, unit: 'g', sortOrder: 0 },
        { foodSlug: 'chicken', quantity: 250, unit: 'g', sortOrder: 1 },
        { foodSlug: 'mushroom', quantity: 150, unit: 'g', sortOrder: 2 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 3 },
        { foodSlug: 'soy-sauce', quantity: 30, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'oil', quantity: 15, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 0,
    },
    {
      title: 'Trứng chiên cà chua',
      description: 'Món Việt quen thuộc, nhanh gọn.',
      servings: 2,
      prepTimeMin: 5,
      cookTimeMin: 10,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Đánh trứng.\n2. Chiên trứng.\n3. Xào cà chua với nước mắm, đường.\n4. Chan lên trứng.',
      ingredients: [
        { foodSlug: 'egg', quantity: 3, unit: 'pcs', sortOrder: 0 },
        { foodSlug: 'tomato', quantity: 300, unit: 'g', sortOrder: 1 },
        { foodSlug: 'green-onion', quantity: 20, unit: 'g', sortOrder: 2 },
        { foodSlug: 'fish-sauce', quantity: 15, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'sugar', quantity: 10, unit: 'g', sortOrder: 4 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 0,
    },
    {
      title: 'Tôm rang tỏi',
      description: 'Tôm giòn nhẹ, thơm tỏi.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 12,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Rửa tôm.\n2. Phi tỏi.\n3. Rang tôm với nước mắm đường.\n4. Rắc hành lá.',
      ingredients: [
        { foodSlug: 'shrimp', quantity: 400, unit: 'g', sortOrder: 0 },
        { foodSlug: 'garlic', quantity: 20, unit: 'g', sortOrder: 1 },
        { foodSlug: 'fish-sauce', quantity: 20, unit: 'ml', sortOrder: 2 },
        { foodSlug: 'sugar', quantity: 15, unit: 'g', sortOrder: 3 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'green-onion', quantity: 15, unit: 'g', optional: true, sortOrder: 5 },
      ],
      authorEmail: c3,
      daysAgo: 1,
    },
    {
      title: 'Thịt heo kho trứng',
      description: 'Kho vừa ăn, nước màu cánh gián.',
      servings: 4,
      prepTimeMin: 15,
      cookTimeMin: 45,
      difficulty: RecipeDifficulty.MEDIUM,
      instructions:
        '1. Luộc trứng.\n2. Ướp thịt với nước mắm đường tỏi.\n3. Kho nhỏ lửa.\n4. Cho trứng vào kho cùng.',
      ingredients: [
        { foodSlug: 'pork', quantity: 500, unit: 'g', sortOrder: 0 },
        { foodSlug: 'egg', quantity: 4, unit: 'pcs', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 20, unit: 'g', sortOrder: 2 },
        { foodSlug: 'fish-sauce', quantity: 40, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'sugar', quantity: 25, unit: 'g', sortOrder: 4 },
        { foodSlug: 'onion', quantity: 80, unit: 'g', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 1,
    },
    {
      title: 'Canh chua tôm',
      description: 'Chua nhẹ, thanh mát.',
      servings: 3,
      prepTimeMin: 15,
      cookTimeMin: 20,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Nấu nước dùng.\n2. Cho cà chua, đậu hũ.\n3. Thêm tôm, nêm nước mắm.\n4. Tắt bếp, rắc hành.',
      ingredients: [
        { foodSlug: 'shrimp', quantity: 200, unit: 'g', sortOrder: 0 },
        { foodSlug: 'tomato', quantity: 200, unit: 'g', sortOrder: 1 },
        { foodSlug: 'tofu', quantity: 200, unit: 'g', sortOrder: 2 },
        { foodSlug: 'fish-sauce', quantity: 20, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'green-onion', quantity: 20, unit: 'g', sortOrder: 4 },
      ],
      authorEmail: c3,
      daysAgo: 2,
    },
    {
      title: 'Bò xào hành tây',
      description: 'Nhanh tay, thịt mềm.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 8,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Ướp bò với nước tương tỏi.\n2. Xào hành tây.\n3. Cho bò vào xào nhanh.\n4. Ăn với cơm.',
      ingredients: [
        { foodSlug: 'beef', quantity: 300, unit: 'g', sortOrder: 0 },
        { foodSlug: 'onion', quantity: 200, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 2 },
        { foodSlug: 'soy-sauce', quantity: 25, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'rice', quantity: 300, unit: 'g', optional: true, sortOrder: 5 },
      ],
      authorEmail: c1,
      daysAgo: 2,
    },
    {
      title: 'Đậu hũ sốt cà',
      description: 'Chay nhẹ, đậm đà.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 15,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Chiên đậu hũ.\n2. Xào tỏi hành, cho cà chua.\n3. Nêm nước tương đường.\n4. Chan sốt lên đậu.',
      ingredients: [
        { foodSlug: 'tofu', quantity: 400, unit: 'g', sortOrder: 0 },
        { foodSlug: 'tomato', quantity: 350, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 2 },
        { foodSlug: 'onion', quantity: 80, unit: 'g', sortOrder: 3 },
        { foodSlug: 'soy-sauce', quantity: 25, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'sugar', quantity: 10, unit: 'g', sortOrder: 5 },
        { foodSlug: 'oil', quantity: 30, unit: 'ml', sortOrder: 6 },
      ],
      authorEmail: c2,
      daysAgo: 3,
    },
    {
      title: 'Khoai tây chiên bơ tỏi',
      description: 'Giòn ngoài, thơm bơ.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 20,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Cắt khoai, chiên hoặc nướng.\n2. Đun bơ với tỏi.\n3. Trộn khoai với bơ tỏi.\n4. Rắc chút muối.',
      ingredients: [
        { foodSlug: 'potato', quantity: 500, unit: 'g', sortOrder: 0 },
        { foodSlug: 'butter', quantity: 40, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 20, unit: 'g', sortOrder: 2 },
        { foodSlug: 'oil', quantity: 30, unit: 'ml', sortOrder: 3 },
      ],
      authorEmail: c3,
      daysAgo: 3,
    },
    {
      title: 'Salad dưa leo trứng',
      description: 'Mát, ăn kèm cơm hoặc sandwich.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 10,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Luộc trứng.\n2. Thái dưa leo, xà lách.\n3. Trộn nhẹ với dầu.\n4. Xếp trứng lên trên.',
      ingredients: [
        { foodSlug: 'cucumber', quantity: 250, unit: 'g', sortOrder: 0 },
        { foodSlug: 'lettuce', quantity: 100, unit: 'g', sortOrder: 1 },
        { foodSlug: 'egg', quantity: 2, unit: 'pcs', sortOrder: 2 },
        { foodSlug: 'oil', quantity: 15, unit: 'ml', sortOrder: 3 },
      ],
      authorEmail: c1,
      daysAgo: 4,
    },
    {
      title: 'Mì xào thập cẩm',
      description: 'Mì ống xào gà, cà rốt, hành.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 15,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Luộc mì.\n2. Xào gà và rau.\n3. Cho mì vào, nêm nước tương.\n4. Đảo đều.',
      ingredients: [
        { foodSlug: 'pasta', quantity: 200, unit: 'g', sortOrder: 0 },
        { foodSlug: 'chicken', quantity: 200, unit: 'g', sortOrder: 1 },
        { foodSlug: 'carrot', quantity: 100, unit: 'g', sortOrder: 2 },
        { foodSlug: 'onion', quantity: 80, unit: 'g', sortOrder: 3 },
        { foodSlug: 'soy-sauce', quantity: 30, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 5,
    },
    {
      title: 'Súp khoai tây sữa',
      description: 'Ấm bụng buổi tối.',
      servings: 3,
      prepTimeMin: 10,
      cookTimeMin: 25,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Xào hành với bơ.\n2. Cho khoai, thêm sữa và nước.\n3. Nin mềm, xay hoặc tán.\n4. Nêm nhẹ.',
      ingredients: [
        { foodSlug: 'potato', quantity: 400, unit: 'g', sortOrder: 0 },
        { foodSlug: 'milk', quantity: 300, unit: 'ml', sortOrder: 1 },
        { foodSlug: 'butter', quantity: 30, unit: 'g', sortOrder: 2 },
        { foodSlug: 'onion', quantity: 80, unit: 'g', sortOrder: 3 },
      ],
      authorEmail: c3,
      daysAgo: 6,
    },
    {
      title: 'Gà kho gừng',
      description: 'Thơm gừng, đậm đà.',
      servings: 3,
      prepTimeMin: 15,
      cookTimeMin: 35,
      difficulty: RecipeDifficulty.MEDIUM,
      instructions:
        '1. Ướp gà với nước mắm đường gừng.\n2. Kho nhỏ lửa.\n3. Thêm hành tây.\n4. Ăn với cơm.',
      ingredients: [
        { foodSlug: 'chicken', quantity: 500, unit: 'g', sortOrder: 0 },
        { foodSlug: 'ginger', quantity: 40, unit: 'g', sortOrder: 1 },
        { foodSlug: 'fish-sauce', quantity: 35, unit: 'ml', sortOrder: 2 },
        { foodSlug: 'sugar', quantity: 20, unit: 'g', sortOrder: 3 },
        { foodSlug: 'onion', quantity: 100, unit: 'g', sortOrder: 4 },
        { foodSlug: 'oil', quantity: 15, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 7,
    },
    {
      title: 'Bún tôm đơn giản',
      description: 'Bún nước dùng tôm nhanh.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 20,
      difficulty: RecipeDifficulty.MEDIUM,
      instructions:
        '1. Ngâm bún.\n2. Nấu nước dùng với tôm.\n3. Nêm nước mắm.\n4. Chan lên bún, thêm xà lách.',
      ingredients: [
        { foodSlug: 'rice-noodles', quantity: 200, unit: 'g', sortOrder: 0 },
        { foodSlug: 'shrimp', quantity: 250, unit: 'g', sortOrder: 1 },
        { foodSlug: 'tomato', quantity: 150, unit: 'g', sortOrder: 2 },
        { foodSlug: 'lettuce', quantity: 80, unit: 'g', sortOrder: 3 },
        { foodSlug: 'fish-sauce', quantity: 20, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'green-onion', quantity: 20, unit: 'g', sortOrder: 5 },
      ],
      authorEmail: c3,
      daysAgo: 8,
    },
    {
      title: 'Thịt heo xào nấm',
      description: 'Ít nước, thấm gia vị.',
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 12,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Thái thịt, ướp nước tương.\n2. Xào tỏi.\n3. Cho thịt và nấm.\n4. Đảo chín tới.',
      ingredients: [
        { foodSlug: 'pork', quantity: 300, unit: 'g', sortOrder: 0 },
        { foodSlug: 'mushroom', quantity: 200, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 2 },
        { foodSlug: 'soy-sauce', quantity: 25, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 4 },
      ],
      authorEmail: c1,
      daysAgo: 9,
    },
    {
      title: 'Omlette phô mai',
      description: 'Trứng cuộn phô mai kiểu Âu.',
      servings: 1,
      prepTimeMin: 5,
      cookTimeMin: 5,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Đánh trứng với sữa.\n2. Đổ chảo bơ.\n3. Cho phô mai, cuộn lại.\n4. Ăn nóng.',
      ingredients: [
        { foodSlug: 'egg', quantity: 2, unit: 'pcs', sortOrder: 0 },
        { foodSlug: 'cheese', quantity: 40, unit: 'g', sortOrder: 1 },
        { foodSlug: 'milk', quantity: 30, unit: 'ml', sortOrder: 2 },
        { foodSlug: 'butter', quantity: 15, unit: 'g', sortOrder: 3 },
      ],
      authorEmail: c1,
      daysAgo: 10,
    },
    {
      title: 'Cà rốt xào tỏi',
      description: 'Rau phụ nhanh cho bữa cơm.',
      servings: 2,
      prepTimeMin: 8,
      cookTimeMin: 10,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Thái cà rốt.\n2. Phi tỏi.\n3. Xào nhanh, nêm nhẹ.\n4. Tắt bếp.',
      ingredients: [
        { foodSlug: 'carrot', quantity: 300, unit: 'g', sortOrder: 0 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 1 },
        { foodSlug: 'oil', quantity: 15, unit: 'ml', sortOrder: 2 },
        { foodSlug: 'soy-sauce', quantity: 10, unit: 'ml', optional: true, sortOrder: 3 },
      ],
      authorEmail: c2,
      daysAgo: 12,
    },
    {
      title: 'Cơm chiên trứng',
      description: 'Tận dụng cơm nguội.',
      servings: 2,
      prepTimeMin: 5,
      cookTimeMin: 10,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Đánh trứng chiên trước.\n2. Xào cơm với dầu và nước tương.\n3. Trộn trứng.\n4. Rắc hành.',
      ingredients: [
        { foodSlug: 'rice', quantity: 400, unit: 'g', sortOrder: 0 },
        { foodSlug: 'egg', quantity: 2, unit: 'pcs', sortOrder: 1 },
        { foodSlug: 'green-onion', quantity: 20, unit: 'g', sortOrder: 2 },
        { foodSlug: 'soy-sauce', quantity: 20, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'oil', quantity: 25, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'garlic', quantity: 10, unit: 'g', optional: true, sortOrder: 5 },
      ],
      authorEmail: c3,
      daysAgo: 14,
    },
    {
      title: 'Pasta bơ tỏi',
      description: 'Aglio-style đơn giản.',
      servings: 2,
      prepTimeMin: 5,
      cookTimeMin: 12,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Luộc pasta.\n2. Đun bơ tỏi.\n3. Trộn pasta với bơ tỏi.\n4. Rắc phô mai nếu có.',
      ingredients: [
        { foodSlug: 'pasta', quantity: 200, unit: 'g', sortOrder: 0 },
        { foodSlug: 'butter', quantity: 40, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 25, unit: 'g', sortOrder: 2 },
        { foodSlug: 'cheese', quantity: 30, unit: 'g', optional: true, sortOrder: 3 },
      ],
      authorEmail: c1,
      daysAgo: 16,
    },
    {
      title: 'Thịt bò sốt tiêu đơn',
      description: 'Xào nhanh với hành và nước tương.',
      servings: 2,
      prepTimeMin: 12,
      cookTimeMin: 10,
      difficulty: RecipeDifficulty.MEDIUM,
      instructions:
        '1. Ướp bò.\n2. Xào hành tỏi.\n3. Cho bò vào đảo lửa lớn.\n4. Nêm lại và tắt bếp.',
      ingredients: [
        { foodSlug: 'beef', quantity: 350, unit: 'g', sortOrder: 0 },
        { foodSlug: 'onion', quantity: 150, unit: 'g', sortOrder: 1 },
        { foodSlug: 'garlic', quantity: 15, unit: 'g', sortOrder: 2 },
        { foodSlug: 'soy-sauce', quantity: 30, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'sugar', quantity: 10, unit: 'g', sortOrder: 4 },
        { foodSlug: 'oil', quantity: 20, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 18,
    },
    {
      title: 'Cháo gà gừng',
      description: 'Nhẹ bụng, dễ nấu.',
      servings: 3,
      prepTimeMin: 10,
      cookTimeMin: 40,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Nin gà với gừng.\n2. Cho gạo vào nấu cháo.\n3. Xé gà, nêm nước mắm.\n4. Rắc hành.',
      ingredients: [
        { foodSlug: 'chicken', quantity: 400, unit: 'g', sortOrder: 0 },
        { foodSlug: 'rice', quantity: 150, unit: 'g', sortOrder: 1 },
        { foodSlug: 'ginger', quantity: 30, unit: 'g', sortOrder: 2 },
        { foodSlug: 'fish-sauce', quantity: 15, unit: 'ml', sortOrder: 3 },
        { foodSlug: 'green-onion', quantity: 20, unit: 'g', sortOrder: 4 },
      ],
      authorEmail: c3,
      daysAgo: 21,
    },
    {
      title: 'Bánh kếp bột mì sữa',
      description: 'Pancake mỏng kiểu nhà.',
      servings: 3,
      prepTimeMin: 10,
      cookTimeMin: 15,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Trộn bột, sữa, trứng.\n2. Để bột nghỉ.\n3. Đổ chảo bơ từng lớp.\n4. Ăn với đường hoặc trái cây.',
      ingredients: [
        { foodSlug: 'flour', quantity: 150, unit: 'g', sortOrder: 0 },
        { foodSlug: 'milk', quantity: 250, unit: 'ml', sortOrder: 1 },
        { foodSlug: 'egg', quantity: 2, unit: 'pcs', sortOrder: 2 },
        { foodSlug: 'butter', quantity: 30, unit: 'g', sortOrder: 3 },
        { foodSlug: 'sugar', quantity: 20, unit: 'g', sortOrder: 4 },
      ],
      authorEmail: c1,
      daysAgo: 25,
    },
    {
      title: 'Xà lách trộn tôm',
      description: 'Salad nhẹ buổi trưa.',
      servings: 2,
      prepTimeMin: 15,
      cookTimeMin: 8,
      difficulty: RecipeDifficulty.EASY,
      instructions:
        '1. Luộc hoặc xào tôm.\n2. Thái rau.\n3. Trộn với dầu và nước tương.\n4. Xếp tôm lên.',
      ingredients: [
        { foodSlug: 'lettuce', quantity: 150, unit: 'g', sortOrder: 0 },
        { foodSlug: 'shrimp', quantity: 200, unit: 'g', sortOrder: 1 },
        { foodSlug: 'cucumber', quantity: 100, unit: 'g', sortOrder: 2 },
        { foodSlug: 'tomato', quantity: 100, unit: 'g', sortOrder: 3 },
        { foodSlug: 'oil', quantity: 15, unit: 'ml', sortOrder: 4 },
        { foodSlug: 'soy-sauce', quantity: 10, unit: 'ml', sortOrder: 5 },
      ],
      authorEmail: c2,
      daysAgo: 28,
    },
  ];

  return defs.map((d) => ({
    ...d,
    slug:
      d.slug ??
      `seed-${slugifyTitle(d.title)}`.replace(/-+/g, '-').slice(0, 80),
  }));
}

async function seedRecipes() {
  const authors = await prisma.user.findMany({
    where: {
      email: {
        in: BOOTSTRAP_USERS.filter((u) => u.roleName === 'CREATOR').map(
          (u) => u.email,
        ),
      },
    },
  });
  const authorByEmail = Object.fromEntries(
    authors.map((u) => [u.email, u]),
  );

  const foods = await prisma.food.findMany();
  const foodBySlug = Object.fromEntries(foods.map((food) => [food.slug, food]));

  const samples = buildDiscoverRecipes();

  for (const sample of samples) {
    const author = authorByEmail[sample.authorEmail];
    if (!author) {
      throw new Error(`Missing author ${sample.authorEmail}`);
    }

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

    const createdAt = daysAgo(sample.daysAgo, 9 + (sample.daysAgo % 5));

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
        authorId: author.id,
        createdAt,
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
        authorId: author.id,
        createdAt,
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

  console.log(
    `Seeded ${samples.length} recipes (${samples.filter((s) => s.slug.startsWith('seed-')).length} with seed- prefix)`,
  );
}

async function seedArticles() {
  const creators = await prisma.user.findMany({
    where: {
      email: { in: ['creator@pantrio.app', 'creator2@pantrio.app'] },
    },
  });
  const byEmail = Object.fromEntries(creators.map((u) => [u.email, u]));

  const recipes = await prisma.recipe.findMany({
    where: {
      slug: {
        in: [
          'seed-com-ga-xao-nam',
          'seed-trung-chien-ca-chua',
          'seed-tom-rang-toi',
          'classic-carbonara',
        ],
      },
    },
    select: { id: true, slug: true },
  });
  const recipeBySlug = Object.fromEntries(recipes.map((r) => [r.slug, r]));

  const articles: Array<{
    slug: string;
    title: string;
    summary: string;
    body: string;
    authorEmail: string;
    daysAgoPublish: number;
    recipeSlugs: string[];
  }> = [
    {
      slug: 'seed-weeknight-viet-meals',
      title: '3 món Việt nấu tối dưới 30 phút',
      summary: 'Gợi ý từ tủ lạnh: trứng cà, tôm rang, cơm gà nấm.',
      body: 'Khi về muộn, ưu tiên món ít bước: trứng chiên cà chua, tôm rang tỏi, cơm gà xào nấm. Chuẩn bị hành tỏi sẵn sẽ cắt thời gian còn hơn.\n\nPantrio giúp bạn thấy món nào gần khớp tủ — thử cụm Gợi ý từ tủ trên Discover.',
      authorEmail: 'creator2@pantrio.app',
      daysAgoPublish: 0,
      recipeSlugs: [
        'seed-trung-chien-ca-chua',
        'seed-tom-rang-toi',
        'seed-com-ga-xao-nam',
      ],
    },
    {
      slug: 'seed-pantry-pasta-night',
      title: 'Pasta night từ pantry cơ bản',
      summary: 'Carbonara và biến tấu cà chua gà khi thiếu bacon.',
      body: 'Pasta + trứng + phô mai là bộ khung. Có bacon thì carbonara; không có thì chuyển sang chicken tomato pasta.\n\nĐừng quên kiểm tra đơn vị g/ml/pcs cho khớp inventory.',
      authorEmail: 'creator@pantrio.app',
      daysAgoPublish: 2,
      recipeSlugs: ['classic-carbonara', 'chicken-tomato-pasta'],
    },
    {
      slug: 'seed-how-we-plan-meals',
      title: 'Lên kế hoạch bữa ăn với Planned + Shopping',
      summary: 'Từ recipe đã lưu đến list mua và purchase vào tủ.',
      body: '1. Save món thích.\n2. Plan servings.\n3. Generate shopping từ planned.\n4. Purchase → inventory.\n\nMobile đang làm vòng này trọn; Web tập trung discovery và article.',
      authorEmail: 'creator@pantrio.app',
      daysAgoPublish: 5,
      recipeSlugs: [],
    },
    {
      slug: 'seed-discover-feed-notes',
      title: 'Discover sẽ đổi theo ngày như thế nào?',
      summary: 'Ghi chú sản phẩm: Hôm nay / Mới / Gợi ý từ tủ.',
      body: 'Chúng ta tách cụm thay vì một list phẳng. Featured-of-day có thể xoay deterministic; Mới dựa trên createdAt; pantry recommend giữ trục khớp tủ.\n\nSeed recipe dùng prefix seed- để dễ dọn khi học xong.',
      authorEmail: 'creator2@pantrio.app',
      daysAgoPublish: 1,
      recipeSlugs: ['seed-com-ga-xao-nam'],
    },
  ];

  for (const a of articles) {
    const author = byEmail[a.authorEmail];
    if (!author) {
      throw new Error(`Missing article author ${a.authorEmail}`);
    }
    const publishedAt = daysAgo(a.daysAgoPublish, 14);
    const article = await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        summary: a.summary,
        body: a.body,
        authorId: author.id,
        publishedAt,
      },
      create: {
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        body: a.body,
        authorId: author.id,
        publishedAt,
      },
    });

    await prisma.articleRecipe.deleteMany({ where: { articleId: article.id } });
    const links = a.recipeSlugs
      .map((slug, index) => {
        const recipe = recipeBySlug[slug];
        if (!recipe) {
          return null;
        }
        return {
          articleId: article.id,
          recipeId: recipe.id,
          sortOrder: index,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (links.length) {
      await prisma.articleRecipe.createMany({ data: links });
    }
  }

  console.log(`Seeded ${articles.length} articles (seed-*)`);
}

async function seed() {
  await seedRoles();
  await seedBootstrapUsers();
  await seedFoods();
  await seedNutrition();
  await seedRecipes();
  await seedArticles();
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
