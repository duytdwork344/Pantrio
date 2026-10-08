Cooking Platform — Product Requirements

Working document — tổng hợp các yêu cầu và định hướng đã thảo luận.

1. Tổng quan sản phẩm

Đây không chỉ là một ứng dụng recipe hay quản lý kho thực phẩm.

Concept:

Cooking Community + Recipe Discovery + Personal Food Inventory + Shopping List + Recommendation + AI

Vòng đời chính:

Khám phá Recipe
      ↓
Quan tâm / Lưu Recipe
      ↓
Lập kế hoạch nấu
      ↓
Shopping List
      ↓
Đi chợ / mua thực phẩm
      ↓
Inventory
      ↓
Nấu ăn
      ↓
Inventory được cập nhật
      ↓
Recommendation
      ↓
Khám phá Recipe tiếp theo

USP định hướng:

Nhà có gì → Nấu được gì?

2. Nền tảng

Web

Tập trung vào:

Recipe

Blog / Article

Community

Discovery

Search

Creator

Brand

Affiliate

Admin / moderation

Mobile

Bao gồm các chức năng nội dung cần thiết của web và tập trung thêm vào:

Personal Inventory (+ InventoryGroup — tủ nhà dùng chung, xem **7c**)

Shopping List (personal + shared trong group)

AI Food Scan

Expiry tracking

Recipe recommendation dựa trên Inventory

Notifications

Tương lai

Có thể mở rộng:

IoT

ESP32

Weight sensor

Smart kitchen

IoT không thuộc MVP.

3. User & Role

Định hướng các role:

USER

CREATOR

BRAND

MODERATOR

ADMIN

Nguyên tắc

Role != Permission

Nên hướng tới RBAC/permission system để có thể mở rộng quyền mà không phải thay đổi kiến trúc.

Ví dụ:

USER
 ├── xem recipe
 ├── lưu recipe
 ├── quản lý inventory
 ├── tạo shopping list
 └── comment

CREATOR
 ├── quyền USER
 ├── tạo recipe
 ├── tạo article
 └── affiliate

ADMIN
 ├── quản lý user
 ├── moderation
 └── quản lý hệ thống

Một user có thể phát triển từ user thông thường thành creator hoặc có thêm capability khác mà không cần thay đổi bản chất account.

3b. Auth — MVP và OAuth 2.0 (phase sau)

MVP (đã / đang dùng):

- Email + password register/login.
- JWT access token cho API (Web + Mobile cùng contract).
- RBAC qua Role / Permission (không gắn chặt vào phương thức login).

OAuth 2.0 (Google, Apple, …): **không triển khai ngay** — không chặn Recipe / Inventory / core loop.

Khi nào làm OAuth:

- Gần lên store / onboarding production.
- Cần giảm ma sát đăng ký; trên iOS nếu có social login khác thường cần Sign in with Apple.

Hướng triển khai sau (chuẩn bị schema sớm nếu refactor Auth):

- Giữ **User** độc lập với cách đăng nhập.
- Bảng liên kết identity, ví dụ `OAuthAccount` / `AuthIdentity`:
  - userId
  - provider          # google | apple | …
  - providerUserId
  - @@unique([provider, providerUserId])
- Sau OAuth thành công: tạo hoặc tìm User → cấp **cùng loại JWT** như login password.
- `passwordHash` trên User: cho phép **nullable** (account chỉ OAuth không có mật khẩu local).
- Không hard-code giả định “mọi user đều login bằng password”.

Không làm ở MVP:

- Thay toàn bộ auth bằng OAuth trước khi có Recipe CRUD.
- Nhiều cơ chế session song song không cần thiết — OAuth chỉ là bước xác thực đầu, token API vẫn thống nhất.

3c. Lên role CREATOR — request + phê duyệt

**Đã chốt:** USER không tự gắn CREATOR (không self-serve). Luồng sản phẩm:

1. User gửi yêu cầu (ví dụ note / lý do ngắn) → trạng thái `PENDING`.
2. ADMIN hoặc MODERATOR (permission `user:manage` hoặc moderation tương đương) duyệt hoặc từ chối.
3. Approve → gán role `CREATOR` (cùng cơ chế `UserRole` / `POST /rbac/assign`); Reject → đóng request, user có thể gửi lại sau (policy cụ thể khi implement).
4. Client sau khi được duyệt: gọi lại `GET /users/me` (hoặc login lại) để nhận permissions mới (`recipe:create`, …).

Trong lúc phát triển Recipe CRUD: gán CREATOR bằng seed / `POST /rbac/assign` là đủ — không bắt buộc có CreatorRequest trước khi viết recipe API.

Seed bootstrap (local): `admin@pantrio.app` (ADMIN), `creator@pantrio.app` (CREATOR), `moderator@pantrio.app` (MODERATOR), password `password123` — chạy `pnpm --filter @pantrio/api db:seed`.

Không làm:

- Self-serve “Become a creator” mở ngay `recipe:create` không qua duyệt.
- Đổi bản chất account (vẫn cùng User; chỉ thêm Role).

4. Content & Recipe

4.1 Article

Dùng cho:

Blog

Tips

Hướng dẫn

Kiến thức

Câu chuyện món ăn

4.2 Recipe

Recipe là dữ liệu có cấu trúc.

Ví dụ:

Recipe
- id
- title
- description
- servings
- prepTime
- cookTime
- difficulty
- instructions
- ...

Không nên gộp Article và Recipe thành một entity.

4.2b. Kiểm duyệt nội dung Recipe (phase sau)

**Đã chốt:** Role CREATOR chỉ cho phép **tạo/sửa** recipe — không đồng nghĩa nội dung được hiển thị công khai ngay. Mô tả, hướng dẫn, `imageUrl` (URL tự do) cần lớp kiểm duyệt riêng.

Hai lớp duyệt khác nhau:

| Lớp | Mục tiêu | Tham chiếu |
|-----|----------|------------|
| Duyệt **người** lên CREATOR | Ai được phép viết | **3c** |
| Duyệt **nội dung** từng Recipe | Recipe nào được discovery | **4.2b** (mục này) |

Hướng triển khai (revision, approve kèm Food PRIVATE, và màn moderator web đã có):

