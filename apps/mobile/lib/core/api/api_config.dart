import 'dart:io' show Platform;

/// Nest global prefix is `/api`.
///
/// Override: `flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3001/api`
class ApiConfig {
  static String defaultBaseUrl() {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) {
      return fromEnv;
    }
    // Android emulator reaches host machine via 10.0.2.2
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3001/api';
    }
    return 'http://127.0.0.1:3001/api';
  }
}
