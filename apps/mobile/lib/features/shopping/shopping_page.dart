import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/shopping_list.dart';
import 'package:pantrio_mobile/features/groups/group_scope_widgets.dart';
import 'package:pantrio_mobile/features/shopping/merge_shopping_lists_page.dart';
import 'package:pantrio_mobile/features/shopping/shopping_detail_page.dart';
import 'package:provider/provider.dart';

class ShoppingPage extends StatefulWidget {
  const ShoppingPage({super.key});

  @override
  State<ShoppingPage> createState() => _ShoppingPageState();
}

class _ShoppingPageState extends State<ShoppingPage> {
  /// 0 = personal, 1 = group
  int _scope = 0;
  InventoryGroup? _group;
  bool _groupLoading = true;
  late Future<List<ShoppingListSummary>> _future;

  @override
  void initState() {
    super.initState();
    _future = _loadLists();
    _reloadGroup();
  }

  String? get _activeGroupId => _scope == 1 ? _group?.id : null;

  Future<List<ShoppingListSummary>> _loadLists() {
    return context.read<AuthSession>().api.getShoppingLists(
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
        await _refreshLists();
      }
    } on ApiException catch (_) {
      if (!mounted) return;
      setState(() {
        _group = null;
        _groupLoading = false;
      });
    }
  }

  Future<void> _refreshLists() async {
    setState(() {
      _future = _loadLists();
    });
    await _future;
  }

  Future<void> _onScopeChanged(int value) async {
    setState(() => _scope = value);
    if (value == 1) {
      await _reloadGroup();
    } else {
      await _refreshLists();
    }
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
        MaterialPageRoute(
          builder: (_) => MergeShoppingListsPage(groupId: _activeGroupId),
        ),
      );
      if (created != null && mounted) {
        await nav.push(
          MaterialPageRoute(
            builder: (_) => ShoppingDetailPage(listId: created.id),
          ),
        );
        await _refreshLists();
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
      final created = await api.createShoppingList(
        name: name,
        groupId: _activeGroupId,
      );
      if (!mounted) return;
      await nav.push(
        MaterialPageRoute(
          builder: (_) => ShoppingDetailPage(listId: created.id),
        ),
      );
      await _refreshLists();
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
      await _refreshLists();
    }
  }

  Widget _buildListBody({required bool showFab}) {
    return FutureBuilder<List<ShoppingListSummary>>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData && !snapshot.hasError) {
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
                    onPressed: _refreshLists,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }
        final lists = snapshot.data ?? const <ShoppingListSummary>[];
        final label = _scope == 0 ? 'Personal' : 'Group';
        if (lists.isEmpty) {
          return RefreshIndicator(
            onRefresh: _refreshLists,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: [
                const SizedBox(height: 48),
                Text(
                  _scope == 0
                      ? 'No shopping lists yet.\nCreate one to add items or purchase into inventory.'
                      : 'No shared shopping lists yet.\nCreate one — purchases go into the group pantry.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _refreshLists,
          child: ListView.separated(
            padding: EdgeInsets.fromLTRB(16, 0, 16, showFab ? 88 : 24),
            itemCount: lists.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 4),
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 4),
                  child: Text(
                    '$label shopping lists',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                );
              }
              final list = lists[index - 1];
              final allDone = list.itemCount > 0 && list.pendingCount == 0;
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
                : _buildListBody(showFab: showFab),
          ),
        ],
      ),
      floatingActionButton: showFab
          ? FloatingActionButton(
              heroTag: 'fab_shopping',
              onPressed: _showCreateOptions,
              child: const Icon(Icons.add),
            )
          : null,
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