1. Thêm field tách biệt `visibility` (`PUBLIC | PRIVATE | UNLISTED` — đã có) và `moderationStatus` (`PENDING | APPROVED | REJECTED`).
2. CREATOR tạo recipe mới (hoặc sửa bản đã public theo policy): mặc định `moderationStatus = PENDING` khi muốn xuất hiện discovery; bản nháp có thể `PRIVATE` + chưa submit duyệt.
3. Discovery `GET /recipes` (và detail public): chỉ recipe `visibility = PUBLIC` **và** `moderationStatus = APPROVED`.
4. Author luôn xem/sửa recipe của mình (kể cả PENDING / REJECTED).
5. MODERATOR / ADMIN (`moderation:manage`): list pending → approve / reject (+ optional lý do reject).
6. Author sửa catalog → revision mới `PENDING`. Discover vẫn phục vụ `Recipe.publishedVersion` (bản đã duyệt trước). Approve/reject phải gửi đúng `version` moderator vừa đọc; lệch version → **409** (tác giả đã lưu bản mới).
7. Reject không gỡ bản public đang phát. Approve thì copy snapshot đó lên `Recipe` và gắn `publishedVersion`.
8. **Food mới kèm Recipe** (xem thêm **7b.1**, **7b.7**): Food tạo trong flow recipe (search catalog không đủ) lưu `visibility = PRIVATE`, `createdByUserId = author`. Chỉ **author** và **moderator/admin** thấy trên search/catalog. Food vốn đã `PUBLIC` giữ nguyên. Reject recipe: **không** auto-public Food.
9. **Khi APPROVE recipe — check trùng rồi merge/promote:**
   - `GET /moderation/recipes/:id` kèm `privateFoods[]` và gợi ý food gần tên/slug.
   - Nếu có gợi ý, approve bắt buộc `foods[]`: `merge` + `toFoodId`, hoặc `promote` khi moderator chủ động giữ bản riêng.
   - Không gợi ý → approve tự `promote` PRIVATE → PUBLIC. Reject không đụng visibility của Food.
   - Merge remap ingredient, tủ, shopping list và snapshot revision; xóa food nguồn; food đích PRIVATE thì thành PUBLIC.
10. Orphan Food PRIVATE sau reject / sau merge: **Moderator** list + dọn tay; hệ thống chỉ gợi ý, không tự xóa thầm (**7b.7**).
11. Save của người khác không ghim version (bookmark theo `recipeId`, mở ra bản đang public).

Bảng:

- `Recipe.publishedVersion` — revision Discover / cook đang dùng. Null = chưa từng được duyệt.
- `RecipeRevision` — mỗi lần tác giả lưu catalog: `version`, `moderationStatus`, snapshot nội dung (`ingredientsJson`, `stepsJson`). `@@unique(recipeId, version)`.
- API: `GET /moderation/recipes`, `GET /moderation/recipes/:id?version=`, `POST …/approve`, `POST …/reject` (`moderation:manage`).
- Group cookbook không tạo revision.

Không làm:

- Coi CREATOR = nội dung đã tin cậy, bỏ qua duyệt khi mở production cộng đồng.
- Gộp moderation status vào `visibility` (hai khái niệm khác nhau: ai thấy vs đã duyệt chưa).
- Tạo thẳng Food `PUBLIC` từ recipe chưa duyệt (tránh rác catalog khi recipe bị reject).
- Auto-promote mọi Food PRIVATE của recipe khi approve mà bỏ qua bước check trùng / merge.

4.2c. Group Cookbook — sổ tay công thức nhóm (ưu tiên trước 4.2b)

**Đã chốt:** Nhóm (InventoryGroup) có thể có cookbook riêng — công thức nội bộ theo sở thích nhà — **không** yêu cầu role CREATOR và **không** đưa lên Discover / kiểm duyệt nội dung công khai.

Tách hai bề mặt Recipe:

| | Catalog / Discover | Group Cookbook |
|--|--------------------|----------------|
| Ai tạo | CREATOR (+ ADMIN) | Mọi **member** của group (USER thường) |
| Permission | `recipe:create` / `recipe:update` | Membership group (JWT); không cần CREATOR |
| Ai thấy | Public (sau **4.2b** khi mở cộng đồng) | Chỉ member của group đó |
| Duyệt nội dung | Có (**4.2b**, phase sau) | Không — không lên Discover |
| Food mới kèm | Theo **4.2b** / **7b** (PRIVATE → merge/promote khi approve) | Ưu tiên Food **PUBLIC**; thiếu thì Food **PRIVATE** của actor (`assertFoodUsable` / **7c**) |

Schema / visibility:

1. `Recipe.groupId` nullable → FK `InventoryGroup` (`onDelete: Cascade`).
2. `RecipeVisibility` thêm `GROUP`. Khi `groupId` set → bắt buộc `visibility = GROUP`; khi `groupId` null → không được `GROUP`.
3. Discovery `GET /recipes` (và article gắn recipe công khai): **không** trả recipe `GROUP`.
4. Recommend / cook theo `groupId`: lấy `PUBLIC` **và** cookbook `GROUP` của group đó.

Quyền trong group (MVP):

- **Tạo:** mọi member.
- **Sửa / xóa:** author của recipe; **OWNER** group được xóa (và sửa) mọi cookbook recipe của group.
- Không chuyển cookbook → catalog trong MVP (muốn public → tạo lại / phase sau “promote to catalog” + CREATOR + **4.2b**).

Member rời / dissolve:

- Member rời: cookbook **ở lại** group (`authorId` giữ nguyên; author không còn member thì không sửa/xóa trừ khi được mời lại hoặc OWNER xử lý).
- Sole OWNER leave → dissolve group → **cascade xóa** cookbook (cùng pantry/lists).

API (JWT, membership):

- `GET /groups/me/recipes` — list cookbook group hiện tại
- `POST /groups/me/recipes` — tạo (force `GROUP` + `groupId` của membership)
- `GET /groups/me/recipes/:slug` — detail (pantry flags theo group)
- `PATCH /groups/me/recipes/:id` — update (author hoặc OWNER)
- `DELETE /groups/me/recipes/:id` — delete (author hoặc OWNER)

`GET /recipes/:slug` với recipe `GROUP`: chỉ trả nếu caller là member của `recipe.groupId` (404 nếu không).

Thứ tự triển khai: **4.2c trước 4.2b** (cookbook nhóm phục vụ USER ngay; moderation catalog để phase cộng đồng).

Không làm:

- Bắt USER xin CREATOR chỉ để ghi món nhà.
- Đưa cookbook group lên Discover / share công khai mặc định.
- Moderator duyệt từng cookbook group.
- Multi-group cookbook picker (MVP vẫn 1 group/user — **7c**).


4.2d. Media — upload ảnh hệ thống (phase sau; sau Group Cookbook CRUD)

**Đã chốt:** Ảnh user-generated (recipe cookbook, sau đó food/article/avatar) lưu trên **object storage** thuộc hệ thống — không phụ thuộc URL báo mạng. Dev dùng **MinIO** (đã có trong Docker Compose, bucket `pantrio-media`, env `S3_*`). Prod: cùng S3-compatible API (MinIO trên VPS hoặc S3/R2 managed); **VPS chạy Backend**, blob không tự viết file server / static folder riêng.

Bối cảnh hiện tại:

- `Recipe.imageUrl` / `Food.imageUrl` là string URL; seed/dev nhiều ảnh là URL ngoài.
- Group cookbook tạo mới thường **chưa có ảnh** — cần upload lúc tạo **và** lúc sửa (nấu xong mới có ảnh thành quả).

Kiến trúc:

| Lớp | Vai trò |
|-----|---------|
| Client (Mobile/Web) | Chọn ảnh → upload → nhận URL → gắn vào create/update recipe |
| API Nest (`media` module) | Auth, validate mime/size, ghi object, trả URL công khai |
| Object storage | MinIO local / S3-compatible prod (`S3_ENDPOINT`, `S3_BUCKET`, …) |

Upload:

