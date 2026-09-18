class FoodItem {
  FoodItem({
    required this.id,
    required this.slug,
    required this.name,
    required this.baseUnit,
    required this.visibility,
    this.category,
  });

  final String id;
  final String slug;
  final String name;
  final String baseUnit;
  final String visibility;
  final String? category;

  factory FoodItem.fromJson(Map<String, dynamic> json) {
    return FoodItem(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      baseUnit: json['baseUnit'] as String,
      visibility: json['visibility'] as String,
      category: json['category'] as String?,
    );
  }
}
