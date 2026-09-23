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

class _GroupCookbookTabState extends State<GroupCookbookTab> {
  late Future<({InventoryGroup? group, List<RecipeSummary> recipes})> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<({InventoryGroup? group, List<RecipeSummary> recipes})> _load() async {
    final api = context.read<AuthSession>().api;
    final group = await api.getMyGroup();
    if (group == null) {
      return (group: null, recipes: const <RecipeSummary>[]);
    }
    final recipes = await api.getGroupCookbookRecipes();
    return (group: group, recipes: recipes);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
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
    if (mounted) await _refresh();
  }

  Future<void> _create(InventoryGroup group) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateGroupRecipePage(groupName: group.name),
      ),
    );
    if (created == true && mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<({InventoryGroup? group, List<RecipeSummary> recipes})>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          final msg = snapshot.error is ApiException
              ? (snapshot.error! as ApiException).message
              : snapshot.error.toString();
          return Center(child: Text(msg));
        }

        final data = snapshot.data!;
        final group = data.group;
        if (group == null) {
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
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

        final recipes = data.recipes;
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _create(group),
            icon: const Icon(Icons.add),
            label: const Text('Add recipe'),
          ),
          body: RefreshIndicator(
            onRefresh: _refresh,
            child: recipes.isEmpty
                ? ListView(
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
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 88),
                    itemCount: recipes.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final recipe = recipes[index];
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
      },
    );
  }
}