1. **MVP gần:** `POST /media` (multipart **form-data**, JWT) → `{ url, key? }`. Client rồi `POST/PATCH` recipe với `imageUrl`.
2. **Phase sau (mobile/file lớn):** `POST /media/presign` → client PUT thẳng storage → `PATCH` recipe `imageUrl` (API không nhận binary mọi request).
3. Một pipeline media **dùng chung** (recipe, food, article cover, avatar) — không API upload silo theo từng entity.

Model dữ liệu (MVP):

- Giữ `imageUrl` string trên Recipe/Food/Article là đủ.
- Phase muộn hơn (optional): bảng `MediaAsset` (owner, key, mime, size, linked entity) để dọn orphan / quota — không bắt buộc lúc mở upload.

Ràng buộc:

- Mime: jpeg / webp / png; size ~2–5MB; ưu tiên compress/resize phía client (hoặc worker nhẹ).
- User-generated: URL phải thuộc bucket hệ thống (không chấp nhận dán URL ngoài tùy ý khi policy siết).
- Seed/catalog tạm vẫn có thể dùng URL ngoài cho đến khi migrate.
- Thay ảnh: upload mới + (optional) xóa object cũ.
- **Quyền:** group cookbook — member (author/OWNER theo **4.2c**); catalog CREATOR — ảnh public vẫn thuộc kiểm soát **4.2b** khi mở cộng đồng.

UX ưu tiên:

1. Tạo cookbook group: optional ảnh.
2. Sửa cookbook / “Thêm ảnh sau khi nấu” (từ detail hoặc sau Cook session).
3. Cùng flow cho catalog recipe (CREATOR) khi sẵn sàng.

Không làm:

- Tự host thư mục ảnh kiểu static folder trên VPS thay cho object storage.
- Bắt buộc ảnh lúc tạo recipe (ảnh optional; sửa sau mới có là hợp lệ).
- Upload binary nhét trong mọi `POST /recipes` khi đã có endpoint media riêng (tránh phình payload).
- Moderator duyệt từng ảnh cookbook group (không lên Discover).

Thứ tự: Media upload MinIO local → wire tạo/sửa group cookbook (+ sau cook) → catalog/creator → deploy VPS (đổi `S3_*`, không đổi schema).


4.2e. RecipeStep — hướng dẫn từng bước kèm ảnh (đã chốt hướng B)

**Đã chốt:** Tách `instructions` (string tự do) thành bảng **`RecipeStep`** — mỗi bước có `body` + optional `imageUrl` (upload qua **4.2d** Media). Cover món vẫn là `Recipe.imageUrl`.

Schema:

```
RecipeStep
- id
- recipeId
- sortOrder   Int
- body        String      // nội dung bước
- imageUrl    String?     // optional; MinIO / URL hệ thống
```

Hành vi:

1. Detail recipe trả `steps[]` (ordered). Client ưu tiên render steps; `instructions` giữ để tương thích (derived = join `body` bằng newline khi create/update steps).
2. Create/update (catalog + group cookbook): nhận `steps[]` (≥1) **hoặc** `instructions` string (server split theo dòng không rỗng → steps).
3. Ảnh bước: optional; chụp/thư viện → `POST /media` → gắn `imageUrl` trên step.
4. Migrate dữ liệu cũ: mỗi recipe có `instructions` → tách dòng → `RecipeStep` nếu chưa có step.
5. UX ưu tiên: **Group cookbook** editor + viewer; catalog/CREATOR dùng cùng model.

Không làm (MVP steps):

- Video từng bước; nhiều ảnh / bước.
- Bắt buộc ảnh mọi bước.
- JSON blob trong `instructions` thay vì bảng quan hệ.


4.3 Ingredient

Ingredient
- id
- name
- category
- measurementType
- baseUnit
- image?

Quan hệ:

Recipe
   ↓
RecipeIngredient
   ↓
Ingredient

Ví dụ:

Carbonara
 ├── Pasta 200g
 ├── Egg 2
 ├── Bacon 100g
 └── Cheese 50g

Nguyên tắc quan trọng

Quantity trong Recipe là:

Lượng khuyến nghị

Không phải:

Lượng tiêu thụ thực tế

Người dùng có thể nấu nhiều/ít hơn recipe.

5. Saved / Interested / Planned / Cooked

Không nên coi:

Saved Recipe = Recipe người dùng chắc chắn sẽ nấu.

User có thể lưu hàng chục recipe nhưng chỉ muốn nấu vài món trong tuần.

Do đó cần phân biệt các concept:

Interested / Saved
        ↓
Planned
        ↓
Shopping
        ↓
Cooked

Ví dụ:

❤️ Carbonara        Saved
❤️ Chicken Curry    Saved

📅 Chicken Curry    Planned — 4 servings

🛒 Chicken Curry    Shopping

🍳 Chicken Curry    Cooked

Đây là phần cần thiết kế tiếp ở mức domain/UX.

6. Inventory — triết lý cốt lõi

Không coi:

Inventory = số lượng thực phẩm chính xác tuyệt đối.

Mà coi:

Inventory = trạng thái ước lượng đủ chính xác để hỗ trợ nấu ăn, shopping và recommendation.

Lý do:

Người dùng ăn/uống mà không cập nhật.

Người dùng không cân từng gram.

Người dùng nấu khác lượng recipe.

Người dùng mua lượng khác shopping list.

Người dùng có thể quên cập nhật.

Nguyên tắc

Inventory accuracy không được đánh đổi quá nhiều UX.

Thà có inventory tương đối chính xác nhưng người dùng thích sử dụng còn hơn một inventory cực kỳ chính xác nhưng bắt người dùng nhập liệu liên tục.

7. Food Master và InventoryItem

Food / Ingredient Master

Dữ liệu chung của hệ thống (không thuộc một user):

Food
- id
- slug                          # ổn định, không theo ngôn ngữ
- measurementType
- baseUnit
- imageUrl?
- createdByUserId?              # audit / food user tạo (hybrid)
- visibility?                   # PUBLIC | PRIVATE (phase triển khai)
- ...                           # không gắn cột dinh dưỡng cố định — xem **7b.9**

FoodTranslation (i18n)
- foodId
- locale                        # vi | en (default hiển thị: vi)
- name
- category?

Nutrient / FoodNutrient — dinh dưỡng mở rộng (xem **7b.9**); không thêm proteinG/fiberG… trên Food.

Ví dụ (cùng foodId, nhiều locale):

slug: chicken
  en → Chicken / protein
  vi → Gà / protein

InventoryItem

Dữ liệu thực phẩm thuộc user:

InventoryItem
- id
- userId
- foodId                        # luôn trỏ Food master hệ thống
- quantity
- unit
- expiryDate?
- purchaseDate?
- storageLocation
- status
- ...

Không biến Food thành dữ liệu cá nhân tách biệt (không có “Food chỉ của user” song song master).

Đồng bộ / khớp recipe–inventory chỉ qua cùng foodId — không đồng bộ theo chuỗi tên (“muối” ≈ “Salt”).

7b. Quyết định triển khai: nuôi Food, RecipeIngredient và thêm vào Inventory

Các quyết định đã chốt để triển khai API/UI tiếp theo.

7b.1 Ai nuôi Food master?

