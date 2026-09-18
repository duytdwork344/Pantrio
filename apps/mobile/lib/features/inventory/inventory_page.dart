import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_item.dart';
import 'package:pantrio_mobile/features/inventory/add_inventory_page.dart';
import 'package:pantrio_mobile/features/inventory/edit_inventory_page.dart';
import 'package:provider/provider.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key});

  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _FoodGroup {
  _FoodGroup({
    required this.foodId,
    required this.foodName,
    required this.batches,
  });

  final String foodId;
  final String foodName;
  final List<InventoryItem> batches;

  String get totalsLabel {
    final byUnit = <String, num>{};
    for (final b in batches) {
      byUnit[b.unit] = (byUnit[b.unit] ?? 0) + b.quantity;
    }
    return byUnit.entries
        .map((e) => '${_fmt(e.value)} ${e.key}')
        .join(' + ');
  }

  static String _fmt(num value) {
    if (value == value.roundToDouble()) {
      return value.round().toString();
    }
    return value.toStringAsFixed(value >= 10 ? 1 : 2);
  }
}

class _InventoryPageState extends State<InventoryPage> {
  late Future<List<InventoryItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<InventoryItem>> _load() {
    return context.read<AuthSession>().api.getInventory();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  List<_FoodGroup> _group(List<InventoryItem> items) {
    final map = <String, _FoodGroup>{};
    for (final item in items) {
      final existing = map[item.foodId];
      if (existing == null) {
        map[item.foodId] = _FoodGroup(
          foodId: item.foodId,
          foodName: item.foodName,
          batches: [item],
        );
      } else {
        existing.batches.add(item);
      }
    }
    final groups = map.values.toList()
      ..sort((a, b) => a.foodName.toLowerCase().compareTo(b.foodName.toLowerCase()));
    for (final g in groups) {
      g.batches.sort((a, b) {
        final ae = a.expiryDate ?? '9999';
        final be = b.expiryDate ?? '9999';
        return ae.compareTo(be);
      });
    }
    return groups;
  }

  Future<void> _openAdd() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddInventoryPage()),
    );
    if (created == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _openEdit(InventoryItem item) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EditInventoryPage(item: item)),
    );
    if (updated == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _delete(InventoryItem item) async {
    try {
      await context.read<AuthSession>().api.deleteInventoryItem(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Removed ${item.foodName} batch')),
      );
      await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  String _shortDate(String iso) {
    if (iso.length >= 10) return iso.substring(0, 10);
    return iso;
  }

  bool _isExpiringSoon(String? iso) {
    if (iso == null) return false;
    final d = DateTime.tryParse(iso);
    if (d == null) return false;
    final today = DateTime.now();
    final day = DateTime(d.year, d.month, d.day);
    final start = DateTime(today.year, today.month, today.day);
    final diff = day.difference(start).inDays;
    return diff <= 3;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<InventoryItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorPane(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }
          final items = snapshot.data ?? const <InventoryItem>[];
          if (items.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Text(
                    'No inventory batches yet.\nAdd food from search, or purchase from a shopping list.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          final groups = _group(items);
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              itemCount: groups.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Inventory · ${groups.length} foods · ${items.length} batches',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  );
                }
                final group = groups[index - 1];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ExpansionTile(
                    initiallyExpanded: groups.length <= 4,
                    title: Text(group.foodName),
                    subtitle: Text(
                      '${group.totalsLabel} · ${group.batches.length} batch${group.batches.length == 1 ? '' : 'es'}',
                    ),
                    children: [
                      for (final batch in group.batches)
                        Dismissible(
                          key: ValueKey(batch.id),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 16),
                            color: Theme.of(context).colorScheme.errorContainer,
                            child: const Icon(Icons.delete_outline),
                          ),
                          confirmDismiss: (_) async {
                            return await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Remove batch?'),
                                    content: Text(
                                      '${batch.foodName} · ${batch.quantity} ${batch.unit}',
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      FilledButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, true),
                                        child: const Text('Remove'),
                                      ),
                                    ],
                                  ),
                                ) ??
                                false;
                          },
                          onDismissed: (_) => _delete(batch),
                          child: ListTile(
                            title: Text(
                              '${batch.quantity} ${batch.unit} · ${batch.storageLocation}'
                              '${batch.opened ? ' · opened' : ''}',
                            ),
                            subtitle: batch.expiryDate == null
                                ? const Text('No expiry · tap to edit')
                                : Text(
                                    'exp ${_shortDate(batch.expiryDate!)} · tap to edit',
                                    style: _isExpiringSoon(batch.expiryDate)
                                        ? TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .error,
                                          )
                                        : null,
                                  ),
                            trailing: const Icon(Icons.edit_outlined),
                            onTap: () => _openEdit(batch),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'fab_inventory',
        onPressed: _openAdd,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  const _ErrorPane({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
