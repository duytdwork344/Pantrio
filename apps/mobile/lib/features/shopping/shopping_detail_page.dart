import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/shopping_list.dart';
import 'package:pantrio_mobile/features/shopping/add_shopping_item_page.dart';
import 'package:provider/provider.dart';

class ShoppingDetailPage extends StatefulWidget {
  const ShoppingDetailPage({super.key, required this.listId});

  final String listId;

  @override
  State<ShoppingDetailPage> createState() => _ShoppingDetailPageState();
}

class _ShoppingDetailPageState extends State<ShoppingDetailPage> {
  late Future<ShoppingListDetail> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ShoppingListDetail> _load() {
    return context.read<AuthSession>().api.getShoppingList(widget.listId);
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  Future<void> _addItem() async {
    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AddShoppingItemPage(listId: widget.listId),
      ),
    );
    if (added == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _purchase(ShoppingListItem item) async {
    try {
      await context.read<AuthSession>().api.purchaseShoppingItem(
            listId: widget.listId,
            itemId: item.id,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Purchased ${item.foodName} → inventory')),
      );
      await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _markBought(ShoppingListItem item) async {
    try {
      await context.read<AuthSession>().api.updateShoppingItem(
            listId: widget.listId,
            itemId: item.id,
            status: 'PURCHASED',
          );
      if (mounted) await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _reset() async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset list?'),
        content: const Text(
          'Mark all purchased/skipped items as pending again. '
          'Inventory is not changed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await api.resetShoppingList(widget.listId);
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('List reset to pending')),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _delete() async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete list?'),
        content: const Text('This removes the shopping list and its items.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await api.deleteShoppingList(widget.listId);
      messenger.showSnackBar(
        const SnackBar(content: Text('Shopping list deleted')),
      );
      nav.pop(true);
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shopping list'),
        actions: [
          IconButton(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'reset') {
                _reset();
              } else if (value == 'delete') {
                _delete();
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(
                value: 'reset',
                child: Text('Reset to pending'),
              ),
              PopupMenuItem(
                value: 'delete',
                child: Text('Delete list'),
              ),
            ],
          ),
        ],
      ),
      body: FutureBuilder<ShoppingListDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _refresh,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }
          final detail = snapshot.data!;
          final allDone =
              detail.itemCount > 0 && detail.pendingCount == 0;

          if (detail.items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  '${detail.name}\n\nNo items yet. Add food from catalog search.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            itemCount: detail.items.length + 1 + (allDone ? 1 : 0),
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              var i = index;
              if (allDone) {
                if (i == 0) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'All items done',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Reset to reuse this list, or delete it.',
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              OutlinedButton(
                                onPressed: _reset,
                                child: const Text('Reset'),
                              ),
                              const SizedBox(width: 8),
                              FilledButton(
                                onPressed: _delete,
                                child: const Text('Delete'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }
                i -= 1;
              }
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '${detail.name} · ${detail.pendingCount} pending',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                );
              }
              final item = detail.items[i - 1];
              final pending = item.status == 'PENDING';
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item.foodName),
                subtitle: Text(
                  '${item.quantity} ${item.unit} · ${item.status}'
                  '${item.note != null ? ' · ${item.note}' : ''}',
                ),
                trailing: pending
                    ? Wrap(
                        spacing: 4,
                        children: [
                          IconButton(
                            tooltip: 'Mark purchased (no inventory)',
                            onPressed: () => _markBought(item),
                            icon: const Icon(Icons.check),
                          ),
                          IconButton(
                            tooltip: 'Purchase → inventory',
                            onPressed: () => _purchase(item),
                            icon: const Icon(Icons.inventory_2_outlined),
                          ),
                        ],
                      )
                    : Icon(
                        Icons.done_all,
                        color: Theme.of(context).colorScheme.primary,
                      ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addItem,
        child: const Icon(Icons.add),
      ),
    );
  }
}
