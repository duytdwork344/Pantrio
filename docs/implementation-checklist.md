# Pantrio — Implementation Checklist

Bám file này khi implement. Chi tiết domain: [requirements.md](./requirements.md) (đặc biệt mục **3b**, **3c**, **4.1**, **4.2b**, **7b**, **25. MVP**).

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
- [x] Schema: `visibility` (PUBLIC \| PRIVATE), `createdByUserId`
- [x] `POST /foods` cho USER/CREATOR → **PRIVATE** (manager có thể tạo PUBLIC) — **7b.4** / **7b.1**
- [ ] Approve recipe: **check trùng** Food PRIVATE mới → trùng thì Moderator **merge**, không trùng thì **promote → PUBLIC** — **4.2b** / **7b.7**
- [x] Search: chỉ trả Food user được thấy (PUBLIC + PRIVATE của chính user; manager/moderator thấy thêm)
- [ ] Moderator: list Food PRIVATE + reference counts — **7b.7**
- [ ] Moderator: merge Food (`fromFoodId` → `toFoodId`) + remap FK — **7b.7**
- [ ] Moderator: promote PRIVATE → PUBLIC (tay; ngoài promote sau approve khi không trùng) — **7b.7**
- [ ] Moderator: list + dọn orphan Food PRIVATE (không auto-delete) — **7b.7**
- [ ] **FoodAlias** (bảng riêng, search) — **7b.8** (phase sau, không làm MVP)

---

## 3. Recipe (API) — tiếp theo ưu tiên

- [x] `GET /recipes` (public list — skeleton)
- [x] `GET /recipes/:slug` (detail + ingredients; food name qua translation)
- [x] `POST /recipes` (CREATOR, `recipe:create`)
- [x] `PATCH /recipes/:id` (author / `recipe:update`; elevated moderation/system)
- [x] Gắn `RecipeIngredient[]` (foodId + quantity + unit + optional + sortOrder)
- [x] Khi tạo ingredient: chọn Food có sẵn (search); thiếu thì tạo Food **PRIVATE** qua `POST /foods` rồi gắn `foodId` — **7b.1**
- [ ] Tags (optional MVP)
- [x] Seed 1–2 recipe mẫu (Carbonara, Chicken Tomato Pasta) + ingredients
- [x] `GET /recipes/:slug` kèm cờ `inInventory` / `saved` khi có JWT — **7b.3**
- [ ] **Kiểm duyệt nội dung Recipe** (phase sau — requirements **4.2b**; không chặn MVP CRUD)
  - [ ] Schema: `moderationStatus` PENDING \| APPROVED \| REJECTED (tách khỏi `visibility`)
  - [ ] Create/update → PENDING khi submit discovery; author vẫn xem/sửa bản mình
  - [ ] Discovery list/detail chỉ `PUBLIC` + `APPROVED`
  - [ ] Moderator API: list pending + approve/reject (`moderation:manage`)
  - [ ] Approve recipe → check trùng Food PRIVATE mới → merge (Moderator) hoặc promote PUBLIC; reject không auto-public Food
  - [ ] Orphan Food: Moderator list/dọn; không auto-delete

---

## 3a. Article (API) — Phase 2

Tham chiếu: requirements **4.1** — tách khỏi Recipe; không chặn core loop MVP.

- [x] Prisma model `Article` (author, title, slug, body, …)
- [ ] `GET /articles` (public list / published)
- [ ] `GET /articles/:slug` (detail)
- [ ] `POST /articles`, `PATCH /articles/:id` (CREATOR, `article:create` / author)
- [ ] Publish flow (`publishedAt` null = draft)
- [ ] Optional: gắn / embed Recipe vào Article (schema quan hệ — chốt khi làm; Recipe vẫn độc lập)
- [ ] Web: list + detail + creator editor (discovery/blog surface)
- [ ] (Sau) kiểm duyệt Article nếu mở cộng đồng — có thể mirror **4.2b** hoặc đơn giản hơn

---

## 4. Planning — Saved / Planned (API)

