import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupRecipesController } from './group-recipes.controller';
import { MeController, RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [RecipesController, MeController, GroupRecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
