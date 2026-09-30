import 'package:dio/dio.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/models/cooking.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/inventory_item.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/models/shopping_list.dart';
import 'package:pantrio_mobile/core/models/user_profile.dart';

typedef TokenProvider = String? Function();

class PantrioApiClient {
  PantrioApiClient({
    required this.baseUrl,
    required TokenProvider tokenProvider,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl.endsWith('/') ? baseUrl : '$baseUrl/',
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 20),
            headers: {'Content-Type': 'application/json'},
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = tokenProvider();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
      ),
    );
  }

  final String baseUrl;
  final Dio _dio;

  Future<({String accessToken, UserProfile user})> login({
    required String email,
    required String password,
  }) async {
    final data = await _post('auth/login', {
      'email': email.trim(),
      'password': password,
    });
    return (
      accessToken: data['accessToken'] as String,
      user: UserProfile.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<UserProfile> me() async {
    final data = await _get('users/me');
    return UserProfile.fromJson(data);
  }

  Future<InventoryGroup?> getMyGroup() async {
    try {
      final response = await _dio.get<dynamic>('groups/me');
      final data = response.data;
      // Nest sends an empty body for `null` (no membership). JSON null and
      // 204 mean the same thing: this user is not in a group.
      if (response.statusCode == 204 || data == null) return null;
      if (data is String && (data.trim().isEmpty || data.trim() == 'null')) {
        return null;
      }
      return InventoryGroup.fromJson(_asMap(data));
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<InventoryGroup> createGroup({
    required String name,
    int? inviteMaxUses,
  }) async {
    final data = await _post('groups', {
      'name': name.trim(),
      if (inviteMaxUses != null) 'inviteMaxUses': inviteMaxUses,
    });
    return InventoryGroup.fromJson(data);
  }

  Future<InventoryGroup> joinGroup({required String code}) async {
    final data = await _post('groups/join', {
      'code': code.trim(),
    });
    return InventoryGroup.fromJson(data);
  }

  Future<({bool left, bool? dissolved})> leaveGroup() async {
    final data = await _post('groups/me/leave', {});
    return (
      left: data['left'] as bool? ?? true,
      dissolved: data['dissolved'] as bool?,
    );
  }

  Future<InventoryGroup> rotateGroupInvite() async {
    final data = await _post('groups/me/rotate-invite', {});
    return InventoryGroup.fromJson(data);
  }

  Future<List<InventoryItem>> getInventory({String? groupId}) async {
    final list = await _getList(
      'inventory',
      query: {
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      },
    );
    return list.map(InventoryItem.fromJson).toList();
  }

  Future<InventoryItem> createInventoryItem({
    required String foodId,
    required num quantity,
    required String unit,
    String? groupId,
    String storageLocation = 'PANTRY',
    bool opened = false,
    String? purchaseDate,
    String? expiryDate,
    String? notes,
  }) async {
    final data = await _post('inventory', {
      'foodId': foodId,
      'quantity': quantity,
      'unit': unit,
      'storageLocation': storageLocation,
      'opened': opened,
      if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      if (purchaseDate != null) 'purchaseDate': purchaseDate,
      if (expiryDate != null) 'expiryDate': expiryDate,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return InventoryItem.fromJson(data);
  }

  Future<void> deleteInventoryItem(String id) async {
    await _delete('inventory/$id');
  }

  Future<InventoryItem> updateInventoryItem({
    required String id,
    num? quantity,
    String? unit,
    String? storageLocation,
    String? expiryDate,
    String? purchaseDate,
    bool? opened,
    String? notes,
    bool clearExpiry = false,
    bool clearPurchaseDate = false,
  }) async {
    final data = await _patch('inventory/$id', {
      if (quantity != null) 'quantity': quantity,
      if (unit != null) 'unit': unit,
      if (storageLocation != null) 'storageLocation': storageLocation,
      if (clearExpiry) 'expiryDate': null,
      if (!clearExpiry && expiryDate != null) 'expiryDate': expiryDate,
      if (clearPurchaseDate) 'purchaseDate': null,
      if (!clearPurchaseDate && purchaseDate != null)
        'purchaseDate': purchaseDate,
      if (opened != null) 'opened': opened,
      if (notes != null) 'notes': notes,
    });
    return InventoryItem.fromJson(data);
  }

  Future<List<FoodItem>> searchFoods({String? q, String locale = 'en'}) async {
    final data = await _getList(
      'foods',
      query: {
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        'locale': locale,
      },
    );
    return data.map(FoodItem.fromJson).toList();
  }

  Future<FoodItem> createPrivateFood({
    required String name,
    required String baseUnit,
    String locale = 'en',
    String measurementType = 'WEIGHT',
  }) async {
    final slug = _slugify(name);
    final data = await _post('foods', {
      'slug': slug,
      'measurementType': measurementType,
      'baseUnit': baseUnit,
      'translations': [
        {'locale': locale, 'name': name.trim()},
      ],
    });
    return FoodItem.fromJson(data);
  }

  Future<List<ShoppingListSummary>> getShoppingLists({String? groupId}) async {
    final list = await _getList(
      'shopping-lists',
      query: {
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      },
    );
    return list.map(ShoppingListSummary.fromJson).toList();
  }

  Future<ShoppingListDetail> getShoppingList(String id) async {
    final data = await _get('shopping-lists/$id');
    return ShoppingListDetail.fromJson(data);
  }

  Future<ShoppingListDetail> createShoppingList({
    String? name,
    String? groupId,
  }) async {
    final data = await _post('shopping-lists', {
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
      if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
    });
    return ShoppingListDetail.fromJson({
      ...data,
      'items': data['items'] ?? const [],
    });
  }

  Future<ShoppingListDetail> mergeShoppingLists({
    required String name,
    required List<String> sourceListIds,
    String? groupId,
  }) async {
    final data = await _post('shopping-lists/merge-from-lists', {
      'name': name.trim(),
      'sourceListIds': sourceListIds,
      if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
    });
    return ShoppingListDetail.fromJson(data);
  }

  Future<ShoppingListDetail> resetShoppingList(String id) async {
    final data = await _post('shopping-lists/$id/reset', {});
    return ShoppingListDetail.fromJson(data);
  }

  Future<void> deleteShoppingList(String id) async {
    await _delete('shopping-lists/$id');
  }

  Future<ShoppingListItem> addShoppingItem({
    required String listId,
    required String foodId,
    required num quantity,
    required String unit,
    String? note,
  }) async {
    final data = await _post('shopping-lists/$listId/items', {
      'foodId': foodId,
      'quantity': quantity,
      'unit': unit,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    return ShoppingListItem.fromJson(data);
  }

  Future<ShoppingListItem> updateShoppingItem({
    required String listId,
    required String itemId,
    String? status,
    num? quantity,
  }) async {
    final data = await _patch('shopping-lists/$listId/items/$itemId', {
      if (status != null) 'status': status,
      if (quantity != null) 'quantity': quantity,
    });
    return ShoppingListItem.fromJson(data);
  }

  Future<void> purchaseShoppingItem({
    required String listId,
    required String itemId,
    String storageLocation = 'PANTRY',
    String? purchaseDate,
    String? expiryDate,
  }) async {
    await _post('shopping-lists/$listId/items/$itemId/purchase', {
      'storageLocation': storageLocation,
      if (purchaseDate != null) 'purchaseDate': purchaseDate,
      if (expiryDate != null) 'expiryDate': expiryDate,
    });
  }

  Future<ShoppingListDetail> generateShoppingFromPlanned({
    required String listId,
    List<String>? plannedRecipeIds,
  }) async {
    final data = await _post('shopping-lists/$listId/generate-from-planned', {
      if (plannedRecipeIds != null && plannedRecipeIds.isNotEmpty)
        'plannedRecipeIds': plannedRecipeIds,
    });
    return ShoppingListDetail.fromJson(data);
  }

  Future<List<RecipeSummary>> getRecipes() async {
    final list = await _getList('recipes');
    return list.map(RecipeSummary.fromJson).toList();
  }

  Future<List<RecipeSummary>> getMyRecipes() async {
    final list = await _getList('me/recipes');
    return list.map(RecipeSummary.fromJson).toList();
  }

  Future<RecipeDetail> createCatalogRecipe({
    required String title,
    required List<Map<String, dynamic>> ingredients,
    required List<Map<String, dynamic>> steps,
    String? description,
    String? imageUrl,
    int servings = 2,
    String difficulty = 'EASY',
    String visibility = 'PUBLIC',
    int? prepTimeMin,
    int? cookTimeMin,
  }) async {
    final data = await _post('recipes', {
      'title': title,
      'ingredients': ingredients,
      'steps': steps,
      'servings': servings,
      'difficulty': difficulty,
      'visibility': visibility,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (imageUrl != null && imageUrl.trim().isNotEmpty) 'imageUrl': imageUrl.trim(),
      if (prepTimeMin != null) 'prepTimeMin': prepTimeMin,
      if (cookTimeMin != null) 'cookTimeMin': cookTimeMin,
    });
    return RecipeDetail.fromJson(data);
  }

  Future<RecipeDetail> updateCatalogRecipe(
    String id, {
    required String title,
    required List<Map<String, dynamic>> ingredients,
    required List<Map<String, dynamic>> steps,
    String? description,
    String? imageUrl,
    required int servings,
    required String difficulty,
    required String visibility,
    int? prepTimeMin,
    int? cookTimeMin,
  }) async {
    final data = await _patch('recipes/$id', {
      'title': title,
      'ingredients': ingredients,
      'steps': steps,
      'servings': servings,
      'difficulty': difficulty,
      'visibility': visibility,
      'description': description?.trim() ?? '',
      if (imageUrl != null && imageUrl.trim().isNotEmpty) 'imageUrl': imageUrl.trim(),
      if (prepTimeMin != null) 'prepTimeMin': prepTimeMin,
      if (cookTimeMin != null) 'cookTimeMin': cookTimeMin,
    });
    return RecipeDetail.fromJson(data);
  }

  /// Multipart upload → public MinIO/S3 URL for Recipe.imageUrl.
  Future<String> uploadImage({
    required String filePath,
    String folder = 'recipes',
  }) async {
    try {
      final fileName = filePath.split('/').last;
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final response = await _dio.post<dynamic>(
        'media',
        data: form,
        queryParameters: {'folder': folder},
        options: Options(
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          headers: {
            // Override JSON default so Dio can set multipart boundary.
            Headers.contentTypeHeader: Headers.multipartFormDataContentType,
          },
        ),
      );
      final data = _asMap(response.data);
      final url = data['url'] as String?;
      if (url == null || url.isEmpty) {
        throw ApiException('Upload succeeded but no url returned');
      }
      return url;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<List<RecipeSummary>> getGroupCookbookRecipes() async {
    final list = await _getList('groups/me/recipes');
    return list.map(RecipeSummary.fromJson).toList();
  }

  Future<RecipeDetail> getGroupCookbookRecipe(String slug) async {
    final data = await _get('groups/me/recipes/$slug');
    return RecipeDetail.fromJson(data);
  }

  Future<RecipeDetail> createGroupCookbookRecipe({
    required String title,
    required List<Map<String, dynamic>> ingredients,
    List<Map<String, dynamic>>? steps,
    String? instructions,
    String? description,
    String? imageUrl,
    int servings = 2,
    String difficulty = 'EASY',
  }) async {
    final data = await _post('groups/me/recipes', {
      'title': title,
      'ingredients': ingredients,
      if (steps != null && steps.isNotEmpty) 'steps': steps,
      if (instructions != null && instructions.trim().isNotEmpty)
        'instructions': instructions.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (imageUrl != null && imageUrl.trim().isNotEmpty) 'imageUrl': imageUrl.trim(),
      'servings': servings,
      'difficulty': difficulty,
    });
    return RecipeDetail.fromJson(data);
  }

  Future<RecipeDetail> updateGroupCookbookRecipe(
    String id, {
    String? title,
    String? description,
    String? instructions,
    String? imageUrl,
    List<Map<String, dynamic>>? ingredients,
    List<Map<String, dynamic>>? steps,
    int? servings,
    String? difficulty,
  }) async {
    final data = await _patch('groups/me/recipes/$id', {
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (instructions != null) 'instructions': instructions,
      if (imageUrl != null) 'imageUrl': imageUrl,
      if (ingredients != null) 'ingredients': ingredients,
      if (steps != null) 'steps': steps,
      if (servings != null) 'servings': servings,
      if (difficulty != null) 'difficulty': difficulty,
    });
    return RecipeDetail.fromJson(data);
  }

  Future<void> deleteGroupCookbookRecipe(String id) async {
    await _delete('groups/me/recipes/$id');
  }

  Future<RecipeDetail> getRecipeBySlug(
    String slug, {
    String? groupId,
  }) async {
    final data = await _get(
      'recipes/$slug',
      query: {
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      },
    );
    return RecipeDetail.fromJson(data);
  }

  Future<List<RecipeRecommendation>> getRecipeRecommendations({
    String? groupId,
  }) async {
    final list = await _getList(
      'recommendations/recipes',
      query: {
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      },
    );
    return list.map(RecipeRecommendation.fromJson).toList();
  }

  Future<CookingSession> cookRecipe({
    required String recipeId,
    required int servings,
    String? groupId,
    String? notes,
  }) async {
    final data = await _post('cook', {
      'recipeId': recipeId,
      'servings': servings,
      if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
    return CookingSession.fromJson(data);
  }

  Future<List<CookingSession>> getCookingSessions() async {
    final list = await _getList('cooking-sessions');
    return list.map(CookingSession.fromJson).toList();
  }

  Future<CookingSession> getCookingSession(String id) async {
    final data = await _get('cooking-sessions/$id');
    return CookingSession.fromJson(data);
  }

  Future<void> undoCookingSession(String id) async {
    await _post('cooking-sessions/$id/undo', {});
  }

  Future<void> saveRecipe(String recipeId) async {
    await _post('recipes/$recipeId/save', {});
  }

  Future<void> unsaveRecipe(String recipeId) async {
    await _delete('recipes/$recipeId/save');
  }

  /// Intent share. [channel]: copy | native | unknown | …
  Future<({int shareCount, String channel, bool rateLimited})> shareRecipe(
    String recipeId, {
    String channel = 'unknown',
  }) async {
    final data = await _post('recipes/$recipeId/share', {
      'channel': channel,
    });
    return (
      shareCount: data['shareCount'] as int? ?? 0,
      channel: data['channel'] as String? ?? channel,
      rateLimited: data['rateLimited'] as bool? ?? false,
    );
  }

  Future<List<SavedRecipe>> getSavedRecipes() async {
    final list = await _getList('me/saved-recipes');
    return list.map(SavedRecipe.fromJson).toList();
  }

  Future<List<PlannedRecipe>> getPlannedRecipes() async {
    final list = await _getList('me/planned-recipes');
    return list.map(PlannedRecipe.fromJson).toList();
  }

  Future<PlannedRecipe> planRecipe({
    required String recipeId,
    required int servings,
  }) async {
    final data = await _post('me/planned-recipes', {
      'recipeId': recipeId,
      'servings': servings,
    });
    return PlannedRecipe.fromJson(data);
  }

  Future<void> removePlannedRecipe(String id) async {
    await _delete('me/planned-recipes/$id');
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        path,
        queryParameters: query,
      );
      return _asMap(response.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        path,
        queryParameters: query,
      );
      final data = response.data;
      if (data is! List) {
        throw ApiException('Expected list response from $path');
      }
      return data
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post<dynamic>(path, data: body);
      if (response.data == null) {
        return {};
      }
      return _asMap(response.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> _patch(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.patch<dynamic>(path, data: body);
      return _asMap(response.data);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<void> _delete(String path) async {
    try {
      await _dio.delete<dynamic>(path);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data;
    }
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    throw ApiException('Unexpected response shape');
  }

  ApiException _toApiException(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;
    String message = e.message ?? 'Network error';
    if (data is Map) {
      final msg = data['message'];
      if (msg is String) {
        message = msg;
      } else if (msg is List && msg.isNotEmpty) {
        message = msg.join(', ');
      }
    }
    return ApiException(message, statusCode: status);
  }

  String _slugify(String value) {
    final normalized = value
        .toLowerCase()
        .trim()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
    final suffix = DateTime.now().millisecondsSinceEpoch.toString().substring(8);
    return normalized.isEmpty ? 'food-$suffix' : '$normalized-$suffix';
  }
}
