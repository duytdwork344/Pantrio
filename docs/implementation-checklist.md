# Pantrio — Implementation Checklist

Bám file này khi implement. Chi tiết domain: [requirements.md](./requirements.md) (đặc biệt mục **2b**, **2c**, **3b**, **3c**, **4.1**, **4.2b**, **4.2c**, **4.2d**, **4.2e**, **7b**, **7b.9**, **7b.10**, **7c**, **25. MVP**).

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

## 0b. Đa ngôn ngữ — i18n (API + Web + Mobile) — làm trước polish

Tham chiếu: requirements **2b**. Locale hiện tại: `vi` (default) + `en`; thêm ngôn ngữ sau = thêm dữ liệu / file dịch.

### 0b.1 Nền tảng (không đổi UI)

- [x] Shared: locale registry (`LOCALES` + `localeChain` / `negotiateLocale`) trong `@pantrio/shared` (`src/i18n.ts`)
- [x] API: `User.locale` (nullable) + `PATCH /users/me` đổi ngôn ngữ; register nhận `locale` optional
- [x] API: resolve locale `?locale=` → `Accept-Language` → `User.locale` → `DEFAULT_LOCALE` (`LocaleMiddleware` + `LocaleInterceptor`, AsyncLocalStorage; `pickTranslation()` tự dùng locale request); header `Content-Language`
- [x] API: chuẩn lỗi `{ statusCode, code, message, params?, details? }` (`ApiExceptionFilter` + `AppException`, `ErrorCode` trong shared); auth/users đã dùng code riêng, module khác code theo HTTP status — chuyển dần
- [x] `Nutrient.nameEn/nameVi` → `NutrientTranslation` + backfill (migration `20261106100000_i18n_foundation`); API trả `name` + giữ `nameEn/nameVi` (deprecated)
- [x] Mobile: `flutter_localizations` + `intl` + ARB (`gen-l10n`), file `vi` + `en`; interceptor `Accept-Language`; `LocaleController` + sheet chọn ngôn ngữ
- [x] Mobile: bỏ default `locale = 'en'` → theo app locale (`pantrio_api_client.dart`)
- [x] Web: Transloco + JSON `vi` / `en` (`public/i18n`); interceptor `Accept-Language`; `LocaleService` + chọn ngôn ngữ trên shell
- [x] Nhãn enum / đơn vị theo key (`difficulty.*`, `storage.*`, `unit.*`) Web + Mobile — áp dụng dần khi polish từng màn
- [x] Formatter ngày / số theo locale (Web `fmtDate` / `fmtNumber`, Mobile `formatDate` / `formatNumber` / `formatQuantity`) — tiền khi có giá
- [x] Script parity key + đủ `ErrorCode` + enum: `pnpm i18n:check` (gắn vào CI khi có CI)

### 0b.2 Nội dung Recipe / Article nhiều ngôn ngữ

- [ ] Schema: `sourceLocale` trên Recipe / Article
- [ ] Schema: `RecipeTranslation`, `RecipeStepTranslation`, `RecipeIngredientTranslation`, `ArticleTranslation` (`origin`, `translatedById`)
- [ ] Migration backfill từ cột cũ (`locale = sourceLocale`); seed EN sửa `sourceLocale = en`
- [ ] API read: chọn translation theo locale → fallback → `sourceLocale`; trả `availableLocales[]` + `displayLocale`
- [ ] API write: create/update nhận `translations[]`; validate tab đủ trường bắt buộc (không lưu translation nửa vời)
- [ ] `RecipeRevision.translationsJson`; approve copy translations
- [ ] Moderator bổ sung translation: trong review PENDING, hoặc revision tự approve khi không có PENDING
- [ ] Moderation queue: filter “Thiếu bản <locale>”
- [ ] Article: moderator sửa translation trực tiếp (ghi `origin`)
- [ ] Group cookbook: cùng bảng translation, member sửa trực tiếp
- [ ] OpenSearch: field theo locale (`title.vi`, `title.en`) + reindex
- [ ] Discover: ưu tiên bài có locale người xem + filter “Chỉ món có ngôn ngữ của tôi”
- [ ] Drop cột cũ (`title`, `description`, `body`, `note`) sau khi client chuyển hết

