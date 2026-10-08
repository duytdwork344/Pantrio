class RecipeSummary {
  RecipeSummary({
    required this.id,
    required this.title,
    required this.slug,
    required this.servings,
    required this.difficulty,
    this.description,
    this.prepTimeMin,
    this.cookTimeMin,
    this.imageUrl,
    this.videoUrl,
    this.shareCount = 0,
  });

  final String id;
  final String title;
  final String slug;
  final int servings;
  final String difficulty;
  final String? description;
  final int? prepTimeMin;
  final int? cookTimeMin;
  final String? imageUrl;
  final String? videoUrl;
  final int shareCount;

  factory RecipeSummary.fromJson(Map<String, dynamic> json) {
    return RecipeSummary(
      id: json['id'] as String,
      title: json['title'] as String,
      slug: json['slug'] as String,
      servings: json['servings'] as int,
      difficulty: json['difficulty'] as String,
      description: json['description'] as String?,
      prepTimeMin: json['prepTimeMin'] as int?,
      cookTimeMin: json['cookTimeMin'] as int?,
      imageUrl: json['imageUrl'] as String?,
      videoUrl: json['videoUrl'] as String?,
      shareCount: json['shareCount'] as int? ?? 0,
    );
  }
}

class RecipeIngredient {
  RecipeIngredient({
    required this.foodId,
    required this.foodName,
    required this.quantity,
    required this.unit,
    required this.optional,
    required this.sortOrder,
    this.note,
    this.inInventory,
    this.foodImageUrl,
  });

  final String foodId;
  final String foodName;
  final num quantity;
  final String unit;
  final bool optional;
  final int sortOrder;
  final String? note;
  final bool? inInventory;
  final String? foodImageUrl;

  factory RecipeIngredient.fromJson(Map<String, dynamic> json) {
    return RecipeIngredient(
      foodId: json['foodId'] as String,
      foodName: json['foodName'] as String,
      quantity: json['quantity'] as num,
      unit: json['unit'] as String,
      optional: json['optional'] as bool? ?? false,
      sortOrder: json['sortOrder'] as int? ?? 0,
      note: json['note'] as String?,
      inInventory: json['inInventory'] as bool?,
      foodImageUrl: json['foodImageUrl'] as String?,
    );
  }
}

class RecipeStep {
  RecipeStep({
    required this.id,
    required this.sortOrder,
    required this.body,
    this.imageUrl,
  });

  final String id;
  final int sortOrder;
  final String body;
  final String? imageUrl;

