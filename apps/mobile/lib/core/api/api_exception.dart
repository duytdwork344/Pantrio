/// API error. [code] is the stable ErrorCode from the server
/// (`{ statusCode, code, message, params? }`, requirements 2b.1 #8); show it
/// to users with `localizedError` rather than [message], which is English.
class ApiException implements Exception {
  ApiException(
    this.message, {
    this.statusCode,
    this.code,
    this.params = const {},
  });

  final String message;
  final int? statusCode;
  final String? code;
  final Map<String, dynamic> params;

  @override
  String toString() => message;
}
