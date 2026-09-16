# Pantrio — Implementation Checklist

Bám file này khi implement. Chi tiết domain: [requirements.md](./requirements.md) (đặc biệt mục **3b**, **3c**, **4.2b**, **7b**, **25. MVP**).

Cách dùng: đổi `[ ]` → `[x]` khi xong; ghi ngày / PR nếu cần.

---

## Legend

| Ký hiệu | Ý nghĩa |
|--------|---------|
| API | NestJS |
| Web | Angular |
| Mobile | Flutter |
| Infra | Docker / DB / tooling |

---

## 0. Foundation

- [x] Monorepo (`apps/api`, `apps/web`, `apps/mobile`, `packages/*`)
- [x] Docker Compose: Postgres, Redis, MinIO
- [x] Prisma schema + migrate init
- [x] Swagger tại `/docs` (`pnpm dev:api` → http://localhost:3001/docs)
- [x] Shared enums / permissions (`@pantrio/shared`)
- [x] Git repo
- [ ] Commit / push đồng bộ toàn bộ thay đổi Catalog + Auth + docs (nếu còn dirty)
- [ ] CI cơ bản (lint / test / migrate check) — sau

---

## 1. Auth / User / RBAC (API)

Tham chiếu: requirements **3**, **3b**, **3c**.

- [x] `POST /auth/register`
- [x] `POST /auth/login` + JWT
- [x] `GET /users/me` (roles + permissions)
- [x] Global JWT guard + `@Public()` + `@RequirePermissions()`
- [x] Seed Role / Permission (`pnpm db:seed`)
- [x] Seed bootstrap users: `admin@pantrio.app` (ADMIN), `creator@pantrio.app` (CREATOR) — password `password123`
- [x] `GET /rbac/roles`, `POST /rbac/assign` (admin-oriented; dùng tay khi dev)
- [ ] Refresh token (optional, sau MVP)
- [ ] **Lên CREATOR** — request → admin/moderator duyệt (không self-serve) — requirements **3c**
  - [ ] Model `CreatorRequest` (userId, note?, status PENDING|APPROVED|REJECTED)
  - [ ] `POST /creator-requests` (USER đã login; 1 pending tại một thời điểm)
  - [ ] `GET /creator-requests` + approve/reject (`user:manage` / moderation)
  - [ ] Approve → gán role `CREATOR` (reuse `rbac.assign`); client refresh `/users/me`
  - [ ] Web/Mobile UX xin quyền creator (Phase 2 sản phẩm — không chặn Recipe CRUD khi seed/assign tay)
- [ ] **OAuth 2.0** (Google / Apple, …) — **không làm ngay**; Phase 2 — xem requirements **3b**
  - [ ] Model `OAuthAccount` / `AuthIdentity` (provider + providerUserId)
  - [ ] `User.passwordHash` nullable (account OAuth-only)
  - [ ] OAuth callback → cùng JWT API như password login
  - [ ] Web + Mobile Sign-in buttons

---

## 2. Catalog — Food (API)

Tham chiếu: requirements **7**, **7b**, **7b.7**, **7b.8**.

- [x] Model `Food` (slug, measurementType, baseUnit) — không name trên Food
- [x] Model `FoodTranslation` (locale, name, category)
- [x] `GET /foods?q=&category=&locale=`
- [x] `GET /foods/:slug`
- [x] `POST /foods`, `PATCH /foods/:id` (`catalog:manage`)
- [x] Seed foods EN + VI
- [ ] Schema: `visibility` (PUBLIC \| PRIVATE), `createdByUserId`
- [ ] `POST /foods` cho USER tạo **PRIVATE** (khi search không đủ) — **7b.4**
- [ ] Nới quyền CREATOR tạo Food PUBLIC khi viết recipe (hoặc qua recipe flow)
- [ ] Search: chỉ trả Food user được thấy (PUBLIC + PRIVATE của chính user)
- [ ] Moderator: list Food PRIVATE + reference counts — **7b.7**
- [ ] Moderator: merge Food (`fromFoodId` → `toFoodId`) + remap FK — **7b.7**
- [ ] Moderator: promote PRIVATE → PUBLIC — **7b.7**
- [ ] **FoodAlias** (bảng riêng, search) — **7b.8** (phase sau, không làm MVP)

---

## 3. Recipe (API) — tiếp theo ưu tiên

- [x] `GET /recipes` (public list — skeleton)
- [x] `GET /recipes/:slug` (detail + ingredients; food name qua translation)
- [x] `POST /recipes` (CREATOR, `recipe:create`)
- [x] `PATCH /recipes/:id` (author / `recipe:update`; elevated moderation/system)
- [x] Gắn `RecipeIngredient[]` (foodId + quantity + unit + optional + sortOrder)
- [ ] Khi tạo ingredient: chọn Food có sẵn (search); CREATOR có thể tạo Food nếu thiếu
- [ ] Tags (optional MVP)
- [x] Seed 1–2 recipe mẫu (Carbonara, Chicken Tomato Pasta) + ingredients
- [ ] `GET /recipes/:slug` kèm cờ `inInventory` per foodId (user đã login) — **7b.3**
- [ ] **Kiểm duyệt nội dung Recipe** (phase sau — requirements **4.2b**; không chặn MVP CRUD)
  - [ ] Schema: `moderationStatus` PENDING \| APPROVED \| REJECTED (tách khỏi `visibility`)
  - [ ] Create/update → PENDING khi submit discovery; author vẫn xem/sửa bản mình
  - [ ] Discovery list/detail chỉ `PUBLIC` + `APPROVED`
  - [ ] Moderator API: list pending + approve/reject (`moderation:manage`)

---

## 4. Planning — Saved / Planned (API)

- [ ] `POST /recipes/:id/save` / unsave (`SavedRecipe`)
- [ ] `GET /me/saved-recipes`
- [ ] PlannedRecipe + servings + plannedFor (MVP tối thiểu)
- [ ] UI/API: từ saved recipe → danh sách ingredients + option “Thêm vào tủ” nếu thiếu foodId — **7b.3**
  - Chỉ tạo `InventoryItem` với **cùng foodId**; không ghi quantity từ RecipeIngredient vào tủ một cách tự động bắt buộc

---

## 5. Inventory (API)

Tham chiếu: **7b.2–7b.4** — RecipeIngredient **không** mutate Inventory.

- [x] `GET /inventory` (list batches, JWT + `inventory:manage`)
- [ ] `POST /inventory` — tạo batch `{ foodId, quantity, unit, … }`
- [ ] `PATCH /inventory/:id`, adjust / dispose
- [ ] Typeahead add: gọi `GET /foods?q=` trước khi tạo Food mới — **7b.4**
- [ ] Option thêm từ recipe context (foodId có sẵn) — **7b.3**
- [ ] `InventoryTransaction` khi thay đổi số lượng
- [ ] FEFO khi consume (sau khi có Cook)
- [ ] Group hiển thị theo foodId trên client (DB giữ batch riêng)

---

## 6. Shopping (API)

- [x] `GET /shopping-lists` (summary stub)
- [ ] Create / update shopping list + items
- [ ] Generate list từ PlannedRecipe − Inventory (diff theo foodId)
- [ ] Mark purchased → tạo / cộng Inventory (+ transaction PURCHASE)

---

## 7. Cook / Consumption / Recommendation (API)

- [ ] CookingSession
- [ ] Cook → `ESTIMATED_CONSUME` (FEFO batches)
- [ ] Undo / adjust consumption
- [ ] Recommendation rule-based: recipe nào “đủ” / thiếu gì theo inventory approximate
- [ ] Endpoint gợi ý “nhà có gì → nấu được gì?”

---

## 8. Web (Angular)

- [x] Skeleton Discover + recipe detail (demo data)
- [ ] Auth (register / login / lưu JWT)
- [ ] Discover + recipe detail hydrate từ API
- [ ] Creator: tạo/sửa recipe + ingredients
- [ ] Saved recipes
- [ ] (Inventory chủ yếu Mobile; Web có thể read-only sau)

---

## 9. Mobile (Flutter)

- [x] Shell Inventory + Shopping (placeholder data)
- [ ] Auth + API client (dio / OpenAPI)
- [ ] Inventory list / add (search foods → tạo item)
- [ ] Thêm food vào tủ từ recipe đã lưu
- [ ] Shopping lists
- [ ] Notifications expiry — Phase 2

---

## 10. Docs & quality

- [x] requirements: Food / Inventory / RecipeIngredient decisions (**7b**)
- [x] requirements: Moderator merge (**7b.7**)
- [x] requirements: FoodAlias phase sau (**7b.8**)
- [ ] OpenAPI export + regenerate `packages/api-client` sau mỗi domain lớn
- [ ] Seed admin user dev (optional)
- [ ] E2E smoke: register → create recipe → save → add inventory foodId

---

## Thứ tự đề xuất (gần → xa)

1. **Recipe CRUD + ingredients + seed recipes**  
2. **SavedRecipe + inInventory flags**  
3. **Inventory POST + search-first / from-recipe option**  
4. **Food PRIVATE cho USER** (schema visibility)  
5. **Shopping generate + purchase → inventory**  
6. **Cook + estimated consume + recommendation**  
7. **Web/Mobile hydrate** theo surface (Web discovery/creator, Mobile inventory)  
8. Phase sau: OAuth 2.0 (**3b**), CreatorRequest (**3c**), Recipe moderation (**4.2b**), moderator merge Food, FoodAlias, AI scan, …

---

## Ghi chú nhanh

- Swagger: `pnpm dev:api` → http://localhost:3001/docs  
- Studio: `pnpm db:studio` → http://localhost:5555  
- Seed: `pnpm db:seed` (roles + foods + `admin@` / `creator@` — password `password123`)  
- Khớp recipe ↔ inventory **chỉ qua `foodId`**, không qua tên string.