---

## 0c. Polish UI theo IA mới (Web + Mobile)

Tham chiếu: requirements **2c**, thiết kế `design/Pantrio.figcraft`. Mỗi màn polish → tách chuỗi vào ARB / JSON (**0b**) + chuyển lỗi module đó sang `code`.

### Mobile

- [ ] `AppTheme` đầy đủ theo Foundations (màu, TextTheme, Card / Chip / Button / Input / NavigationBar / BottomSheet)
- [ ] Shell 5 tab: Nấu gì · Công thức · Kho · Đi chợ · Tôi; bỏ actions AppBar cũ
- [ ] Scope Cá nhân / Nhóm dùng chung toàn app (pill header, nhớ lựa chọn); bỏ `ScopeSegmentBar` / `GroupHeaderBar` ở từng tab
- [ ] Nấu gì: cảnh báo sắp hết hạn, Nấu được ngay / Thiếu 1–2, Kế hoạch tuần → tạo danh sách đi chợ
- [ ] Công thức: tab con Khám phá · Đã lưu · Sổ tay nhóm · Studio
- [ ] Kho: filter nơi cất, nhóm Sắp hết hạn, mở food → lô
- [ ] Đi chợ: CTA từ kế hoạch, đang mở / đã xong; detail nhóm theo loại + “Cho: <món>”
- [ ] Recipe detail: header Chia sẻ / Lưu, stepper khẩu phần, 3 tab, footer Lên kế hoạch · Nấu (tách widget từ `recipe_detail_page.dart`)
- [ ] Bottom sheet xác nhận nấu + API preview tiêu thụ FEFO (`POST /cook/preview` hoặc tương đương)
- [ ] Tôi: hồ sơ, nhóm (mã mời / đổi mã / rời), dinh dưỡng, lịch sử nấu, studio, ngôn ngữ, đăng xuất
- [ ] Editor recipe (cookbook + catalog): tab ngôn ngữ (**0b.2**)

### Web

- [ ] Nav mới + menu avatar (Dinh dưỡng, Ngôn ngữ, Đăng xuất)
- [ ] Khám phá: Hero → Gợi ý từ tủ → Mới hôm nay → Tất cả + filter → Bài viết
- [ ] Recipe detail 2 cột + panel sticky (Lưu / Chia sẻ / Lên kế hoạch)
- [ ] Trang Đã lưu `/me/saved` (cũng là mục **8**)
- [ ] Studio editor recipe / article: tab ngôn ngữ (**0b.2**)
- [ ] Moderation review: bổ sung bản dịch + filter thiếu locale

---

## 1. Auth / User / RBAC (API)

Tham chiếu: requirements **3**, **3b**, **3c**.

- [x] `POST /auth/register`
- [x] `POST /auth/login` + JWT
- [x] `GET /users/me` (roles + permissions)
- [x] Global JWT guard + `@Public()` + `@RequirePermissions()`
- [x] Seed Role / Permission (`pnpm db:seed`)
- [x] Seed bootstrap users: `admin@pantrio.app` (ADMIN), `creator@pantrio.app` (CREATOR), `moderator@pantrio.app` (MODERATOR) — password `password123`
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

Tham chiếu: requirements **7**, **7b**, **7b.7**, **7b.8**, **7b.9**.

