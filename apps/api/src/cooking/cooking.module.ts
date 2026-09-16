import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CookingController } from './cooking.controller';
import { CookingService } from './cooking.service';

@Module({
  imports: [PrismaModule],
  controllers: [CookingController],
  providers: [CookingService],
  exports: [CookingService],
})
export class CookingModule {}
