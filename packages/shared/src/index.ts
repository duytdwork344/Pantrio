export enum MeasurementType {
  COUNT = 'COUNT',
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
}

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
  ],
  ADMIN: Object.values(Permission),
} as const;

export type RoleName = keyof typeof ROLE_PERMISSIONS;
