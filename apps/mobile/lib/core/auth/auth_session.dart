import 'package:flutter/foundation.dart';
import 'package:pantrio_mobile/core/api/api_config.dart';
import 'package:pantrio_mobile/core/api/pantrio_api_client.dart';
import 'package:pantrio_mobile/core/i18n/locale_controller.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/user_profile.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthSession extends ChangeNotifier {
  AuthSession({String? baseUrl, required this.localeController})
      : baseUrl = baseUrl ?? ApiConfig.defaultBaseUrl() {
    api = PantrioApiClient(
      baseUrl: this.baseUrl,
      tokenProvider: () => accessToken,
      localeProvider: () => localeController.code,
    );
  }

  final LocaleController localeController;

  static const _tokenKey = 'pantrio_access_token';

  final String baseUrl;
  late final PantrioApiClient api;

  String? accessToken;
  UserProfile? user;
  bool restoring = true;

  /// Household membership shared by the recipe Cook and Group tabs.
  /// Null means the user is not in a group.
  InventoryGroup? membership;
  bool membershipReady = false;

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
      await _applyUserLocale();
      await _assignMembership();
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
    await _applyUserLocale();
    await _assignMembership();
    notifyListeners();
  }

  /// Change the app language ([code] null = follow the device). Saved on the
  /// device right away and on the account (User.locale) when signed in.
  Future<void> setLocale(String? code) async {
    await localeController.setPreference(code);
    if (!isAuthenticated) return;
    try {
      user = await api.updateMyLocale(localeController.preference);
      notifyListeners();
    } catch (_) {
      // Kept on the device; the account copy syncs on the next change.
    }
  }

  /// A saved account language wins over the device setting after sign-in.
  Future<void> _applyUserLocale() async {
    final fromUser = matchLocaleCode(user?.locale);
    if (fromUser != null) await localeController.setPreference(fromUser);
  }

  /// Re-read GET /groups/me and notify every tab that shows group state.
  Future<void> reloadMembership() async {
    await _assignMembership();
    notifyListeners();
  }

  Future<void> logout({bool notify = true}) async {
    accessToken = null;
    user = null;
    membership = null;
    membershipReady = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    if (notify) {
      notifyListeners();
    }
  }

  Future<void> _assignMembership() async {
    if (!isAuthenticated) {
      membership = null;
      membershipReady = true;
      return;
    }
    try {
      membership = await api.getMyGroup();
    } catch (_) {
      membership = null;
    }
    membershipReady = true;
  }
}
