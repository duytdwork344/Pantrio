import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
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
  InventoryGroup? _group;
  List<RecipeSummary> _recipes = const [];
  bool _loading = true;
  Object? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  Future<void> _reload() async {
    final api = context.read<AuthSession>().api;
    setState(() {
      _error = null;
      // Keep existing list visible while refreshing (don't blank the screen).
      if (_group == null && _recipes.isEmpty) {
        _loading = true;
      }
    });
    try {
      final group = await api.getMyGroup();
      final recipes = group == null
          ? const <RecipeSummary>[]
          : await api.getGroupCookbookRecipes();
      if (!mounted) return;
      setState(() {
        _group = group;
        _recipes = List<RecipeSummary>.from(recipes);
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
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

    if (_loading && _group == null && _recipes.isEmpty && _error == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _group == null && _recipes.isEmpty) {
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

    final group = _group;
    if (group == null) {
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 80),
            Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Join or create a household group first.\n'
                  'Open Inventory → Group tab to set one up.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
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
