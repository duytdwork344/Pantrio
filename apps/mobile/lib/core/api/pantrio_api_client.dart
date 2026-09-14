/// Thin API client wrapper. Replace/extend with OpenAPI-generated Dio client
/// via `apps/mobile/tool/generate_api.sh` after exporting NestJS OpenAPI.
class PantrioApiClient {
  PantrioApiClient({this.baseUrl = 'http://localhost:3001/api'});

  final String baseUrl;

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<List<Map<String, dynamic>>> getInventory({String userId = 'demo-user'}) async {
    // Placeholder until dio wiring; keeps feature screens compile-ready.
    return [
      {
        'foodName': 'Chicken',
        'quantity': 500,
        'unit': 'g',
        'storageLocation': 'FRIDGE',
        'expiryDate': '2026-09-15',
      },
      {
        'foodName': 'Egg',
        'quantity': 6,
        'unit': 'pcs',
        'storageLocation': 'FRIDGE',
        'expiryDate': null,
      },
    ];
  }

  Future<List<Map<String, dynamic>>> getShoppingLists({String userId = 'demo-user'}) async {
    return [
      {
        'name': 'This week',
        'itemCount': 4,
        'pendingCount': 3,
      },
    ];
  }

  // Exposed for future network calls.
  Uri healthUri() => _uri('/health');
}