- [x] Model `Food` (slug, measurementType, baseUnit) — không name trên Food
- [x] Model `FoodTranslation` (locale, name, category)
- [x] `GET /foods?q=&category=&locale=`
- [x] `GET /foods/:slug`
- [x] `POST /foods`, `PATCH /foods/:id` (`catalog:manage`)
- [x] Seed foods EN + VI
- [x] Schema: `visibility` (PUBLIC \| PRIVATE), `createdByUserId`
- [x] `POST /foods` cho USER/CREATOR → **PRIVATE** (manager có thể tạo PUBLIC) — **7b.4** / **7b.1**
- [x] Search: chỉ trả Food user được thấy (PUBLIC + PRIVATE của chính user; manager/moderator thấy thêm)
- [x] Moderator: list Food PRIVATE + reference counts — `GET /foods/moderation/private`
- [x] Moderator: merge Food (`fromFoodId` → `toFoodId`) + remap FK; **toFood auto-promote PUBLIC** — `POST /foods/moderation/merge`
- [x] Moderator: promote PRIVATE → PUBLIC — `POST /foods/:id/promote`
- [x] Moderator: list + dọn orphan Food PRIVATE — `GET /foods/moderation/orphans`, `DELETE /foods/:id`
- [x] Inventory / Shopping / Recipe: reject `foodId` PRIVATE không thuộc user
- [x] Approve recipe: **check trùng** Food PRIVATE mới → merge/promote (gắn **4.2b**)
- [ ] **FoodAlias** (bảng riêng, search) — **7b.8** (phase sau, không làm MVP)

---

## 2b. Nutrition — Nutrient + FoodNutrient (API + UI)

Tham chiếu: requirements **7b.9**.

- [x] Schema: `Nutrient` (code, unit, group, sortOrder) + `FoodNutrient` (foodId, nutrientId, amount, basisQty, basisUnit)
- [x] Migration; **không** thêm cột dinh dưỡng trên `Food`
- [x] Seed danh mục Nutrient lõi: `energy_kcal`, `protein`, `carb`, `fat`, `fiber`, `sugar`, `sodium`, … (UI MVP chỉ hiện một profile)
- [x] Seed `FoodNutrient` cho một phần Food PUBLIC lõi (per 100g / 100ml / 1 pcs)
- [x] API: Food detail/list kèm `nutrients[]`; `GET /foods/nutrients`; `PUT /foods/:id/nutrients` (`catalog:manage`)
- [x] Recipe detail: aggregate total + perServing từ ingredients; cờ incomplete khi thiếu data
- [x] Recipe nutrition: breakdown đóng góp theo từng food (`contributions[]`)
- [x] Web: hiện dinh dưỡng trên recipe detail (+ hover/tap breakdown)
- [x] Mobile: hiện dinh dưỡng trên recipe detail (+ tap breakdown)
- [x] Web moderator: form chỉnh FoodNutrient (`/moderation/nutrition`)
- [ ] (Sau) Denormalize kcal/serving lên OpenSearch / filter Discover
- [ ] (Sau) Auto-fill nutrient từ nguồn ngoài

### 2b.1 Nutrition targets (requirements **7b.10**)

Tham chiếu: bảng số Mifflin–St Jeor + activity + macro 20/30/50 đã chốt trong requirements.

- [x] Personal: `UserNutritionTarget` + `PUT /me/nutrition-target/compute|preset` + manual; engine Mifflin/TDEE/macro
- [x] Disclaimer trên API DTO + UI Web/Mobile
- [x] Recipe detail: `nutrition.targetComparison.perServingPercent` (auth); Web `/me/nutrition` + Mobile icon
- [ ] GroupNutritionProfile (không bắt buộc account); adult compute / child+preset; tổng hộ
- [ ] Link profile ↔ `userId` sau khi member join (không auto tạo profile khi join)
- [ ] (Sau) Group meal log + ước lượng serving/% + optional mirror personal diary — **không** gắn cook/inventory trong lát cắt đầu

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
- [x] **Kiểm duyệt nội dung Recipe** (API + màn Web `/moderation` — requirements **4.2b**)
- [x] Schema: `RecipeRevision` + `Recipe.publishedVersion` (catalog; cookbook không version)
- [x] Create/update catalog → revision `PENDING`; Discover chỉ bản `publishedVersion` + `PUBLIC`
- [x] Author/moderator đọc revision đang chờ; public không thấy draft
- [x] `POST /moderation/recipes/:id/approve|reject` kèm `version`; lệch version → 409
- [x] Approve recipe → Food PRIVATE có gợi ý thì bắt `merge` hoặc `promote`; không gợi ý thì promote PUBLIC; reject không public Food
- [x] Orphan Food: màn moderator list + xóa tay; không auto-delete
- [x] UI moderator (Web `/moderation`)

