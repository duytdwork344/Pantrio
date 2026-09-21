# Pantrio Web (Angular)

Standalone Angular 19 app for discovery / recipe / blog surfaces.

```bash
# from repo root — desktop (API via localhost)
pnpm --filter @pantrio/web start
# http://localhost:4200

# mobile / LAN — uses gitignored environment.local.ts
# 1) copy example once and set your machine IP
cp apps/web/src/environments/environment.local.example.ts \
   apps/web/src/environments/environment.local.ts
# 2) add the same origin to apps/api/.env CORS_ORIGIN
# 3) serve on all interfaces
pnpm --filter @pantrio/web start:lan
# http://<your-lan-ip>:4200
```