- [x] `POST /recipes/:id/save` / unsave (`SavedRecipe`)
- [x] `GET /me/saved-recipes`
- [x] PlannedRecipe: `GET/POST /me/planned-recipes`, `PATCH/DELETE /me/planned-recipes/:id`
- [x] Thêm vào tủ từ recipe: dùng `POST /inventory` với `foodId` từ ingredients (`inInventory` trên detail) — **7b.3**
  - Chỉ tạo `InventoryItem` với **cùng foodId**; không ghi quantity từ RecipeIngredient vào tủ một cách tự động bắt buộc

---

## 5. Inventory (API)

Tham chiếu: **7b.2–7b.4** — RecipeIngredient **không** mutate Inventory.

- [x] `GET /inventory` (list batches, JWT + `inventory:manage`)
- [x] `POST /inventory` — tạo batch `{ foodId, quantity, unit, … }` (+ transaction PURCHASE)
- [x] `PATCH /inventory/:id` (quantity / unit → ADJUSTMENT transaction)
- [x] `DELETE /inventory/:id` (DISPOSE rồi xóa batch)
- [x] Typeahead add: gọi `GET /foods?q=` trước khi tạo Food mới — **7b.4** (API visibility sẵn; UI client hydrate sau)
- [x] Option thêm từ recipe context (foodId có sẵn qua detail / saved) — **7b.3**
- [x] `InventoryTransaction` khi tạo / đổi số lượng (PURCHASE / ADJUSTMENT)
- [x] FEFO khi consume (Cook)
- [ ] Group hiển thị theo foodId trên client (DB giữ batch riêng)

---

## 6. Shopping (API)

- [x] `GET /shopping-lists` (summary)
- [x] `POST /shopping-lists`, `GET/PATCH /shopping-lists/:id`
- [x] `POST/PATCH .../items` (thêm / sửa item tay)
- [x] `POST .../generate-from-planned` (PlannedRecipe − Inventory theo foodId+unit)
- [x] `POST .../items/:itemId/purchase` → InventoryItem + txn PURCHASE

---

## 7. Cook / Consumption / Recommendation (API)

- [x] CookingSession (`POST /cook`, `GET /cooking-sessions`, `GET /cooking-sessions/:id`)
- [x] Cook → `ESTIMATED_CONSUME` (FEFO batches; g↔kg, ml↔l)
- [x] Undo (`POST /cooking-sessions/:id/undo`) — hoàn trả batch + xóa session
- [x] Recommendation rule-based (`GET /recommendations/recipes`) — canCook / missing
- [x] Endpoint gợi ý “nhà có gì → nấu được gì?”

---

## 8. Web (Angular)

- [x] Skeleton Discover + recipe detail (demo data)
- [ ] Auth (register / login / lưu JWT)
- [ ] Discover + recipe detail hydrate từ API
- [ ] Creator: tạo/sửa recipe + ingredients (typeahead Food)
- [ ] Article / blog hydrate từ API (Phase 2 — checklist **3a**)
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

Note: bootstrap seed users already cover admin/creator (`pnpm db:seed`).

---

## Thứ tự đề xuất (gần → xa)

1. **Recipe CRUD + ingredients + seed recipes**  
2. **SavedRecipe + inInventory flags**  
3. **Inventory POST + search-first / from-recipe option**  
4. **Food PRIVATE cho USER** (schema visibility)  
5. **Shopping generate + purchase → inventory**  
6. **Cook + estimated consume + recommendation**  
7. **Web/Mobile hydrate** theo surface (Web discovery/creator, Mobile inventory)  
8. Phase sau: Article (**4.1** / checklist **3a**), OAuth 2.0 (requirements **3b**), CreatorRequest (**3c**), Recipe moderation (**4.2b**), Moderation console (API + Web), moderator merge Food, FoodAlias, AI scan, …

---

## Ghi chú nhanh

- Swagger: `pnpm dev:api` → http://localhost:3001/docs  
- Studio: `pnpm db:studio` → http://localhost:5555  
- Seed: `pnpm db:seed` (roles + foods + `admin@` / `creator@` — password `password123`)  
- Khớp recipe ↔ inventory **chỉ qua `foodId`**, không qua tên string.
- Unit MVP chuẩn: `g` | `kg` | `ml` | `l` | `pcs` (`@pantrio/shared` `Unit`).