---

## 3b. Group Cookbook (API + Mobile) — ưu tiên trước 4.2b

Tham chiếu: requirements **4.2c**. Cookbook nội bộ theo InventoryGroup; USER không cần CREATOR.

- [x] Schema: `Recipe.groupId` (nullable FK InventoryGroup, Cascade) + `RecipeVisibility.GROUP` — migration `20260923140000_recipe_group_cookbook`
- [x] Invariant: `groupId` set ⇔ `visibility = GROUP` (create/update paths force GROUP; catalog rejects GROUP)
- [x] `GET/POST /groups/me/recipes`, `GET …/:slug`, `PATCH/DELETE …/:id` (membership; author hoặc OWNER sửa/xóa)
- [x] Discovery `GET /recipes` loại trừ `GROUP`; `GET /recipes/:slug` chỉ member thấy group recipe
- [x] Recommend/cook `groupId`: gồm `PUBLIC` + cookbook `GROUP` của group
- [x] Food usable: PUBLIC hoặc PRIVATE của actor (reuse `assertFoodUsable` — **7c**)
- [x] Mobile: tab **Group** cookbook (list + tạo tối thiểu) khi user có group
- [x] Leave/dissolve: cookbook ở lại khi member leave; cascade khi dissolve group (`onDelete: Cascade`)

---

## 3c. Media — upload ảnh (+ video ngắn) (requirements **4.2d**)

Object storage MinIO (local) → S3-compatible (prod). Không file server tự viết trên VPS. `imageUrl` / `videoUrl` string đủ MVP.

- [x] Docs đã ghi hướng (**4.2d**) — MinIO/`S3_*`, form-data MVP, presign sau, tạo+sửa+sau cook
- [x] Media module API: client S3 (MinIO) từ env `S3_*`; bucket `pantrio-media`
- [x] `POST /media` multipart form-data (JWT) → validate mime/size → put object → `{ url }`
- [x] `POST /media/video` — mp4/webm/mov ≤30MB → `Recipe.videoUrl`
- [x] Schema `Recipe.videoUrl` + `RecipeRevision.videoUrl`; Studio upload; Web sticky mini-player
- [ ] (Sau) `POST /media/presign` + client PUT thẳng storage; HLS / compress
- [x] Policy: user-generated URL thuộc bucket hệ thống (MVP: trả URL từ `S3_PUBLIC_BASE_URL`); xóa object cũ — sau
- [x] Wire **Group cookbook**: optional ảnh lúc tạo; **Add/Change photo** trên detail (PATCH imageUrl)
- [x] Mobile: image picker + upload + PATCH `/groups/me/recipes/:id`
- [x] Mobile: recipe video autoplay/loop + sticky PiP kéo thả (`video_player`)
- [ ] (Cùng pipeline) Catalog CREATOR / Food / Article cover khi sẵn sàng
- [ ] Deploy note: VPS chạy API; đổi `S3_*` sang MinIO/S3 prod — không đổi schema Recipe (khi lên prod)

---

## 3d. RecipeStep — bước + ảnh (requirements **4.2e**)

- [x] Docs **4.2e**
- [x] Schema `RecipeStep` + migration + backfill từ `instructions`
- [x] API detail trả `steps[]`; create/update nhận `steps` hoặc split `instructions`
- [x] Derive `instructions` từ steps khi ghi (tương thích cũ)
- [x] Mobile group cookbook: editor bước (text + ảnh optional) + viewer từng bước
- [x] Web catalog/creator step editor

