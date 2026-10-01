import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupRecipesController } from './group-recipes.controller';
import { RecipeModerationController } from './recipe-moderation.controller';
import { MeController, RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [PrismaModule, GroupsModule],
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
