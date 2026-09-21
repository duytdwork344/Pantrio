import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [ShoppingController],
  providers: [ShoppingService],
  exports: [ShoppingService],
})
export class ShoppingModule {}
