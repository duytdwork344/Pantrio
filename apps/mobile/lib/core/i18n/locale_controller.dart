import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Locales the app ships strings for. Keep in sync with SUPPORTED_LOCALES in
/// @pantrio/shared and the ARB files in lib/l10n (requirements 2b.1).
const supportedLocaleCodes = ['vi', 'en'];
const defaultLocaleCode = 'vi';

/// Name of each language in itself, for the language picker.
const localeNativeNames = {'vi': 'Tiếng Việt', 'en': 'English'};

/// Maps any tag to a supported code: exact, then base language (en-US → en).
String? matchLocaleCode(String? tag) {
  if (tag == null || tag.trim().isEmpty) return null;
  final value = tag.trim().toLowerCase().replaceAll('_', '-');
  if (supportedLocaleCodes.contains(value)) return value;
  final base = value.split('-').first;
  return supportedLocaleCodes.contains(base) ? base : null;
}

/// Active UI + content locale.
///
/// [preference] is what the user picked (null = follow the device). The
/// effective [code] goes to the API as Accept-Language; when signed in,
/// AuthSession keeps it in sync with User.locale.
class LocaleController extends ChangeNotifier {
  LocaleController._(this._preference);

  static const _prefsKey = 'pantrio.locale';

  String? _preference;

  static Future<LocaleController> load() async {
    final prefs = await SharedPreferences.getInstance();
    return LocaleController._(matchLocaleCode(prefs.getString(_prefsKey)));
  }

  /// User's explicit choice, or null when following the device language.
  String? get preference => _preference;

  String get code =>
      _preference ??
      matchLocaleCode(PlatformDispatcher.instance.locale.toLanguageTag()) ??
      defaultLocaleCode;

  Locale get locale => Locale(code);

  /// Save a choice on this device. Pass null to follow the device again.
  Future<void> setPreference(String? code) async {
    final next = matchLocaleCode(code);
    if (next == _preference) return;
    _preference = next;
    final prefs = await SharedPreferences.getInstance();
    if (next == null) {
      await prefs.remove(_prefsKey);
    } else {
      await prefs.setString(_prefsKey, next);
    }
    notifyListeners();
  }
}
