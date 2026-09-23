# Pantrio Mobile (Flutter)

Hydrated against Nest API: **Auth**, **Inventory**, **Shopping**, **Recipes / Group Cookbook**, **Media upload**.

## Run (desktop / simulator)

```bash
# from repo root
pnpm docker:up          # Postgres + Redis + MinIO (:9000)
pnpm dev:api            # Nest :3001
pnpm db:seed            # optional

cd apps/mobile
flutter pub get
flutter run
```

Login seed: `admin@pantrio.app` / `password123` (or any registered user).

## Run on phone (LAN)

1. Same Wi‑Fi as your Mac. Get Mac IP, e.g. `ipconfig getifaddr en0` → `192.168.x.x`.

2. In `apps/api/.env` set (then **restart** API):

```env
CORS_ORIGIN="http://localhost:4200,http://192.168.x.x:4200"
S3_ENDPOINT="http://localhost:9000"
S3_PUBLIC_BASE_URL="http://192.168.x.x:9000"
```

`S3_PUBLIC_BASE_URL` is the URL **phones** use to load uploaded images (must be LAN IP, not `localhost`).

3. Start infra + API:

```bash
pnpm docker:up
pnpm dev:api
```

4. Optional web on LAN:

```bash
# apps/web/src/environments/environment.local.ts → apiBaseUrl http://192.168.x.x:3001/api
pnpm --filter @pantrio/web start:lan
```

5. Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3001/api
```

| Target | API | MinIO images (`S3_PUBLIC_BASE_URL`) |
|--------|-----|--------------------------------------|
| iOS Simulator | `http://127.0.0.1:3001/api` | `http://127.0.0.1:9000` ok |
| Android Emulator | `http://10.0.2.2:3001/api` | `http://10.0.2.2:9000` |
| Physical phone | `http://192.168.x.x:3001/api` | `http://192.168.x.x:9000` |

MinIO console (optional): http://localhost:9001 (`pantrio` / `pantriodev`).

## Media upload

- `POST /api/media` (multipart `file`) → `{ url }` stored on `Recipe.imageUrl`.
- Group cookbook: optional photo on **create**; **Add/Change photo** on recipe detail (camera or library).
- Bucket: `pantrio-media` (anonymous download enabled in Compose).

## MVP flows

- Sign in (JWT in `SharedPreferences`)
- Recipes: Discover / Cook / **Group** cookbook / Saved / Planned
- Inventory + Shopping: Personal | Group tabs
- Upload recipe photo via gallery → MinIO → show in list/detail
