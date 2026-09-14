import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type { paths };

export function createPantrioClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type PantrioClient = ReturnType<typeof createPantrioClient>;