  factory RecipeStep.fromJson(Map<String, dynamic> json) {
    return RecipeStep(
      id: json['id'] as String? ?? '',
      sortOrder: json['sortOrder'] as int? ?? 0,
      body: json['body'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class RecipeDetail extends RecipeSummary {
  RecipeDetail({
    required super.id,
    required super.title,
    required super.slug,
    required super.servings,
    required super.difficulty,
    required this.authorId,
    required this.visibility,
    required this.instructions,
    required this.ingredients,
    this.steps = const [],
    super.description,
    super.prepTimeMin,
    super.cookTimeMin,
    super.imageUrl,
    super.videoUrl,
    super.shareCount,
    this.saved,
    this.groupId,
    this.nutrition,
  });

  final String authorId;
  final String? groupId;
  final String visibility;
  final String instructions;
  final List<RecipeStep> steps;
  final List<RecipeIngredient> ingredients;
  final bool? saved;
  final RecipeNutrition? nutrition;

  RecipeDetail copyWith({int? shareCount, bool? saved}) {
    return RecipeDetail(
      id: id,
      title: title,
      slug: slug,
      servings: servings,
      difficulty: difficulty,
      authorId: authorId,
      groupId: groupId,
      visibility: visibility,
      instructions: instructions,
      steps: steps,
      ingredients: ingredients,
      description: description,
      prepTimeMin: prepTimeMin,
      cookTimeMin: cookTimeMin,
      imageUrl: imageUrl,
      videoUrl: videoUrl,
      shareCount: shareCount ?? this.shareCount,
      saved: saved ?? this.saved,
      nutrition: nutrition,
    );
  }

  factory RecipeDetail.fromJson(Map<String, dynamic> json) {
    return RecipeDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      slug: json['slug'] as String,
      servings: json['servings'] as int,
      difficulty: json['difficulty'] as String,
      description: json['description'] as String?,
      prepTimeMin: json['prepTimeMin'] as int?,
      cookTimeMin: json['cookTimeMin'] as int?,
      imageUrl: json['imageUrl'] as String?,
      videoUrl: json['videoUrl'] as String?,
      shareCount: json['shareCount'] as int? ?? 0,
      authorId: json['authorId'] as String,
      groupId: json['groupId'] as String?,
      visibility: json['visibility'] as String,
      instructions: json['instructions'] as String? ?? '',
      saved: json['saved'] as bool?,
      steps: (json['steps'] as List<dynamic>? ?? const [])
          .map((e) => RecipeStep.fromJson(e as Map<String, dynamic>))
          .toList(),
      ingredients: (json['ingredients'] as List<dynamic>? ?? const [])
          .map((e) => RecipeIngredient.fromJson(e as Map<String, dynamic>))
          .toList(),
      nutrition: json['nutrition'] is Map
          ? RecipeNutrition.fromJson(
              Map<String, dynamic>.from(json['nutrition'] as Map),
            )
          : null,
    );
  }
}

class NutrientContribution {
  NutrientContribution({
    required this.foodId,
    required this.foodName,
    required this.amount,
  });

  final String foodId;
  final String foodName;
  final num amount;

  factory NutrientContribution.fromJson(Map<String, dynamic> json) {
    return NutrientContribution(
      foodId: json['foodId'] as String? ?? '',
      foodName: json['foodName'] as String? ?? '',
      amount: json['amount'] as num? ?? 0,
    );
  }
}

class NutrientAmount {
  NutrientAmount({
    required this.code,
    required this.nameEn,
    required this.nameVi,
    required this.unit,
    required this.amount,
    required this.complete,
    this.contributions = const [],
  });

  final String code;
  final String nameEn;
  final String nameVi;
  final String unit;
  final num amount;
  final bool complete;
  final List<NutrientContribution> contributions;

  factory NutrientAmount.fromJson(Map<String, dynamic> json) {
    return NutrientAmount(
      code: json['code'] as String,
      nameEn: json['nameEn'] as String? ?? json['code'] as String,
      nameVi: json['nameVi'] as String? ?? json['code'] as String,
      unit: json['unit'] as String? ?? '',
      amount: json['amount'] as num? ?? 0,
      complete: json['complete'] as bool? ?? false,
      contributions: (json['contributions'] as List<dynamic>? ?? const [])
          .map(
            (e) => NutrientContribution.fromJson(
              Map<String, dynamic>.from(e as Map),
            ),
          )
          .toList(),
    );
  }
}

class RecipeNutrition {
  RecipeNutrition({
    required this.perServing,
    required this.total,
    required this.servings,
    required this.complete,
  });

  final List<NutrientAmount> perServing;
  final List<NutrientAmount> total;
  final int servings;
  final bool complete;

  factory RecipeNutrition.fromJson(Map<String, dynamic> json) {
    return RecipeNutrition(
      perServing: (json['perServing'] as List<dynamic>? ?? const [])
          .map((e) => NutrientAmount.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as List<dynamic>? ?? const [])
          .map((e) => NutrientAmount.fromJson(e as Map<String, dynamic>))
          .toList(),
      servings: json['servings'] as int? ?? 1,
      complete: json['complete'] as bool? ?? false,
    );
  }
}

class SavedRecipe {
  SavedRecipe({
    required this.id,
    required this.recipeId,
    required this.savedAt,
    required this.recipe,
  });

  final String id;
  final String recipeId;
  final String savedAt;
  final RecipeSummary recipe;

  factory SavedRecipe.fromJson(Map<String, dynamic> json) {
    return SavedRecipe(
      id: json['id'] as String,
      recipeId: json['recipeId'] as String,
      savedAt: json['savedAt']?.toString() ?? '',
      recipe: RecipeSummary.fromJson(json['recipe'] as Map<String, dynamic>),
    );
  }
}

class PlannedRecipe {
  PlannedRecipe({
    required this.id,
    required this.recipeId,
    required this.servings,
    required this.createdAt,
    required this.recipe,
    this.plannedFor,
  });

  final String id;
  final String recipeId;
  final int servings;
  final String createdAt;
  final String? plannedFor;
  final RecipeSummary recipe;

  factory PlannedRecipe.fromJson(Map<String, dynamic> json) {
    return PlannedRecipe(
      id: json['id'] as String,
      recipeId: json['recipeId'] as String,
      servings: json['servings'] as int,
      createdAt: json['createdAt']?.toString() ?? '',
      plannedFor: json['plannedFor'] as String?,
      recipe: RecipeSummary.fromJson(json['recipe'] as Map<String, dynamic>),
    );
  }
}
