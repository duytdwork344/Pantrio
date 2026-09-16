export enum MeasurementType {
  COUNT = 'COUNT',
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
}

/** Canonical units for MVP APIs (stored lowercase). */
export enum Unit {
  G = 'g',
  KG = 'kg',
  ML = 'ml',
  L = 'l',
  PCS = 'pcs',
}

export const MVP_UNITS = Object.values(Unit);

export const UNITS_BY_MEASUREMENT_TYPE: Record<MeasurementType, readonly Unit[]> =
  {
    [MeasurementType.WEIGHT]: [Unit.G, Unit.KG],
    [MeasurementType.VOLUME]: [Unit.ML, Unit.L],
    [MeasurementType.COUNT]: [Unit.PCS],
  };

export enum InventoryTransactionType {
  PURCHASE = 'PURCHASE',
  CONSUME = 'CONSUME',
  DISPOSE = 'DISPOSE',
  ADJUSTMENT = 'ADJUSTMENT',
  ESTIMATED_CONSUME = 'ESTIMATED_CONSUME',
}

export enum QuantityConfidence {
  PRESENCE = 'PRESENCE',
  APPROXIMATE = 'APPROXIMATE',
  EXACT = 'EXACT',
}

export enum StorageLocation {
  PANTRY = 'PANTRY',
  FRIDGE = 'FRIDGE',
  FREEZER = 'FREEZER',
  OTHER = 'OTHER',
}

export enum RecipeDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum Permission {
  RECIPE_READ = 'recipe:read',
  RECIPE_CREATE = 'recipe:create',
  RECIPE_UPDATE = 'recipe:update',
  ARTICLE_CREATE = 'article:create',
  INVENTORY_MANAGE = 'inventory:manage',
  SHOPPING_MANAGE = 'shopping:manage',
  CATALOG_MANAGE = 'catalog:manage',
  USER_MANAGE = 'user:manage',
  MODERATION = 'moderation:manage',
  SYSTEM_MANAGE = 'system:manage',
}

export const ROLE_PERMISSIONS = {
  USER: [
    Permission.RECIPE_READ,
    Permission.INVENTORY_MANAGE,
    Permission.SHOPPING_MANAGE,
  ],
  CREATOR: [
    Permission.RECIPE_READ,
    Permission.RECIPE_CREATE,
    Permission.RECIPE_UPDATE,
    Permission.ARTICLE_CREATE,
    Permission.INVENTORY_MANAGE,
    Permission.SHOPPING_MANAGE,
  ],
  BRAND: [
    Permission.RECIPE_READ,
    Permission.ARTICLE_CREATE,
  ],
  MODERATOR: [
    Permission.RECIPE_READ,
    Permission.MODERATION,
    Permission.USER_MANAGE,
    Permission.CATALOG_MANAGE,
  ],
  ADMIN: Object.values(Permission),
} as const;

export type RoleName = keyof typeof ROLE_PERMISSIONS;

/** Default content locale for catalog / future recipe translations */
export const DEFAULT_LOCALE = 'vi' as const;

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
