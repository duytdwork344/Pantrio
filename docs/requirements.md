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

Personal Inventory

Shopping List

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

Dữ liệu chung của hệ thống:

Food
- id
- name
- category
- measurementType
- baseUnit
- image

Ví dụ:

Chicken
Tomato
Egg
Milk
Onion

InventoryItem

Dữ liệu thực phẩm thuộc user:

InventoryItem
- id
- userId
- foodId
- quantity
- unit
- expiryDate?
- purchaseDate?
- storageLocation
- status
- ...

Không biến Food thành dữ liệu cá nhân của user.

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

Ví dụ:

Egg       → COUNT  → 6 pieces
Chicken   → WEIGHT → ~500g
Milk      → VOLUME → ~800ml

Không cố chuyển mọi thứ về một đơn vị duy nhất nếu conversion không có ý nghĩa nghiệp vụ.

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

MVP

SQL

Full-text search

Category

Tag

Ingredient

Difficulty

Cooking time

Future

Elasticsearch / OpenSearch

Sau đó có thể mở rộng:

Embedding
Vector Search
Hybrid Search
Semantic Recommendation

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

AI Food Scan
Expiry Notification
Advanced Search
Creator
Community

Phase 3

Affiliate
Brand
IoT
Smart Recommendation
Semantic Search

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

Các phần chưa chốt hoàn toàn:

Domain Model

Cần thiết kế quan hệ:

Recipe
Ingredient
RecipeIngredient
SavedRecipe
MealPlan / PlannedRecipe
ShoppingList
ShoppingListItem
Purchase
InventoryItem
InventoryTransaction
CookingSession

Inventory semantics

Cần chốt:

InventoryItem đại diện cho một batch, một package hay một "lượng thực phẩm đang sở hữu".

Khi nào merge InventoryItem.

Khi nào tạo item mới.

Xử lý opened/unopened package.

Xử lý cùng Food nhưng khác expiry.

FEFO khi consume.

Recommendation

Cần định nghĩa chính xác:

Khi nào hệ thống kết luận user "đủ nguyên liệu" để nấu một recipe nếu Inventory chỉ mang tính approximate?

Đây là một trong những bài toán domain quan trọng nhất của hệ thống.