- Seed: bộ Food lõi của hệ thống (`PUBLIC`).
- CREATOR: tạo/gắn Food khi viết Recipe (RecipeIngredient.foodId). Đây là nguồn nuôi catalog chính.
  - **Đã chốt (kèm 4.2b):** Food **mới** tạo trong flow recipe → `PRIVATE` + `createdByUserId` (chỉ author + moderator thấy). Không public ngay.
  - Prefer gắn Food `PUBLIC` có sẵn (search-first) trước khi tạo mới — giảm nhân bản (“thịt cừu” × N).
  - **Khi Recipe APPROVED:** không promote mù. Với từng Food PRIVATE mới của recipe: **check trùng** → nếu trùng Food PUBLIC/chuẩn thì **Moderator merge** (remap FK) ; nếu không trùng thì **promote → PUBLIC**. Chi tiết **4.2b** bước 8, thao tác **7b.7**.
- USER: không cần (và MVP không bắt) liệt kê hết nguyên liệu thế giới; khi thiếu có thể tạo Food `PRIVATE` cho tủ (**7b.4**) — khác luồng CREATOR nuôi qua recipe.

Nhiều recipe song song vẫn có thể tạo nhiều row PRIVATE tạm thời; **không chấp nhận** nhiều Food `PUBLIC` khác `foodId` cho cùng khái niệm lâu dài — giải bằng merge lúc approve + merge tay (**7b.7**).

Duyệt Food độc lập (PENDING/ACTIVE riêng): không bắt buộc nếu đã neo theo duyệt Recipe + check trùng như trên; moderator vẫn merge/promote/dọn orphan tay (**7b.7**).

MVP CRUD hiện tại: chưa cho CREATOR tạo Food mới — chỉ gắn foodId đã seed / admin tạo.

7b.2 RecipeIngredient không ghi Inventory

RecipeIngredient chỉ mô tả recipe cần gì (foodId + lượng gợi ý).

RecipeIngredient không tự tạo, cộng, hay sửa InventoryItem.

Lượng trên recipe ≠ lượng user đang có trong tủ.

7b.3 USER thêm Food vào Inventory từ Recipe đã quan tâm

Luồng:

USER quan tâm / lưu Recipe (SavedRecipe)
      ↓
Mở danh sách nguyên liệu (RecipeIngredient)
      ↓
Với mỗi foodId: Inventory của user đã có foodId này chưa?
      ├── Có  → hiển thị đang có (có thể ~quantity)
      └── Không → option “Thêm vào tủ”
                    ↓
              Tạo InventoryItem { foodId từ recipe, quantity do USER nhập }
                    ↓
              Không tạo Food mới — tái sử dụng đúng foodId hệ thống

Quantity khi thêm: USER nhập (có thể prefill gợi ý từ recipe trên UI nhưng không bắt buộc ghi đúng lượng recipe). confidence mặc định APPROXIMATE hoặc PRESENCE tùy UX.

7b.4 USER tự thêm Food vào Inventory (gõ tên)

Luồng bắt buộc search-first:

USER nhập tên (vd. "muối")
      ↓
GET /foods?q=...&locale=vi   (typeahead catalog hệ thống)
      ↓
Có Food phù hợp? → chọn foodId → tạo InventoryItem
      ↓
Không có?
      ↓
Option “Tạo nguyên liệu mới” (hybrid trên master chung)
  → Food visibility=PRIVATE, createdByUserId=user
  → rồi tạo InventoryItem với foodId đó

Ưu tiên luôn chọn Food có sẵn để tránh nhân bản master (hai foodId “Muối”).

Khớp với recipe sau này chỉ xảy ra khi cùng foodId (user đã chọn đúng Food, hoặc phase sau: alias / merge Food trùng).

7b.5 Không làm gì (MVP)

- Không cộng quantity Inventory từ RecipeIngredient.
- Không tạo bảng UserFood tách riêng làm nguồn sự thật song song.
- Không đồng bộ inventory–recipe bằng so khớp tên string.
- Không bắt moderator duyệt mọi Food trước khi dùng.

7b.6 Gợi ý API liên quan (triển khai dần)

- GET /foods?q=&locale=                          # đã có — typeahead
- Recipe CRUD + RecipeIngredient                 # CREATOR
- SavedRecipe                                    # USER quan tâm
- GET recipe + cờ “inInventory” theo foodId      # UX option thêm tủ
- POST /inventory                                # tạo InventoryItem { foodId, ... }
- POST /foods (USER, PRIVATE)                    # chỉ khi search không đủ
- Catalog moderation / merge Food                # MODERATOR/ADMIN — xem 7b.7

7b.7 Thao tác MODERATOR / ADMIN trên Food catalog

Tách biệt rõ: moderation = quản lý Food master, không phải quản lý tủ của user.

MODERATOR / ADMIN được làm (catalog):

- Xem danh sách Food (lọc PUBLIC / PRIVATE / PENDING nếu có), kèm metadata: createdByUserId, số reference tổng hợp (vd. bao nhiêu InventoryItem / RecipeIngredient trỏ tới) — không cần soi chi tiết từng inventory của user.
- Ẩn / từ chối / đánh dấu spam Food rác.
- Promote Food PRIVATE → PUBLIC khi đáng đưa vào catalog chung (tay; hoặc sau khi approve recipe và **không** phát hiện trùng).
- Merge Food trùng: chọn fromFoodId → toFoodId. **`toFoodId` luôn kết thúc PUBLIC** (nếu đang PRIVATE thì merge auto-promote). Hướng thường: PRIVATE trùng → PUBLIC chuẩn.
  - Cập nhật hàng loạt FK sang toFoodId (InventoryItem, RecipeIngredient, ShoppingListItem, …).
  - Ẩn hoặc xóa mềm fromFoodId.
  - User không bấm merge; phía client tối đa nhận remapping trong suốt (tủ vẫn hiện đúng, foodId đổi phía sau).
- Gắn Food vào Inventory / Shopping / RecipeIngredient qua API: chỉ **PUBLIC** hoặc **PRIVATE do chính user tạo** — từ chối foodId PRIVATE của người khác (parity với search; không dựa vào UI ẩn).
- **Đã chốt — luồng Approve Recipe (4.2b / 7b.1):** trước khi (hoặc trong lúc) approve, Moderator xử lý từng Food PRIVATE mới của recipe:
  1. Hệ thống gợi ý ứng viên trùng (tên/slug).
  2. Trùng → Moderator **merge** sang Food chuẩn → rồi mới hoàn tất approve (recipe trỏ đúng foodId chuẩn).
  3. Không trùng → **promote** PRIVATE → PUBLIC cùng với approve.
  - Không để approve tạo thêm Food PUBLIC trùng nghĩa.
- **Orphan Food PRIVATE** (reject recipe, hoặc sau merge không còn reference hữu ích): Moderator **list + xóa/merge tay**. Hệ thống chỉ gợi ý orphan (vd. reference count = 0 hoặc chỉ trỏ recipe REJECTED); **không** auto-delete.
- Quản lý alias / synonym (phase sau) — xem 7b.8 FoodAlias.

MODERATOR / ADMIN không làm:

