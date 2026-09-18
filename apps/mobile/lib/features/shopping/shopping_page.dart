import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/shopping_list.dart';
import 'package:pantrio_mobile/features/shopping/merge_shopping_lists_page.dart';
import 'package:pantrio_mobile/features/shopping/shopping_detail_page.dart';
import 'package:provider/provider.dart';

class ShoppingPage extends StatefulWidget {
  const ShoppingPage({super.key});

  @override
  State<ShoppingPage> createState() => _ShoppingPageState();
}

class _ShoppingPageState extends State<ShoppingPage> {
  late Future<List<ShoppingListSummary>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ShoppingListSummary>> _load() {
    return context.read<AuthSession>().api.getShoppingLists();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  Future<void> _showCreateOptions() async {
    final nav = Navigator.of(context);
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.note_add_outlined),
              title: const Text('Empty list'),
              onTap: () => Navigator.pop(ctx, 'empty'),
            ),
            ListTile(
              leading: const Icon(Icons.merge_type),
              title: const Text('Merge from existing lists'),
              subtitle: const Text('Copy & sum items into a new list'),
              onTap: () => Navigator.pop(ctx, 'merge'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'empty') {
      await _createList();
    } else if (choice == 'merge') {
      final created = await nav.push<ShoppingListDetail>(
        MaterialPageRoute(builder: (_) => const MergeShoppingListsPage()),
      );
      if (created != null && mounted) {
        await nav.push(
          MaterialPageRoute(
            builder: (_) => ShoppingDetailPage(listId: created.id),
          ),
        );
        await _refresh();
      }
    }
  }

  Future<void> _createList() async {
    final api = context.read<AuthSession>().api;
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => const _NewShoppingListDialog(),
    );
    if (name == null || name.isEmpty || !mounted) {
      return;
    }
    try {
      final created = await api.createShoppingList(name: name);
      if (!mounted) return;
      await nav.push(
        MaterialPageRoute(
          builder: (_) => ShoppingDetailPage(listId: created.id),
        ),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openList(ShoppingListSummary list) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ShoppingDetailPage(listId: list.id),
      ),
    );
    if (mounted) {
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<ShoppingListSummary>>(
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
          final lists = snapshot.data ?? const <ShoppingListSummary>[];
          if (lists.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Text(
                    'No shopping lists yet.\nCreate one to add items or purchase into inventory.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              itemCount: lists.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 4),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Text(
                    'Shopping lists',
                    style: Theme.of(context).textTheme.titleMedium,
                  );
                }
                final list = lists[index - 1];
                final allDone =
                    list.itemCount > 0 && list.pendingCount == 0;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(list.name),
                  subtitle: Text(
                    allDone
                        ? '${list.itemCount} items · all done (reset or delete)'
                        : '${list.pendingCount} pending / ${list.itemCount} items',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _openList(list),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'fab_shopping',
        onPressed: _showCreateOptions,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _NewShoppingListDialog extends StatefulWidget {
  const _NewShoppingListDialog();

  @override
  State<_NewShoppingListDialog> createState() => _NewShoppingListDialogState();
}

class _NewShoppingListDialogState extends State<_NewShoppingListDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: 'Shopping list');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New shopping list'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: const InputDecoration(
          labelText: 'Name',
          border: OutlineInputBorder(),
        ),
        onSubmitted: (value) => Navigator.pop(context, value.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Create'),
        ),
      ],
    );
  }
}
