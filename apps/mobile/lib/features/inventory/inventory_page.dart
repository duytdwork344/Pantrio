import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/pantrio_api_client.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key});

  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  final _api = PantrioApiClient();
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _api.getInventory();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = snapshot.data!;
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Text(
                'Inventory batches (FEFO-ready)',
                style: Theme.of(context).textTheme.titleMedium,
              );
            }
            final item = items[index - 1];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item['foodName'] as String),
              subtitle: Text(
                '${item['quantity']} ${item['unit']} · ${item['storageLocation']}',
              ),
              trailing: item['expiryDate'] == null
                  ? null
                  : Text(
                      'exp ${item['expiryDate']}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
            );
          },
        );
      },
    );
  }
}
