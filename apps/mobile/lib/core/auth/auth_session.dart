import 'package:flutter/foundation.dart';
import 'package:pantrio_mobile/core/api/api_config.dart';
import 'package:pantrio_mobile/core/api/pantrio_api_client.dart';
import 'package:pantrio_mobile/core/models/user_profile.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthSession extends ChangeNotifier {
  AuthSession({String? baseUrl})
      : baseUrl = baseUrl ?? ApiConfig.defaultBaseUrl() {
    api = PantrioApiClient(
      baseUrl: this.baseUrl,
      tokenProvider: () => accessToken,
    );
  }

  static const _tokenKey = 'pantrio_access_token';

  final String baseUrl;
  late final PantrioApiClient api;

  String? accessToken;
  UserProfile? user;
  bool restoring = true;

  bool get isAuthenticated =>
      accessToken != null && accessToken!.isNotEmpty;

  Future<void> restore() async {
    restoring = true;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey);
      if (token == null || token.isEmpty) {
        accessToken = null;
        user = null;
        return;
      }
      accessToken = token;
      user = await api.me();
    } catch (_) {
      await logout(notify: false);
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    final result = await api.login(email: email, password: password);
    accessToken = result.accessToken;
    user = result.user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, result.accessToken);
    notifyListeners();
  }

  Future<void> logout({bool notify = true}) async {
    accessToken = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    if (notify) {
      notifyListeners();
    }
  }
}
