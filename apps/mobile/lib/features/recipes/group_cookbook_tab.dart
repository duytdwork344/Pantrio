import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/groups/group_scope_widgets.dart';
import 'package:pantrio_mobile/features/recipes/create_group_recipe_page.dart';
import 'package:pantrio_mobile/features/recipes/recipe_detail_page.dart';
import 'package:provider/provider.dart';

/// Group cookbook list (requirements 4.2c). Requires active InventoryGroup.
class GroupCookbookTab extends StatefulWidget {
  const GroupCookbookTab({super.key});

  @override
  State<GroupCookbookTab> createState() => _GroupCookbookTabState();
}

class _GroupCookbookTabState extends State<GroupCookbookTab>
    with AutomaticKeepAliveClientMixin {
  List<RecipeSummary> _recipes = const [];
  Object? _error;
  String? _loadedId;
  String? _pendingId;

  @override
  bool get wantKeepAlive => true;

  Future<void> _load(String groupId) async {
    final api = context.read<AuthSession>().api;
    setState(() {
      _pendingId = groupId;
      _error = null;
    });
    try {
      final recipes = await api.getGroupCookbookRecipes();
      if (!mounted) return;
      if (context.read<AuthSession>().membership?.id != groupId) return;
      setState(() {
        _recipes = List<RecipeSummary>.from(recipes);
        _loadedId = groupId;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loadedId = groupId;
      });
    }
  }

  Future<void> _reload() async {
    final session = context.read<AuthSession>();
    await session.reloadMembership();
    if (!mounted) return;
    final id = session.membership?.id;
    if (id == null) {
      setState(() {
        _recipes = const [];
        _loadedId = null;
        _pendingId = null;
        _error = null;
      });
      return;
    }
    await _load(id);
  }

  Future<void> _open(RecipeSummary recipe, {required String groupId}) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecipeDetailPage(
          slug: recipe.slug,
          pantryGroupId: groupId,
          useGroupCookbook: true,
        ),
      ),
    );
    if (mounted) await _reload();
  }

  Future<void> _create(InventoryGroup group) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateGroupRecipePage(groupName: group.name),
      ),
    );
    if (created == true && mounted) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final session = context.watch<AuthSession>();
    if (!session.membershipReady) {
      return const Center(child: CircularProgressIndicator());
    }

    final group = session.membership;
    if (group == null) {
      if (_loadedId != null || _recipes.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (context.read<AuthSession>().membership != null) return;
          setState(() {
            _recipes = const [];
            _loadedId = null;
            _pendingId = null;
            _error = null;
          });
        });
      }
      return RefreshIndicator(
        onRefresh: _reload,
        child: GroupJoinPane(
          onJoined: _reload,
          message:
              'Create a household group or join with an invite code to open this cookbook.',
        ),
      );
    }

    if (_loadedId != group.id) {
      if (_pendingId != group.id) {
        final id = group.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (context.read<AuthSession>().membership?.id != id) return;
          if (_loadedId == id || _pendingId == id) return;
          _load(id);
        });
      }
      if (_error != null && _recipes.isEmpty) {
        final msg = _error is ApiException
            ? (_error! as ApiException).message
            : _error.toString();
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(msg, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(onPressed: _reload, child: const Text('Retry')),
              ],
            ),
          ),
        );
      }
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _recipes.isEmpty) {
      final msg = _error is ApiException
          ? (_error! as ApiException).message
          : _error.toString();
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(msg, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _reload, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _create(group),
        icon: const Icon(Icons.add),
        label: const Text('Add recipe'),
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: _recipes.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  const SizedBox(height: 48),
                  Center(
                    child: Text(
                      'No cookbook recipes for ${group.name} yet.\n'
                      'Add house favorites — no creator role needed.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              )
            : ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 88),
                itemCount: _recipes.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final recipe = _recipes[index];
                  return ListTile(
                    leading: RemoteThumb(
                      url: recipe.imageUrl,
                      size: 48,
                    ),
                    title: Text(recipe.title),
                    subtitle: Text(
                      '${recipe.servings} servings · ${recipe.difficulty}',
                    ),
                    onTap: () => _open(recipe, groupId: group.id),
                  );
                },
              ),
      ),
    );
  }
}
