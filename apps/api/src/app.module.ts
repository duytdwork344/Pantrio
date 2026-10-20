import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CookingModule } from './cooking/cooking.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MediaModule } from './media/media.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { RecipesModule } from './recipes/recipes.module';
import { SearchModule } from './search/search.module';
import { ShoppingModule } from './shopping/shopping.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CatalogModule,
    HealthModule,
    RecipesModule,
    SearchModule,
    ArticlesModule,
    PlanningModule,
    GroupsModule,
    InventoryModule,
    ShoppingModule,
    CookingModule,
    MediaModule,
    NutritionModule,
  ],
})
export class AppModule {}
