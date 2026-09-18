# Pantrio Mobile (Flutter)

Hydrated against Nest API: **Auth**, **Inventory**, **Shopping**.

## Run

1. Start API: `pnpm dev:api` (port `3001`, prefix `/api`)
2. Seed if needed: `pnpm db:seed`  
   Login: `admin@pantrio.app` / `password123` (or any registered user)
3. Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run
```

### API base URL

| Target | Default |
|--------|---------|
| iOS Simulator / desktop | `http://127.0.0.1:3001/api` |
| Android Emulator | `http://10.0.2.2:3001/api` |

Override:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3001/api
```

## MVP flows

- Sign in (JWT stored in `SharedPreferences`)
- Inventory: list / pull-to-refresh / add (food search → batch) / swipe delete
- Shopping: create list / open detail / add item / purchase → inventory

## Notes

- Food search respects visibility (PUBLIC + own PRIVATE).
- Creating a food from inventory add makes a **PRIVATE** food for the signed-in user.
