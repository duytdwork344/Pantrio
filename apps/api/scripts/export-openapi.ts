import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, '..', 'openapi.json');
  const payload = JSON.stringify(document, null, 2);
  writeFileSync(outPath, payload);

  const clientPath = join(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'api-client',
    'openapi.json',
  );
  writeFileSync(clientPath, payload);

  await app.close();
  console.log(`OpenAPI written to ${outPath}`);
}

exportOpenApi().catch((error) => {
  console.error(error);
  process.exit(1);
});
