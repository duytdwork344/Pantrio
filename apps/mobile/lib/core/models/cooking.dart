import 'package:pantrio_mobile/core/models/recipe.dart';

class RecommendationMissing {
  RecommendationMissing({
    required this.foodId,
    required this.foodName,
    required this.quantity,
    required this.unit,
  });

  final String foodId;
  final String foodName;
  final num quantity;
  final String unit;

  factory RecommendationMissing.fromJson(Map<String, dynamic> json) {
    return RecommendationMissing(
      foodId: json['foodId'] as String,
      foodName: json['foodName'] as String,
      quantity: json['quantity'] as num,
      unit: json['unit'] as String,
    );
  }
}

class RecipeRecommendation {
  RecipeRecommendation({
    required this.recipe,
    required this.requiredCount,
    required this.matchedCount,
    required this.missingCount,
    required this.canCook,
    required this.missing,
  });

  final RecipeSummary recipe;
  final int requiredCount;
  final int matchedCount;
  final int missingCount;
  final bool canCook;
  final List<RecommendationMissing> missing;

  factory RecipeRecommendation.fromJson(Map<String, dynamic> json) {
    return RecipeRecommendation(
      recipe: RecipeSummary.fromJson(json['recipe'] as Map<String, dynamic>),
      requiredCount: json['requiredCount'] as int,
      matchedCount: json['matchedCount'] as int,
      missingCount: json['missingCount'] as int,
      canCook: json['canCook'] as bool? ?? false,
      missing: (json['missing'] as List<dynamic>? ?? const [])
          .map(
            (e) => RecommendationMissing.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class CookingConsumptionLine {
  CookingConsumptionLine({
    required this.foodId,
    required this.foodName,
    required this.neededQuantity,
    required this.neededUnit,
    required this.consumedQuantity,
    required this.consumedUnit,
    required this.shortfallQuantity,
  });

  final String foodId;
  final String foodName;
  final num neededQuantity;
  final String neededUnit;
  final num consumedQuantity;
  final String consumedUnit;
  final num shortfallQuantity;

  factory CookingConsumptionLine.fromJson(Map<String, dynamic> json) {
    return CookingConsumptionLine(
      foodId: json['foodId'] as String,
      foodName: json['foodName'] as String,
      neededQuantity: json['neededQuantity'] as num,
      neededUnit: json['neededUnit'] as String,
      consumedQuantity: json['consumedQuantity'] as num,
      consumedUnit: json['consumedUnit'] as String,
      shortfallQuantity: json['shortfallQuantity'] as num,
    );
  }
}

class CookingSession {
  CookingSession({
    required this.id,
    required this.recipeId,
    required this.servings,
    required this.cookedAt,
    required this.consumptions,
    this.notes,
    this.recipe,
  });

  final String id;
  final String recipeId;
  final int servings;
  final String cookedAt;
  final String? notes;
  final RecipeSummary? recipe;
  final List<CookingConsumptionLine> consumptions;

  factory CookingSession.fromJson(Map<String, dynamic> json) {
    final recipe = json['recipe'];
    return CookingSession(
      id: json['id'] as String,
      recipeId: json['recipeId'] as String,
      servings: json['servings'] as int,
      cookedAt: json['cookedAt'] as String,
      notes: json['notes'] as String?,
      recipe: recipe is Map<String, dynamic>
          ? RecipeSummary.fromJson(recipe)
          : recipe is Map
              ? RecipeSummary.fromJson(Map<String, dynamic>.from(recipe))
              : null,
      consumptions: (json['consumptions'] as List<dynamic>? ?? const [])
          .map(
            (e) =>
                CookingConsumptionLine.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
