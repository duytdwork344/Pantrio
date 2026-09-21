/**
 * Local overrides for LAN / mobile testing.
 * Copy to environment.local.ts and set your machine's IP:
 *   cp src/environments/environment.local.example.ts src/environments/environment.local.ts
 *
 * Then: pnpm --filter web start:lan
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://192.168.x.x:3001/api',
};