---

## 3a. Article (API) — Phase 2

Tham chiếu: requirements **4.1** — tách khỏi Recipe; không chặn core loop MVP.

- [x] Prisma model `Article` (author, title, slug, body, …)
- [x] `GET /articles` (public list / published)
- [x] `GET /articles/:slug` (detail; draft chỉ author)
- [x] `POST /articles`, `PATCH /articles/:id` (CREATOR, `article:create` / author)
- [x] Publish flow (`publishedAt` null = draft; `publish` true/false)
- [x] `GET /me/articles` (bài của author, gồm draft)
- [x] Gắn Recipe vào Article (`ArticleRecipe`; create/update `recipeIds`; detail trả `recipes`)
- [x] Web: list + detail + Studio editor (new + edit draft by id; recipe picker; draft → `/studio/articles/:id`)
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
- [x] Group hiển thị theo foodId trên client (DB giữ batch riêng)
- [x] Mobile: edit batch (qty / unit / storage / expiry / opened / notes) — `PATCH /inventory/:id`
---

## 6. Shopping (API)

- [x] `GET /shopping-lists` (summary)
- [x] `POST /shopping-lists`, `GET/PATCH /shopping-lists/:id`
- [x] `DELETE /shopping-lists/:id`
- [x] `POST /shopping-lists/merge-from-lists` (copy + aggregate foodId+unit → PENDING; skip SKIPPED; sources unchanged)
- [x] `POST /shopping-lists/:id/reset` (PURCHASED/SKIPPED → PENDING; no Inventory change)
- [x] `POST/PATCH .../items` (thêm / sửa item tay)
- [x] `POST .../generate-from-planned` (PlannedRecipe − Inventory theo foodId+unit)
- [x] `POST .../items/:itemId/purchase` → InventoryItem + txn PURCHASE
---

## 6a. InventoryGroup — tủ & shopping chung (API + Mobile)

Tham chiếu: requirements **7c**. Mục tiêu: dual scope Personal | Group; share Inventory + Shopping; purchase list group → tủ group; MVP **1 user ≤ 1 group**.

### Đầu mục cần giải quyết

- [x] **Docs đã ghi hướng** (**7c**) — dual tab, invite code, 1 group/user, Planned personal, race, PRIVATE
- [x] Schema: `InventoryGroup`, `GroupMembership` (OWNER|MEMBER), invite (`code`, expiry, maxUses / rotate)
- [x] Ownership: `InventoryItem` + `ShoppingList` hỗ trợ scope personal **hoặc** `groupId` (nullable `groupId`)
- [x] `InventoryTransaction`: actor = `userId` người thao tác; chỗ trừ kho qua item.`groupId` / personal
- [x] API group: tạo / join-by-code / leave / rotate invite / `GET /groups/me` (MVP 1 group/user)
- [x] API inventory + shopping: `?groupId=` / body `groupId`; membership guard; purchase **cùng scope**
- [x] `generate-from-planned`: shortage theo stock **group** khi list thuộc group (Planned vẫn personal)
- [x] Race: atomic purchase (`updateMany` status PENDING→PURCHASED)
- [x] Race: cook/adjust quantity (row lock hoặc conditional UPDATE; optional `version`) — khi làm cook theo group
- [ ] Food PRIVATE trong group: policy tạm (PUBLIC + PRIVATE của actor) — ghi rõ / enforce thêm nếu cần
- [x] Cook / recommend / `inInventory` theo context group (sau khi inventory group ổn)
- [x] Mobile: tab **Personal | Group** (Inventory + Shopping); Group trống → Tạo / Join bằng mã
- [ ] Lifecycle: owner transfer khi còn member (hiện: owner leave chỉ khi sole → dissolve)
- [ ] Phase sau: nhiều group / user + picker trong tab Group

### Bước giải quyết ban đầu (làm theo thứ tự)

