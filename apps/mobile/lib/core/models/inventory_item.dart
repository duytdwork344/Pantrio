class InventoryItem {
  InventoryItem({
    required this.id,
    required this.foodId,
    required this.foodName,
    required this.quantity,
    required this.unit,
    required this.confidence,
    required this.storageLocation,
    required this.opened,
    this.expiryDate,
    this.purchaseDate,
    this.notes,
  });

  final String id;
  final String foodId;
  final String foodName;
  final num quantity;
  final String unit;
  final String confidence;
  final String storageLocation;
  final bool opened;
  final String? expiryDate;
  final String? purchaseDate;
  final String? notes;

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    return InventoryItem(
      id: json['id'] as String,
      foodId: json['foodId'] as String,
      foodName: json['foodName'] as String,
      quantity: json['quantity'] as num,
      unit: json['unit'] as String,
      confidence: json['confidence'] as String,
      storageLocation: json['storageLocation'] as String,
      opened: json['opened'] as bool? ?? false,
      expiryDate: json['expiryDate'] as String?,
      purchaseDate: json['purchaseDate'] as String?,
      notes: json['notes'] as String?,
    );
  }
}
