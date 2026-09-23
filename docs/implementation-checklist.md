# Pantrio — Implementation Checklist

Bám file này khi implement. Chi tiết domain: [requirements.md](./requirements.md) (đặc biệt mục **3b**, **3c**, **4.1**, **4.2b**, **4.2c**, **4.2d**, **7b**, **7c**, **25. MVP**).

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

Tham chiếu: requirements **7**, **7b**, **7b.7**, **7b.8**.

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
- [ ] Approve recipe: **check trùng** Food PRIVATE mới → merge/promote (gắn khi làm **4.2b**)
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

## 3c. Media — upload ảnh (phase sau; requirements **4.2d**)

Object storage MinIO (local) → S3-compatible (prod). Không file server tự viết trên VPS. `imageUrl` string đủ MVP.

- [x] Docs đã ghi hướng (**4.2d**) — MinIO/`S3_*`, form-data MVP, presign sau, tạo+sửa+sau cook
- [x] Media module API: client S3 (MinIO) từ env `S3_*`; bucket `pantrio-media`
- [x] `POST /media` multipart form-data (JWT) → validate mime/size → put object → `{ url }`
- [ ] (Sau) `POST /media/presign` + client PUT thẳng storage
- [x] Policy: user-generated URL thuộc bucket hệ thống (MVP: trả URL từ `S3_PUBLIC_BASE_URL`); xóa object cũ — sau
- [x] Wire **Group cookbook**: optional ảnh lúc tạo; **Add/Change photo** trên detail (PATCH imageUrl)
- [x] Mobile: image picker + upload + PATCH `/groups/me/recipes/:id`
- [ ] (Cùng pipeline) Catalog CREATOR / Food / Article cover khi sẵn sàng
- [ ] Deploy note: VPS chạy API; đổi `S3_*` sang MinIO/S3 prod — không đổi schema Recipe (khi lên prod)

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
- [ ] Creator: tạo/sửa recipe + ingredients (typeahead Food)
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
- [ ] Mode CREATOR/ADMIN/MODERATOR (surface theo `/users/me` permissions)
- [ ] Notifications expiry — Phase 2
- [x] Cook / recommendations UI

---

## 10. Docs & quality

- [x] requirements: Food / Inventory / RecipeIngredient decisions (**7b**)
- [x] requirements: Moderator merge (**7b.7**)
- [x] requirements: FoodAlias phase sau (**7b.8**)
- [x] requirements: InventoryGroup dual scope (**7c**)
- [x] requirements: Media / upload ảnh (**4.2d**)
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
11. **Media upload (4.2d / checklist 3c)** — MinIO `POST /media` → wire tạo/sửa cookbook + sau cook → catalog/food sau
12. Phase sau: multi-group, OAuth (**3b**), CreatorRequest (**3c**), Recipe moderation (**4.2b**), FoodAlias (**7b.8**), AI scan, tracked share URL, …

---

## Ghi chú nhanh

- Swagger: `pnpm dev:api` → http://localhost:3001/docs  
- Studio: `pnpm db:studio` → http://localhost:5555  
- Seed: `pnpm db:seed` (roles + foods + `admin@` / `creator@` / `moderator@` — password `password123`)  
- Khớp recipe ↔ inventory **chỉ qua `foodId`**, không qua tên string.
- Unit MVP chuẩn: `g` | `kg` | `ml` | `l` | `pcs` (`@pantrio/shared` `Unit`).
- InventoryGroup (**7c** / checklist **6a**): Personal | Group tabs; share Inventory + Shopping; 1 group/user MVP; invite code; purchase cùng scope.
- Media (**4.2d** / checklist **3c**): MinIO `pantrio-media` + `S3_*`; form-data MVP; tạo+sửa recipe (đặc biệt cookbook group / sau cook).