1. [x] **Chốt schema ownership** (nullable `groupId`) + migration `20260921100000_inventory_group`
2. [x] **Group module tối thiểu:** create, invite code, join, leave, rotate, `GET /groups/me`; enforce **1 group/user**
3. [x] **Mở inventory + shopping theo `groupId`** + purchase → batch cùng group; personal = `groupId` null
4. [x] **Mobile tabs Personal | Group** + màn Tạo/Join; wire API trên
5. [x] **Củng cố race** trên adjust/cook quantity khi đụng batch group — cook dùng `updateMany` + `quantity gte` + decrement
6. [x] Cook / recommend / `inInventory` theo group context
7. [ ] Owner transfer + policy Food PRIVATE trong group

Không làm trong 6a: FoodAlias, OR-foodId, multi-group, reservation kiểu TMĐT.

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
- [x] Auth (register / login / lưu JWT + interceptor)
- [x] Discover + recipe detail hydrate từ API
- [x] Article / blog list + detail + Studio (tag recipes; draft mở editor `/studio/articles/:id`)
- [x] Creator: tạo/sửa recipe + ingredients (typeahead Food)
- [ ] Saved recipes
- [ ] (Inventory chủ yếu Mobile; Web có thể read-only sau)

---

## 8a. Discover feed, pantry recommend cụm & intent share — Phase học

Mục tiêu: tách Discover thành **các cụm**; có tín hiệu tương tác (intent share) để sau này tie-break ranking; **chưa** OG/deep-link attribution.

### Discover UI — các cụm (Web; Mobile align khi tiện)

Không gộp một list rank duy nhất. Thứ tự đề xuất trên màn Discover:

- [x] Cụm **Gợi ý từ tủ (pantry recommend)** — tái sử dụng `GET …/recommendations/recipes` (Personal; optional Group sau)
  - Chỉ hiện khi user đã login; không tủ / không match → empty hoặc CTA (đăng nhập / thêm inventory) — tránh cụm trống xấu
  - Web: hydrate khi đã có auth (gọi recommend API; tủ quản lý trên Mobile)
- [ ] Cụm **Hôm nay / Mới** (recent và/hoặc featured-of-day) — để feed “đổi theo ngày”
- [x] Cụm **Articles** (strip trên Discover + link xem tất cả)
- [x] Cụm **Tất cả recipes** (catalog; đứng sau pantry)
- [x] Ô **Search recipes** trên Discover (Web + Mobile) → `GET /search/recipes` — checklist **8b**

### Pantry recommend — ranking (đã có nền + mở rộng)

API hiện tại đã sort: `canCook` trước → match ratio (`matchedCount/requiredCount`).

- [ ] Giữ **pantry là trục chính** của cụm Recommend (không để share/view át món thiếu nhiều đồ)
- [ ] Sau khi có tín hiệu engagement: **multi-signal tie-break / weight nhẹ**
  - `score ≈ w_p·pantry + w_e·engagement + w_r·recency` với \(w_p\) lớn nhất
  - Engagement: SAVE (đã có SavedRecipe), intent SHARE, (sau) VIEW
  - Chốt hệ số cụ thể lúc implement — giai đoạn này chỉ chốt nguyên tắc
- [ ] Cụm “Mới / Featured” **rank riêng** (recent/editorial), không dùng chung formula pantry

### Intent share (làm — tín hiệu thô cho học engagement)

- [x] Schema: event tối thiểu (vd. `ContentEvent` hoặc counter) — type `SHARE` (sau thêm `VIEW`)
- [x] API: `POST /recipes/:id/share` (optional Article) → event / `shareCount += 1`; auth optional hoặc bắt login (chốt lúc làm)
- [x] **Channel / “đích đến” mức intent** (học analytics — không chứng minh đã gửi thành công):
  - Field optional trên event/body: `channel` — vd. `copy` | `native` | `facebook` | `x` | `unknown`
  - Copy link → ghi `copy`
  - `navigator.share` / OS share sheet → ghi `native` (**không** biết app đích: Zalo/FB… — OS không trả)
  - (Sau, optional) nút/SDK mở đúng kênh → ghi tên kênh cụ thể
  - Không kỳ vọng biết “đã share tới user X”; chỉ biết *user chọn cách share nào*