- Không mở / sửa InventoryItem của user (quantity, expiry, batch) như “quản lý pantries”.
- Không bắt user approve từng lần merge.
- User / CREATOR thường không tự merge Food; đó là thao tác catalog (Moderator).

Quyền gợi ý: catalog:manage và/hoặc moderation:manage (ADMIN có đủ; MODERATOR theo ROLE_PERMISSIONS).

Privacy: Inventory personal là dữ liệu cá nhân; Inventory/Shopping **group** chia sẻ giữa MEMBER (xem **7c**). Moderator chống rác / trùng trên Food, không browse nội dung tủ từng người hay từng group.

7b.8 Phase sau — FoodAlias (tên miền / biến thể gọi)

Vấn đề: cùng một nguyên liệu, nhiều vùng miền / thói quen gọi khác tên. Không tạo nhiều foodId.

Nguyên tắc: một Food (một foodId); nhiều tên gọi qua bảng FoodAlias riêng (tách khỏi FoodTranslation).

FoodTranslation = tên hiển thị chuẩn theo locale (vi, en) — đã có ở MVP.

FoodAlias = biến thể tìm kiếm / tên miền (implement tách riêng khi tới phase này):

FoodAlias
- id
- foodId
- locale?              # vi | en | null = áp dụng mọi locale
- region?              # bắc | trung | nam | null
- name                 # tên gọi thay thế (vd. củ cải đường)
- normalizedName       # lowercase, bỏ dấu — phục vụ search
- createdByUserId?
- @@index([normalizedName])
- @@index([foodId])

Search / typeahead (GET /foods?q=): match FoodTranslation.name HOẶC FoodAlias.name / normalizedName → luôn trả cùng foodId.

Hiển thị UI: tên canonical từ FoodTranslation theo locale; tùy chọn “còn gọi là …”.

Không làm:

- Không tạo Food riêng theo từng miền.
- Không thay FoodTranslation bằng locale kiểu vi-HN / vi-SG chỉ để chứa tên miền — alias linh hoạt hơn.

Ai nuôi alias:

- Seed / CREATOR / MODERATOR-ADMIN (cùng luồng catalog ở 7b.7).
- Phase muộn hơn: USER đề xuất alias → moderator duyệt.

Thứ tự triển khai:

1. MVP: FoodTranslation + search-first (đã định hướng).
2. Phase sau: bảng FoodAlias + mở rộng search.
3. Rồi: region, đề xuất alias, UX “ý bạn là …?”.

Khi implement: migration + model FoodAlias tách file/module catalog; không nhét alias vào JSON trên Food.

7b.9 Dinh dưỡng / năng lượng (Nutrient + FoodNutrient) — đã chốt hướng

**Đã chốt (2026-10-07):** Catalog chất dinh dưỡng tách bảng; giá trị gắn Food qua bảng trung gian; Recipe **tổng hợp** từ ingredients (không nhập tay kcal trên recipe).

Vấn đề: cần Calories và nhiều chất khác (Protein, Carb, Fat, Fiber, Sugar, Sodium, …) mà không khóa schema bằng hàng chục cột trên `Food`.

Bảng:

Nutrient (seed — danh mục “Chất”)
- id
- code                 # ổn định: energy_kcal | protein | carb | fat | fiber | sugar | sodium | …
- nameEn / nameVi?     # hoặc translation table sau; MVP có thể name + locale đơn giản
- unit                 # kcal | g | mg | …
- group                # ENERGY | MACRO | CARB_DETAIL | MINERAL | VITAMIN | OTHER
- sortOrder
- @@unique([code])

FoodNutrient
- id
- foodId
- nutrientId
- amount               # lượng chất
- basisQty             # mặc định 100 (hoặc 1 với pcs)
- basisUnit            # g | ml | pcs — cùng hệ Unit MVP; khớp measurementType của Food
- @@unique([foodId, nutrientId])

Nguyên tắc:

1. **Không** thêm cột `proteinG` / `fiberG` / … trên `Food`.
2. Thiếu chất = không có row `FoodNutrient` (không bịa 0).
3. **Recipe nutrition** (total + per serving): với mỗi nutrient, cộng  
   `Σ convert(ingredient.qty → basisUnit) × (amount / basisQty)`  
   rồi chia `servings` cho per-serving. Chỉ ingredient không optional (hoặc policy: optional cũng cộng nếu có data — chốt khi implement: **MVP cộng mọi ingredient có qty**, optional vẫn cộng nếu có dinh dưỡng).
4. Response API dạng list `{ code, unit, amount, complete? }` — `complete` = mọi ingredient bắt buộc đều có nutrient đó (hoặc không có dinh dưỡng nào → `nutrition: null` / empty).
5. UI MVP profile hiển thị: energy_kcal + protein + carb + fat + fiber + sugar; catalog Nutrient seed rộng hơn để mở rộng UI sau không migration.
6. Ai nuôi: seed Food lõi kèm FoodNutrient; Moderator/Admin CRUD `FoodNutrient`; CREATOR có thể gắn khi tạo Food PRIVATE (optional). USER tạo Food tủ: không bắt buộc dinh dưỡng.
7. OpenSearch / filter “≤ 500 kcal/serving”: phase sau — denormalize lúc approve nếu cần.

Không làm (MVP dinh dưỡng):

- Mục tiêu calo cá nhân / diary.
- Auto-fill USDA / barcode → nutrient.
- Micronutrient UI đầy đủ.
- Lưu bảng RecipeNutrition cứng (trừ khi tối ưu search sau này).

Thứ tự triển khai gợi ý: schema + seed Nutrient → FoodNutrient seed vài Food lõi → API Food kèm nutrients → aggregate trên Recipe detail → Web/Mobile hiển thị → (sau) moderation form + Discover filter.

7c. InventoryGroup — tủ & shopping list dùng chung (đã bàn)

Vấn đề: một hộ nhiều tài khoản. Một account dùng chung không hợp lý; nhiều account với Inventory/Shopping tách biệt cũng không khớp “nhà có gì”.

Phạm vi đã hướng:

- **Share Inventory** + **share ShoppingList** trong cùng một group.
- **Purchase (PURCHASED)** trên list thuộc group → tạo `InventoryItem` thuộc **cùng group** (không ghi tủ cá nhân).
- **Không** làm ingredient OR nhiều foodId (food1/food2) cho tên miền — dùng **một foodId + FoodAlias** (7b.8).
- **PlannedRecipe / SavedRecipe:** MVP giữ **personal**. Generate shopping trong context group: shortage tính trên **stock của group** (user chọn / theo tab đang mở).

Không gian dữ liệu (dual scope):

| Scope | Inventory | Shopping |
|-------|-----------|----------|
| Personal | như hiện tại (`userId`) | như hiện tại |
| Group | thuộc `groupId` | thuộc `groupId` |

Membership (MVP):

- Một user **tối đa một group** active (đủ use-case một nhà bếp). Nhiều group / picker = phase sau.
- Role trong group: ít nhất `OWNER` | `MEMBER` (kick / rotate invite / giải tán = OWNER).
- Join bằng **invite code** (hết hạn / rotate / giới hạn lần dùng) — **không** bắt user gõ raw DB `groupId` + password cố định lâu dài. Có thể kèm shared secret lúc tạo nếu muốn; membership vẫn revoke được.
- Tạo group: creator thành OWNER, group có tủ + list trống ngay.

