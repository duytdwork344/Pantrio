import 'package:dio/dio.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:pantrio_mobile/core/models/inventory_item.dart';
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

  Future<List<InventoryItem>> getInventory() async {
    final list = await _getList('inventory');
    return list.map(InventoryItem.fromJson).toList();
  }

  Future<InventoryItem> createInventoryItem({
    required String foodId,
    required num quantity,
    required String unit,
    String storageLocation = 'PANTRY',
  }) async {
    final data = await _post('inventory', {
      'foodId': foodId,
      'quantity': quantity,
      'unit': unit,
      'storageLocation': storageLocation,
    });
    return InventoryItem.fromJson(data);
  }

  Future<void> deleteInventoryItem(String id) async {
    await _delete('inventory/$id');
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

  Future<List<ShoppingListSummary>> getShoppingLists() async {
    final list = await _getList('shopping-lists');
    return list.map(ShoppingListSummary.fromJson).toList();
  }

  Future<ShoppingListDetail> getShoppingList(String id) async {
    final data = await _get('shopping-lists/$id');
    return ShoppingListDetail.fromJson(data);
  }

  Future<ShoppingListDetail> createShoppingList({String? name}) async {
    final data = await _post('shopping-lists', {
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
    });
    return ShoppingListDetail.fromJson({
      ...data,
      'items': data['items'] ?? const [],
    });
  }

  Future<ShoppingListDetail> mergeShoppingLists({
    required String name,
    required List<String> sourceListIds,
  }) async {
    final data = await _post('shopping-lists/merge-from-lists', {
      'name': name.trim(),
      'sourceListIds': sourceListIds,
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
  }) async {
    await _post('shopping-lists/$listId/items/$itemId/purchase', {
      'storageLocation': storageLocation,
    });
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
