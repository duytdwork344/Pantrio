# Pantrio

Cooking community + recipe discovery + personal food inventory + shopping list.

**USP:** Nhà có gì → Nấu được gì?

## Monorepo layout

```text
Pantrio/
├── apps/
│   ├── api/       # NestJS + Prisma + OpenAPI
│   ├── web/       # Angular (discovery / recipe / blog)
│   └── mobile/    # Flutter (inventory / shopping)
├── packages/
│   ├── shared/      # Shared TS enums / role permissions
│   ├── api-client/  # OpenAPI → TypeScript client
│   └── config/
├── infra/
│   └── compose.yml  # Postgres, Redis, MinIO
└── docs/
    └── requirements.md
```

## Stack

| Layer | Tool |
|-------|------|
| Backend | NestJS, Prisma, Swagger/OpenAPI |
| Web | Angular 19 (standalone, SCSS) |
| Mobile | Flutter |
| Database | PostgreSQL (+ Redis, MinIO) |

## Prerequisites

- Node.js 22+
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop
- Flutter SDK (for `apps/mobile`)

## Quick start

```bash
# 1) Install JS workspace deps
pnpm install

# 2) Start Postgres / Redis / MinIO
pnpm docker:up

# 3) Generate Prisma client + run migrations
pnpm --filter @pantrio/api exec prisma migrate dev --name init

# 4) Seed roles, foods, bootstrap users
pnpm --filter @pantrio/api db:seed

# 5) Run API + Web
pnpm dev:api
pnpm dev:web
```

- API: http://localhost:3001/api/health
- Swagger: http://localhost:3001/docs
- Web: http://localhost:4200

Bootstrap login (local only, password `password123`):

| Email | Role |
|-------|------|
| `admin@pantrio.app` | ADMIN |
| `creator@pantrio.app` | CREATOR |
| `moderator@pantrio.app` | MODERATOR |

Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run
```

## OpenAPI clients

```bash
# Export OpenAPI from NestJS (writes apps/api/openapi.json + packages/api-client/openapi.json)
pnpm openapi:export

# Generate TypeScript client types
pnpm openapi:generate

# Flutter generator helper
bash apps/mobile/tool/generate_api.sh
```

## Domain modules (API)

Bounded contexts under `apps/api/src`:

- `recipes`, `inventory`, `shopping` — MVP wired
- placeholders for `auth`, `users`, `rbac`, `catalog`, `articles`, `planning`, `recommendation`, `media`

See [docs/requirements.md](docs/requirements.md) for product principles (approximate inventory, FEFO batches, Article ≠ Recipe).

Implementation progress: [docs/implementation-checklist.md](docs/implementation-checklist.md).