- [x] Chống spam nhẹ (optional): rate-limit user+content / cửa sổ thời gian
- [x] Web (+ Mobile nếu tiện): nút Share trên detail → gọi API; copy link hoặc `navigator.share` — **+1 theo intent khi bấm**, không bắt share sheet thành công
- [x] Hiển thị `shareCount` trên detail (và list nếu cần)
- [ ] (Optional học) breakdown đơn giản theo `channel` — admin/debug hoặc field trên detail sau

### Cố ý chưa làm (giai đoạn sau — attribution / share thật)

- Open Graph meta, Universal/App Link
- Short / tracked link `?ref=` / `sid=` — đếm **inbound click/open** (outcome), khác với intent + channel
- Đếm share bằng referrer/UTM từ mạng xã hội
- Biết chắc đã gửi tới bạn bè trên Zalo/FB (thường không có, trừ in-app share đóng)
- Trending Discover chỉ dựa trên social (không pantry)
- Personalize sâu (follow creator, ML)

---

## 9. Mobile (Flutter)

- [x] Shell Inventory + Shopping
- [x] Auth + API client (dio + JWT via `SharedPreferences`)
- [x] Inventory list / add (search foods → tạo item) / delete
- [x] Shopping lists + detail / add item / purchase → inventory
- [x] Merge from existing lists → new list
- [x] Reset list to pending / delete list (UI + when all done)
- [x] Recipes: Discover / Saved / Planned + detail (save, plan, add ingredient → inventory)
- [x] Generate shopping from planned recipes (UI)
- [x] Inventory + Shopping: tab Personal | Group + create/join group (invite code)
- [x] Recipes: Cook tab (recommend Personal|Group) + recipe detail Cook / pantry scope
- [x] Cooking sessions: danh sách + chi tiết mức tiêu thụ + undo (Mobile, từ tab Cook)
- [x] Mode CREATOR/ADMIN: tab Studio trên Recipes khi có `recipe:create` (tạo/sửa catalog). MODERATOR surface — sau
- [ ] Notifications expiry — Phase 2
- [x] Cook / recommendations UI

---

## 8b. Recipe search (OpenSearch) — requirements **22**

- [x] Docker OpenSearch (`infra/compose.yml`, `:9200`, security disabled local)
- [x] Index `pantrio-recipes` + analyzer asciifolding
- [x] `GET /search/recipes` (q, difficulty, maxCookTimeMin); SQL fallback khi cluster down
- [x] Sync: boot reindex nếu index trống; `POST /search/recipes/reindex`; index lại sau approve catalog
- [x] Discover Web + Mobile gọi search khi có query
- [ ] (Sau) FoodAlias + index Food; semantic / hybrid

---

## 10. Docs & quality

- [x] requirements: Food / Inventory / RecipeIngredient decisions (**7b**)
- [x] requirements: Moderator merge (**7b.7**)
- [x] requirements: FoodAlias phase sau (**7b.8**)
- [x] requirements: Nutrition Nutrient + FoodNutrient (**7b.9**); Nutrition targets bảng số (**7b.10**)
- [x] requirements: InventoryGroup dual scope (**7c**)
- [x] requirements: Media / upload ảnh (**4.2d**)
- [x] requirements: RecipeStep (**4.2e**)
- [ ] OpenAPI export + regenerate `packages/api-client` sau mỗi domain lớn
- [ ] Seed admin user dev (optional)
- [ ] E2E smoke: register → create recipe → save → add inventory foodId

Note: bootstrap seed users cover admin/creator/moderator (`pnpm db:seed`).

---

## Thứ tự đề xuất (gần → xa)

