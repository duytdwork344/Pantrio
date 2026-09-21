import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/shopping_list.dart';
import 'package:provider/provider.dart';

class MergeShoppingListsPage extends StatefulWidget {
  const MergeShoppingListsPage({super.key, this.groupId});

  final String? groupId;

  @override
  State<MergeShoppingListsPage> createState() => _MergeShoppingListsPageState();
}

class _MergeShoppingListsPageState extends State<MergeShoppingListsPage> {
  final _name = TextEditingController(text: 'Thức ăn cho cả tuần');
  late Future<List<ShoppingListSummary>> _future;
  final Set<String> _selected = {};
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = context.read<AuthSession>().api.getShoppingLists(
          groupId: widget.groupId,
        );
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Enter a name for the new list');
      return;
    }
    if (_selected.isEmpty) {
      setState(() => _error = 'Select at least one source list');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final created = await context.read<AuthSession>().api.mergeShoppingLists(
            name: name,
            sourceListIds: _selected.toList(),
            groupId: widget.groupId,
          );
      if (!mounted) return;
      Navigator.of(context).pop(created);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Merge lists')),
      body: FutureBuilder<List<ShoppingListSummary>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(snapshot.error.toString()));
          }
          final lists = snapshot.data ?? const <ShoppingListSummary>[];
          if (lists.isEmpty) {
            return const Center(
              child: Text('No existing lists to merge from.'),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'New list name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Copy from (sources stay unchanged)',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              ...lists.map(
                (list) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _selected.contains(list.id),
                  title: Text(list.name),
                  subtitle: Text(
                    '${list.pendingCount} pending / ${list.itemCount} items',
                  ),
                  onChanged: (checked) {
                    setState(() {
                      if (checked == true) {
                        _selected.add(list.id);
                      } else {
                        _selected.remove(list.id);
                      }
                    });
                  },
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Create merged list'),
              ),
            ],
          );
        },
      ),
    );
  }
}
