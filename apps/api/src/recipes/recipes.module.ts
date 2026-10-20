import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { GroupsModule } from '../groups/groups.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { GroupRecipesController } from './group-recipes.controller';
import { RecipeModerationController } from './recipe-moderation.controller';
import { MeController, RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [
    PrismaModule,
    GroupsModule,
    CatalogModule,
    SearchModule,
    NutritionModule,
  ],
  controllers: [
    RecipesController,
    MeController,
    GroupRecipesController,
    RecipeModerationController,
  ],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