UX Mobile (đã hướng):

- Tab **Personal** | **Group** trên Inventory (và Shopping cùng context).
- Tab Group chưa join: CTA **Tạo nhóm** / **Tham gia bằng mã** (nút “+” hoặc tương đương).
- Trong tab Group: mọi thao tác tủ/list/purchase bám `groupId` đang active — không cho purchase lệch scope (list group → tủ personal).

Ownership / audit:

- Pantry partition: `groupId` (group) hoặc `userId` (personal) — chốt schema khi implement (nullable cặp, hoặc luôn có personal “implicit”, hoặc backfill mỗi user một personal group — quyết định kỹ thuật ở bước đầu).
- `InventoryTransaction`: tách **actor** (`actorUserId` / `userId` người thao tác) vs **chỗ trừ kho** (group hoặc personal owner).

Đồng thời / race (khác sàn TMĐT về policy, gần về atomic trừ số):

- Cook / adjust / purchase trên batch dùng chung: **transaction + row lock hoặc UPDATE có điều kiện** trên `quantity`; optional `version` cho PATCH.
- Purchase item: chỉ một member đánh PURCHASED thành công (atomic status) rồi mới tạo batch.
- Không cần reservation/hold kiểu checkout TMĐT cho MVP.
- Cook có thể giữ shortfall như hiện tại (product), miễn quantity không bị double-decrement sai.

Food PRIVATE trong group (cần giải khi implement):

- Hiện `assertFoodUsable`: PRIVATE chỉ creator. Member khác không gắn food PRIVATE của người khác vào tủ/list group.
- Hướng tạm MVP: trong group ưu tiên Food **PUBLIC**; PRIVATE chỉ actor tự tạo và tự dùng; hoặc phase sau visibility theo group. Không để moderator browse nội dung tủ group (vẫn privacy vs staff).

Privacy giữa thành viên: mọi MEMBER thấy batch/list trong group (expiry, notes, …). Join = chấp nhận chia sẻ đó.

Cook / recommend / `inInventory` theo group: khi context = Group, stock lấy từ inventory group (phase gắn sau khi group inventory ổn).

Không làm (MVP group):

- Nhiều group / user.
- Shopping/Inventory “nửa personal nửa group” trong cùng một list.
- OR-foodId trên RecipeIngredient.
- Moderator quản lý pantry group như admin tủ.


8. Inventory Batch

Cùng một loại thực phẩm có thể có nhiều lần mua với expiry khác nhau.

Ví dụ:

Chicken
 ├── 500g — expiry 10/09
 └── 1kg  — expiry 15/09

Không nên merge thành:

Chicken = 1.5kg
expiry = ???

Backend nên giữ các inventory item/batch riêng.

UI có thể group chúng lại:

Chicken — ~1.5kg

Khi consume, ưu tiên batch sắp hết hạn trước.

FEFO

First Expired, First Out

9. Quantity và Unit

Không nên giả định mọi thực phẩm đều dùng gram.

Các measurement type cơ bản:

COUNT
WEIGHT
VOLUME

**Đã chốt unit chuẩn MVP** (`@pantrio/shared` `Unit`, validate trên DTO):

`g` | `kg` | `ml` | `l` | `pcs`

Gợi ý theo measurement type:

- WEIGHT → `g`, `kg`
- VOLUME → `ml`, `l`
- COUNT → `pcs`

Ví dụ:

Egg       → COUNT  → 6 pcs
Chicken   → WEIGHT → ~500g
Milk      → VOLUME → ~800ml

Không cố chuyển mọi thứ về một đơn vị duy nhất nếu conversion không có ý nghĩa nghiệp vụ. Mở rộng unit (tbsp, cup, …) phase sau — DB vẫn `String`.

10. Inventory Precision

Có thể hỗ trợ nhiều mức độ chính xác:

Presence

Egg ✓
Milk ✓
Chicken ✓

Approximate

Egg       ~6
Chicken   ~500g
Milk      ~1L

Exact

Chicken 487g

Người dùng không bắt buộc phải đạt mức Exact.

Có thể lưu thêm:

quantityType

hoặc:

confidence
lastConfirmedAt

để hệ thống biết dữ liệu inventory đáng tin đến đâu.

11. Inventory Transaction

Không chỉ lưu current quantity.

Nên lưu lịch sử thay đổi:

InventoryTransaction
- id
- inventoryItemId
- type
- quantity
- unit
- recipeId?
- createdAt

Các type:

PURCHASE
CONSUME
DISPOSE
ADJUSTMENT
ESTIMATED_CONSUME

currentQuantity có thể là snapshot/cache để đọc nhanh.

Transaction giữ lịch sử và audit trail.

12. Vấn đề tiêu thụ ngoài hệ thống

Ví dụ:

Inventory:
Chocolate = 5

User ăn 1 thanh nhưng không cập nhật.

App không thể biết chính xác.

Không nên

Liên tục hỏi:

"Bạn vừa sử dụng 1 thanh chocolate?"

Điều này tạo friction rất lớn.

Nên

Chấp nhận sai số.

Cho phép manual adjustment.

Cập nhật từ những event mà hệ thống thực sự biết.

Có thể dùng confidence / lastConfirmedAt để đánh giá độ tin cậy.

13. Recipe Consumption

Recipe:

Chicken 300g
Onion 100g

không có nghĩa user chắc chắn tiêu thụ:

Chicken -300g
Onion -100g

Khi user bấm Cook:

Cook Recipe
     ↓
Estimated Consumption

Ví dụ:

Chicken -300g
Onion   -100g

được đánh dấu là estimated.

User có thể:

Undo

Adjust

Recalibrate Inventory

Ví dụ thực tế user dùng 350g thay vì 300g thì không cần bắt user nhập chính xác từng gram ngay từ đầu.

14. Shopping List

Shopping List là một trong những nguồn input Inventory đáng tin cậy nhất.

Flow:

Saved Recipes
      ↓
Planned Recipes + servings
      ↓
Required Ingredients
      ↓
Current Inventory Check
      ↓
Shopping List
      ↓
Purchase
      ↓
Inventory

Ví dụ

Recipe cần:

Chicken 600g

Inventory có:

Chicken ~200g

Shopping List:

Chicken ~400g

Logic:

Required
-
Available
=
To Buy

15. Shopping List không đồng nghĩa với Inventory

Không nên:

Tick Shopping Item
       ↓
Inventory + quantity

vì tick không nhất thiết có nghĩa:

Đã mua đúng lượng đó.

Các trường hợp:

Tick nhầm.

Hết hàng.

Mua ít hơn.

Mua nhiều hơn.

Đổi sản phẩm.

Không mua nữa.

Flow đúng:

Recipe
 ↓
Shopping List
 ↓
Purchased
 ↓
Inventory

16. UX khi mua hàng

Ví dụ:

🛒 Shopping List

☐ Chicken     1kg
☐ Tomato      500g
☐ Onion       300g
☐ Egg         10

