class ShoppingListSummary {
  ShoppingListSummary({
    required this.id,
    required this.name,
    required this.itemCount,
    required this.pendingCount,
  });

  final String id;
  final String name;
  final int itemCount;
  final int pendingCount;

  factory ShoppingListSummary.fromJson(Map<String, dynamic> json) {
    return ShoppingListSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      itemCount: json['itemCount'] as int,
      pendingCount: json['pendingCount'] as int,
    );
  }
}

class ShoppingListItem {
  ShoppingListItem({
    required this.id,
    required this.foodId,
    required this.foodName,
    required this.quantity,
    required this.unit,
    required this.status,
    this.recipeId,
    this.note,
  });

  final String id;
  final String foodId;
  final String foodName;
  final num quantity;
  final String unit;
  final String status;
  final String? recipeId;
  final String? note;

  factory ShoppingListItem.fromJson(Map<String, dynamic> json) {
    return ShoppingListItem(
      id: json['id'] as String,
      foodId: json['foodId'] as String,
      foodName: json['foodName'] as String,
      quantity: json['quantity'] as num,
      unit: json['unit'] as String,
      status: json['status'] as String,
      recipeId: json['recipeId'] as String?,
      note: json['note'] as String?,
    );
  }
}

class ShoppingListDetail extends ShoppingListSummary {
  ShoppingListDetail({
    required super.id,
    required super.name,
    required super.itemCount,
    required super.pendingCount,
    required this.items,
  });

  final List<ShoppingListItem> items;

  factory ShoppingListDetail.fromJson(Map<String, dynamic> json) {
    return ShoppingListDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      itemCount: json['itemCount'] as int,
      pendingCount: json['pendingCount'] as int,
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((e) => ShoppingListItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
