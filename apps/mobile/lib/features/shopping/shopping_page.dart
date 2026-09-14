import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/pantrio_api_client.dart';

class ShoppingPage extends StatefulWidget {
  const ShoppingPage({super.key});

  @override
  State<ShoppingPage> createState() => _ShoppingPageState();
}

class _ShoppingPageState extends State<ShoppingPage> {
  final _api = PantrioApiClient();
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _api.getShoppingLists();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final lists = snapshot.data!;
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: lists.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Text(
                'Shopping lists',
                style: Theme.of(context).textTheme.titleMedium,
              );
            }
            final list = lists[index - 1];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(list['name'] as String),
              subtitle: Text(
                '${list['pendingCount']} pending / ${list['itemCount']} items',
              ),
            );
          },
        );
      },
    );
  }
}