Sau khi mua:

☑ Chicken

App có thể hỏi nhẹ:

Đã mua 1kg Chicken?

[Đúng]

→ Inventory +1kg

Hoặc:

[Điều chỉnh]

700g

→ Inventory +700g

Đây là input Inventory có ngữ cảnh và có lý do rõ ràng, nên ít gây khó chịu hơn việc yêu cầu cập nhật sau mỗi lần tiêu thụ.

16b. Shopping list — merge / reset / delete (đã chốt)

**Merge từ list có sẵn → list mới**

- `POST /shopping-lists/merge-from-lists` `{ name, sourceListIds[] }`
- Copy item từ các list nguồn; cùng `foodId+unit` → cộng quantity.
- Item trên list mới luôn `PENDING`. Bỏ qua `SKIPPED`.
- List nguồn **không** bị sửa / xóa (dùng như template tuần).

**Reset tái sử dụng**

- `POST /shopping-lists/:id/reset` — mọi item `PURCHASED` / `SKIPPED` → `PENDING`.
- **Không** rollback Inventory / transaction.

**Xóa list**

- `DELETE /shopping-lists/:id` bất kỳ lúc nào (cascade items).
- UI: khi `pendingCount === 0` và còn items → gợi ý Reset hoặc Delete.

17. Shopping List từ Recipe

Không lấy tất cả Saved Recipe để tạo Shopping List.

Cần phân biệt:

Saved

và:

Planned

User có thể có 50 recipe đã lưu nhưng tuần này chỉ nấu 3 món.

UX đề xuất:

Bạn đang quan tâm 7 món.
Muốn lập danh sách đi chợ từ những món này không?

☑ Carbonara       2 servings
☑ Chicken Curry   4 servings
☐ Tomato Soup     2 servings

[Tiếp tục]

18. AI Food Recognition

AI không nên trực tiếp sửa Inventory.

Flow:

Camera
 ↓
AI Recognition
 ↓
Recognition Result
 ↓
User Confirmation
 ↓
Inventory

Ví dụ:

{
  "food": "Chicken Breast",
  "confidence": 0.94,
  "quantity": {
    "value": 500,
    "unit": "gram"
  },
  "expiryDate": null
}

AI có thể nhận diện:

Loại thực phẩm.

Brand.

Package.

Quantity trong một số trường hợp.

Expiry date thông qua OCR.

Nhưng expiry date không nên được AI tự đoán rồi coi là sự thật.

AI chỉ đưa ra suggestion.

19. AIScan

Entity đề xuất:

AIScan
- id
- image
- detectedFood
- confidence
- detectedQuantity?
- detectedExpiry?
- status

Status:

PENDING
CONFIRMED
REJECTED

20. Expiry

Expiry có thể đến từ nhiều nguồn:

USER_INPUT
OCR
PRODUCT_DATABASE
AI_ESTIMATION
UNKNOWN

expiryDate có thể nullable.

Không giả định hệ thống luôn biết hạn sử dụng.

21. Recommendation

Recommendation là nơi Recipe + Inventory kết hợp.

Ví dụ Inventory:

Chicken ~500g
Tomato 3
Onion 2
Milk ~500ml

App:

Bạn có thể nấu:

Chicken Tomato Pasta

✓ Chicken
✓ Tomato
✓ Onion
△ Pasta — cần mua

Có thể ưu tiên:

Ingredient đang có.

Ingredient sắp hết hạn.

Recipe phù hợp với quantity.

Recipe user từng quan tâm.

Sở thích user.

Lịch sử nấu.

USP:

Cook with what you have.

22. Search

**Đã chốt (2026-10-05) — lát cắt recipe Discover:**

- OpenSearch local trong Docker (`infra/compose.yml`, `localhost:9200`, security tắt).
- Index `pantrio-recipes`: title, description, ingredientNames, instructions, difficulty, cook/prep time, visibility, publishedVersion.
- Sync: bootstrap khi index trống lúc API boot; `POST /search/recipes/reindex` (`moderation:manage`); sau **approve** catalog recipe.
- API: `GET /search/recipes?q=&difficulty=&maxCookTimeMin=&limit=` — cluster down thì SQL fallback (`contains`).
- Discover Web + Mobile: ô tìm recipe gọi endpoint trên.
- Food typeahead vẫn Postgres (`GET /foods?q=`). FoodAlias / semantic vẫn phase sau.

MVP (còn lại / mở rộng dần)

SQL (Food + fallback recipe)

Full-text search

Category

Tag

Ingredient (đã có qua OpenSearch ingredientNames)

Difficulty (đã có query param)

Cooking time (đã có maxCookTimeMin)

Future

Elasticsearch / OpenSearch _(recipe Discover — đã nối OpenSearch)_

Embedding / vector / hybrid / semantic recommendation — Phase 3.

Không cần triển khai vector search ngay từ MVP.

23. Affiliate / Commerce

Recipe có thể gắn Recommended Product.

Ví dụ:

Carbonara
 ├── Recommended Pan
 ├── Knife
 ├── Pot
 └── Whisk

Architecture:

Brand / Merchant
      ↓
Affiliate Program
      ↓
Campaign
      ↓
Affiliate Link
      ↓
User Click
      ↓
Conversion
      ↓
Commission

Entity đề xuất:

Brand
Product
AffiliateProgram
Campaign
AffiliateLink
Click
Conversion
Commission

Có thể mock/simulate affiliate system trong đồ án thay vì tích hợp affiliate network thật.

24. IoT — Future Phase

Định hướng:

ESP32
 ↓
Weight Sensor
 ↓
Measurement
 ↓
API / MQTT
 ↓
Inventory

Không đưa IoT vào core MVP.

Inventory nên đủ linh hoạt để sau này nhận:

Measurement

Adjustment

Consumption

mà không phụ thuộc cứng vào ESP32.

25. MVP

Core

Auth
User
Recipe
Ingredient
Saved Recipe
Inventory
Shopping List

Core Flow

Save Recipe
    ↓
Plan Recipe + servings
    ↓
Generate Shopping List
    ↓
Purchase
    ↓
Inventory
    ↓
Cook
    ↓
Estimated Consumption
    ↓
Recipe Recommendation

Phase 2

InventoryGroup — tủ & shopping dùng chung (tab Personal | Group; xem **7c** / checklist **6a**)
AI Food Scan
Expiry Notification
Advanced Search _(OpenSearch recipe Discover — checklist **8b**)_
Creator (UX xin quyền CREATOR + duyệt — xem mục **3c**; assign tay vẫn dùng được từ MVP)
Group Cookbook (**4.2c** — ưu tiên trước moderation)
Media / upload ảnh MinIO→S3 (**4.2d** — form-data MVP; tạo + sửa recipe; sau cook)
RecipeStep — bước + ảnh (**4.2e**)
Recipe content moderation (PENDING/APPROVED — xem mục **4.2b**; sau cookbook nhóm)
Nutrition: Nutrient + FoodNutrient + aggregate recipe (**7b.9**)
Community
OAuth 2.0 (Google / Apple, …) — xem mục **3b**

Phase 3

