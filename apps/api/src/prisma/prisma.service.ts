import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (process.env.SKIP_DB === '1') {
      this.logger.warn('SKIP_DB=1 — skipping Prisma connect');
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (process.env.SKIP_DB === '1') {
      return;
    }
    await this.$disconnect();
  }
}
