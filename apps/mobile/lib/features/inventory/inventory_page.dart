import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/inventory_item.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/groups/group_scope_widgets.dart';
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
    this.foodImageUrl,
  });

  final String foodId;
  final String foodName;
  final List<InventoryItem> batches;
  final String? foodImageUrl;

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
  /// 0 = personal, 1 = group
  int _scope = 0;
  InventoryGroup? _group;
  bool _groupLoading = true;
  late Future<List<InventoryItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = _loadItems();
    _reloadGroup();
  }

  String? get _activeGroupId => _scope == 1 ? _group?.id : null;

  Future<List<InventoryItem>> _loadItems() {
    return context.read<AuthSession>().api.getInventory(
          groupId: _activeGroupId,
        );
  }

  Future<void> _reloadGroup() async {
    setState(() => _groupLoading = true);
    try {
      final group = await context.read<AuthSession>().api.getMyGroup();
      if (!mounted) return;
      setState(() {
        _group = group;
        _groupLoading = false;
      });
      if (_scope == 1) {
        await _refreshItems();
      }
    } on ApiException catch (_) {
      if (!mounted) return;
      setState(() {
        _group = null;
        _groupLoading = false;
      });
    }
  }

  Future<void> _refreshItems() async {
    setState(() {
      _future = _loadItems();
    });
    await _future;
  }

  Future<void> _onScopeChanged(int value) async {
    setState(() => _scope = value);
    if (value == 1) {
      await _reloadGroup();
    } else {
      await _refreshItems();
    }
  }

  List<_FoodGroup> _groupItems(List<InventoryItem> items) {
    final map = <String, _FoodGroup>{};
    for (final item in items) {
      final existing = map[item.foodId];
      if (existing == null) {
        map[item.foodId] = _FoodGroup(
          foodId: item.foodId,
          foodName: item.foodName,
          batches: [item],
          foodImageUrl: item.foodImageUrl,
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
      MaterialPageRoute(
        builder: (_) => AddInventoryPage(groupId: _activeGroupId),
      ),
    );
    if (created == true && mounted) {
      await _refreshItems();
    }
  }

  Future<void> _openEdit(InventoryItem item) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EditInventoryPage(item: item)),
    );
    if (updated == true && mounted) {
      await _refreshItems();
    }
  }

  Future<void> _delete(InventoryItem item) async {
    try {
      await context.read<AuthSession>().api.deleteInventoryItem(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Removed ${item.foodName} batch')),
      );
      await _refreshItems();
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

  String _batchSubtitle(InventoryItem batch) {
    final parts = <String>[];
    if (batch.purchaseDate != null && batch.purchaseDate!.isNotEmpty) {
      parts.add('bought ${_shortDate(batch.purchaseDate!)}');
    }
    if (batch.expiryDate != null && batch.expiryDate!.isNotEmpty) {
      parts.add('exp ${_shortDate(batch.expiryDate!)}');
    }
    final note = batch.notes?.trim();
    if (note != null && note.isNotEmpty) {
      parts.add(note);
    }
    if (parts.isEmpty) {
      return 'No note';
    }
    return parts.join(' · ');
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

  Widget _buildItemList({required bool showFab}) {
    return FutureBuilder<List<InventoryItem>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorPane(
            message: snapshot.error.toString(),
            onRetry: _refreshItems,
          );
        }
        final items = snapshot.data ?? const <InventoryItem>[];
        final label = _scope == 0 ? 'Personal' : 'Group';
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: _refreshItems,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: [
                const SizedBox(height: 48),
                Text(
                  _scope == 0
                      ? 'No inventory batches yet.\nAdd food from search, or purchase from a shopping list.'
                      : 'Shared pantry is empty.\nAdd food or purchase from a group shopping list.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }
        final groups = _groupItems(items);
        return RefreshIndicator(
          onRefresh: _refreshItems,
          child: ListView.builder(
            padding: EdgeInsets.fromLTRB(16, 0, 16, showFab ? 88 : 24),
            itemCount: groups.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8, top: 4),
                  child: Text(
                    '$label · ${groups.length} foods · ${items.length} batches',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                );
              }
              final group = groups[index - 1];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ExpansionTile(
                  initiallyExpanded: groups.length <= 4,
                  leading: RemoteThumb(
                    url: group.foodImageUrl,
                    size: 44,
                    icon: Icons.kitchen_outlined,
                  ),
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
                          subtitle: Text(
                            _batchSubtitle(batch),
                            style: _isExpiringSoon(batch.expiryDate)
                                ? TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.error,
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final inGroup = _group != null;
    final showFab = _scope == 0 || inGroup;

    return Scaffold(
      body: Column(
        children: [
          ScopeSegmentBar(index: _scope, onChanged: _onScopeChanged),
          if (_scope == 1 && _groupLoading)
            const LinearProgressIndicator(minHeight: 2),
          if (_scope == 1 && !_groupLoading && inGroup)
            GroupHeaderBar(
              group: _group!,
              onChanged: _reloadGroup,
            ),
          Expanded(
            child: _scope == 1 && !_groupLoading && !inGroup
                ? RefreshIndicator(
                    onRefresh: _reloadGroup,
                    child: GroupJoinPane(onJoined: _reloadGroup),
                  )
                : _buildItemList(showFab: showFab),
          ),
        ],
      ),
      floatingActionButton: showFab
          ? FloatingActionButton(
              heroTag: 'fab_inventory',
              onPressed: _openAdd,
              child: const Icon(Icons.add),
            )
          : null,
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