1. **Recipe CRUD + ingredients + seed recipes** _(xong API)_  
2. **SavedRecipe + inInventory flags** _(xong)_  
3. **Inventory POST + search-first / from-recipe option** _(xong)_  
4. **Food PRIVATE cho USER** _(xong)_  
5. **Shopping generate + purchase → inventory** _(xong)_  
6. **Cook + estimated consume + recommendation** _(xong API)_  
7. **InventoryGroup (checklist 6a)** — schema → group API → inventory/shopping scope → Mobile tabs → race → cook/recommend group  
8. **Web/Mobile hydrate** còn lại (Creator recipe trên Web; Mobile Cook UI nếu chưa gộp vào 6a)  
9. **Discover cụm + intent share + pantry multi-signal** (checklist **8a**) — trước OG/deep-link attribution  
10. **Group Cookbook (4.2c / checklist 3b)** — schema → group recipe API → recommend group → Mobile tab _(xong API + tab)_
11. **Media upload (4.2d / checklist 3c)** — MinIO `POST /media` (+ `POST /media/video` / `Recipe.videoUrl` sticky Web) → cookbook + catalog Studio
12. **RecipeStep (4.2e / checklist 3d)** — schema → API steps → Mobile cookbook editor/viewer _(xong; Web creator sau)_
13. **Recipe search OpenSearch (checklist 8b / requirements 22)** — Docker → index → `GET /search/recipes` → Discover _(xong lát cắt recipe)_
14. **Nutrition (checklist 2b / requirements 7b.9)** — Nutrient seed → FoodNutrient → recipe aggregate → Web/Mobile _(xong lát cắt MVP)_
15. **Nutrition targets (checklist 2b.1 / requirements 7b.10)** — personal Mifflin/macro + recipe % _(xong lát cắt personal; group profile sau)_
16. **i18n nền (checklist 0b.1 / requirements 2b)** — UI strings Web/Mobile + `User.locale` + `Accept-Language` + enum labels + `NutrientTranslation` _(tiếp theo)_
17. **Nội dung đa ngôn ngữ (checklist 0b.2)** — translation Recipe/Article + backfill + revision `translationsJson` + moderator bổ sung
18. **Polish UI theo IA (checklist 0c / requirements 2c)** — theme → shell 5 tab → từng màn (tách chuỗi i18n cùng lúc)
19. Phase sau: multi-group, OAuth (**3b**), CreatorRequest (**3c**), FoodAlias (**7b.8**), Discover filter kcal, diary/meal log, AI scan, tracked share URL, barcode/Mart (**requirements 27** — đã bàn, chưa làm), …

---

## Ghi chú nhanh

- Swagger: `pnpm dev:api` → http://localhost:3001/docs  
- Studio: `pnpm db:studio` → http://localhost:5555  
- Seed: `pnpm db:seed` (roles + foods + `admin@` / `creator@` / `moderator@` — password `password123`)  
- Khớp recipe ↔ inventory **chỉ qua `foodId`**, không qua tên string.
- Unit MVP chuẩn: `g` | `kg` | `ml` | `l` | `pcs` (`@pantrio/shared` `Unit`).
- InventoryGroup (**7c** / checklist **6a**): Personal | Group tabs; share Inventory + Shopping; 1 group/user MVP; invite code; purchase cùng scope.
- Media (**4.2d** / checklist **3c**): MinIO `pantrio-media` + `S3_*`; form-data MVP; tạo+sửa recipe (đặc biệt cookbook group / sau cook).
- Recipe search (**8b**): OpenSearch `localhost:9200`; `GET /search/recipes`; Food typeahead vẫn SQL.
- Nutrition (**7b.9** / checklist **2b**): `Nutrient` + `FoodNutrient`; recipe aggregate; không cột dinh dưỡng trên `Food`.
- Nutrition targets (**7b.10** / checklist **2b.1**): Mifflin–St Jeor + activity × TDEE + macro 20/30/50; personal + group profile; diary mức C sau.