Affiliate
Brand
IoT
Smart Recommendation
Semantic Search
Quét barcode → tủ; catalog Mart / giá / nhập lúc thanh toán (đã bàn, chưa làm — xem **27**)
Nutrition diary / mục tiêu cá nhân; auto-fill nutrient từ nguồn ngoài

26. Design Principles

Don't make users manage inventory constantly.

Inventory can be approximate.

Recipe quantity is recommendation, not ground truth.

Shopping/Purchase is a high-confidence inventory input.

AI suggests; user confirms.

Separate planning, purchasing, inventory and consumption.

Keep history through transactions.

Optimize for "Can I cook this?" rather than "Do I have exactly 387g?"

UX friction is more dangerous than inventory inaccuracy.

The system should gradually build inventory data from natural user behavior.

27. Product Statement

Một nền tảng giúp người dùng khám phá món ăn, lên kế hoạch nấu, mua đúng nguyên liệu, quản lý thực phẩm đang có và tìm ra món ăn phù hợp với những gì còn lại trong căn bếp.

Core loop:

Recipe
  ↓
Planning
  ↓
Shopping
  ↓
Purchase
  ↓
Inventory
  ↓
Cooking
  ↓
Consumption
  ↓
Recommendation
  ↓
Recipe

28. Các vấn đề cần thiết kế tiếp

Các phần chưa chốt hoàn toàn / còn chi tiết kỹ thuật:

Domain Model

Quan hệ cốt lõi đã định hướng; còn chi tiết API/UX:

Recipe
Food + FoodTranslation
Nutrient + FoodNutrient (xem **7b.9**)
RecipeIngredient
SavedRecipe
MealPlan / PlannedRecipe
ShoppingList
ShoppingListItem
Purchase
InventoryItem
InventoryTransaction
CookingSession
InventoryGroup + Membership + Invite (xem **7c** — hướng đã bàn; schema/API chi tiết khi implement)

Đã chốt (xem mục 7b, 4.2b): Food master hệ thống + i18n; RecipeIngredient không ghi Inventory; thêm tủ từ recipe đã quan tâm bằng cùng foodId; USER gõ tên thì search catalog trước; hybrid Food PRIVATE khi thiếu; CREATOR tạo Food mới kèm recipe → PRIVATE; khi APPROVE recipe → check trùng rồi Moderator merge hoặc promote PUBLIC; orphan do Moderator dọn; kiểm duyệt recipe + revision (đã làm API/UI). Dinh dưỡng: **7b.9** (Nutrient catalog + FoodNutrient; recipe aggregate).

Đã bàn / hướng (xem **7c**): dual tab Personal | Group; share Inventory + Shopping; purchase list group → tủ group; MVP 1 user ≤ 1 group; invite code (không raw groupId+password cố định); Planned/Saved personal; race = lock/atomic quantity; chưa OR-foodId.

Còn chốt khi triển khai 7c:

- Schema: personal = `userId` nullable `groupId` vs backfill personal group.
- Leave / kick / owner transfer / giải tán group (số phận tủ & list).
- Food PRIVATE usable trong group (tạm PUBLIC-only vs group visibility).
- Cook / recommend / `inInventory` nhận context group.
- Generate-from-planned: param/stock scope group khi list thuộc group.

Inventory semantics

Cần chốt tiếp:

InventoryItem đại diện cho một batch, một package hay một "lượng thực phẩm đang sở hữu".

Khi nào tạo batch InventoryItem mới vs điều chỉnh batch đang có (do user thao tác tủ — không liên quan RecipeIngredient).

Xử lý opened/unopened package.

Xử lý cùng Food nhưng khác expiry.

FEFO khi consume.

Food catalog (phase sau) — moderator xem 7b.7; tên miền / biến thể xem 7b.8 FoodAlias

FoodAlias (bảng riêng): foodId + name + normalizedName + locale? + region?; search resolve về cùng foodId.

Alias / synonym (muối, salt, tên miền → cùng foodId) — không nhân bản Food.

Merge Food trùng (toFood luôn PUBLIC sau merge) do MODERATOR/ADMIN; remapping FK trong suốt với user.
Inventory/Shopping/Recipe chỉ gắn foodId PUBLIC hoặc PRIVATE của chính user (group: xem ràng buộc PRIVATE ở **7c**).

Moderation PENDING/ACTIVE nếu cần chống spam.

List Food PRIVATE kèm createdBy + count reference — không soi Inventory chi tiết theo user / theo group.

Recommendation

Cần định nghĩa chính xác:

Khi nào hệ thống kết luận user "đủ nguyên liệu" để nấu một recipe nếu Inventory chỉ mang tính approximate?

Đây là một trong những bài toán domain quan trọng nhất của hệ thống.

27. Barcode, catalog Mart và nhập tủ — Future (đã bàn 2026-09-30, chưa triển khai)

Mục đích ghi lại để mổ xẻ sau. Không chặn MVP. Không thêm cột SKU Mart lên `Food`. Không cần database cluster.

Ba lớp tách nhau:

| Lớp | Là gì | Hệ thống hiện tại |
|---|---|---|
| Nguyên liệu | "Gừng" — nấu, gợi ý, shopping theo `foodId` | `Food` + `FoodTranslation` |
| Sản phẩm bán | Gói cụ thể: hãng, quy cách, barcode, giá tại một Mart | Chưa có |
| Cổng nhập tủ | Mã biết đổ hàng vào tủ nào (personal / group) | Chưa có |

Đã chốt khi bàn:

1. Siêu thị có quản lý hàng bằng barcode (EAN/GTIN). Hàng cân ký thường là mã nội bộ của chuỗi, in tại cân.
2. Tồn kho lúc nhập hàng nằm trong POS/ERP của chính Mart (có thể thuê phần mềm). GS1 chỉ cấp mã sản phẩm, không giữ tồn. Pantrio không đọc được tồn hay giỏ thanh toán trừ khi chuỗi mở API.
3. Một `foodId` có nhiều mã vạch. SKU Mart sống ở bảng riêng (hướng: sản phẩm retailer + map → `foodId` + độ tin cậy). Chưa map thì xếp hàng đợi, không tự tạo `Food` public.
4. QR trên tủ là cổng nhập (ai được đẩy, hết hạn, không nhập đúp cùng hóa đơn). Khác barcode trên hộp.
5. Quét barcode trong app → map `foodId` → tạo batch là bước đầu, không cần Mart. `expiryDate` đã có trên `InventoryItem`; hạn dùng vẫn do người dùng xác nhận.
6. Giá là quan sát theo thời gian (sản phẩm, Mart, cửa hàng, lúc lấy giá), không phải một cột trên `Food` hay batch.
7. Shopping list vẫn theo nguyên liệu. Gói bán (túi 250g) phải làm tròn so với nhu cầu công thức.
8. Thanh toán xong tự nhập tủ, chỉ đường trong siêu thị, mua online: phase đối tác. Trùng bill, hủy bill, privacy lịch sử mua, map dùng chung cần duyệt.

Thứ tự khi quay lại: quét trong app → catalog mã do user gắn vào `Food` có sẵn → giá Mart khi có nguồn hợp lệ → QR cổng nhập → API thanh toán của một chuỗi cụ thể.