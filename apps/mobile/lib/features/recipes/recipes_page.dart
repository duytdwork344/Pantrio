import 'dart:async';
import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/recipes/cook_recommend_tab.dart';
import 'package:pantrio_mobile/features/recipes/group_cookbook_tab.dart';
import 'package:pantrio_mobile/features/recipes/recipe_detail_page.dart';
import 'package:pantrio_mobile/features/recipes/studio_recipes_tab.dart';
import 'package:pantrio_mobile/features/shopping/shopping_detail_page.dart';
import 'package:provider/provider.dart';

class RecipesPage extends StatefulWidget {
  const RecipesPage({super.key});

  @override
  State<RecipesPage> createState() => _RecipesPageState();
}

class _RecipesPageState extends State<RecipesPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late final bool _showStudio;
  late Future<List<RecipeSummary>> _discover;
  late Future<List<SavedRecipe>> _saved;
  late Future<List<PlannedRecipe>> _planned;

  void _reloadAll() {
    final api = context.read<AuthSession>().api;
    setState(() {
      _discover = api.getRecipes();
      _saved = api.getSavedRecipes();
      _planned = api.getPlannedRecipes();
    });
  }

  @override
  void initState() {
    super.initState();
    _showStudio = context
            .read<AuthSession>()
            .user
            ?.permissions
            .contains('recipe:create') ??
        false;
    _tabs = TabController(length: _showStudio ? 6 : 5, vsync: this);
    final api = context.read<AuthSession>().api;
    _discover = api.getRecipes();
    _saved = api.getSavedRecipes();
    _planned = api.getPlannedRecipes();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    _reloadAll();
    await Future.wait([_discover, _saved, _planned]);
  }

  Future<void> _openRecipe(
    RecipeSummary recipe, {
    int? servings,
  }) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecipeDetailPage(
          slug: recipe.slug,
          initialServings: servings,
        ),
      ),
    );
    if (mounted) await _refresh();
  }

  Future<void> _removePlanned(PlannedRecipe plan) async {
    try {
      await context.read<AuthSession>().api.removePlannedRecipe(plan.id);
      if (mounted) await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _shopFromPlanned(List<PlannedRecipe> plans) async {
    if (plans.isEmpty) return;
    final api = context.read<AuthSession>().api;
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final list = await api.createShoppingList(
        name: 'From planned (${plans.length})',
      );
      final detail = await api.generateShoppingFromPlanned(
        listId: list.id,
        plannedRecipeIds: plans.map((p) => p.id).toList(),
      );
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Shopping ready · ${detail.pendingCount} pending / ${detail.itemCount} items',
          ),
        ),
      );
      if (!mounted) return;
      await nav.push(
        MaterialPageRoute(
          builder: (_) => ShoppingDetailPage(listId: detail.id),
        ),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: [
            const Tab(text: 'Discover'),
            const Tab(text: 'Cook'),
            const Tab(text: 'Group'),
            const Tab(text: 'Saved'),
            const Tab(text: 'Planned'),
            if (_showStudio) const Tab(text: 'Studio'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _DiscoverTab(
                onOpen: (r) => _openRecipe(r),
              ),
              const CookRecommendTab(),
              const GroupCookbookTab(),
              _SavedTab(
                future: _saved,
                onRefresh: _refresh,
                onOpen: (r) => _openRecipe(r),
              ),
              _PlannedTab(
                future: _planned,
                onRefresh: _refresh,
                onOpen: (plan) => _openRecipe(
                  plan.recipe,
                  servings: plan.servings,
                ),
                onRemove: _removePlanned,
                onShop: _shopFromPlanned,
              ),
              if (_showStudio) const StudioRecipesTab(),
            ],
          ),
        ),
      ],
    );
  }
}

class _DiscoverTab extends StatefulWidget {
  const _DiscoverTab({
    required this.onOpen,
  });

  final Future<void> Function(RecipeSummary) onOpen;

  @override
  State<_DiscoverTab> createState() => _DiscoverTabState();
}

class _DiscoverTabState extends State<_DiscoverTab> {
  final _query = TextEditingController();
  late Future<List<RecipeSummary>> _future;
  bool _isSearching = false;
  Timer? _debounceTimer;
  int _searchVersion = 0;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<List<RecipeSummary>> _load() {
    final api = context.read<AuthSession>().api;
    final q = _query.text.trim();
    if (q.isEmpty) return api.getRecipes();
    return api.searchRecipes(q: q);
  }

  void _triggerSearch({bool unfocus = false}) {
    _debounceTimer?.cancel();
    if (unfocus) {
      FocusScope.of(context).unfocus();
    }
    final currentVersion = ++_searchVersion;
    final apiCall = _load();
    setState(() {
      _isSearching = true;
      _future = apiCall;
    });

    apiCall.whenComplete(() {
      if (mounted && currentVersion == _searchVersion) {
        setState(() => _isSearching = false);
      }
    });
  }

  void _onQueryChanged(String _) {
    setState(() {});
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      _triggerSearch(unfocus: false);
    });
  }

  Future<void> _refresh() async {
    _triggerSearch(unfocus: false);
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _query,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search recipes…',
              prefixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: () => _triggerSearch(unfocus: true),
              ),
              suffixIcon: _query.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _query.clear();
                        _triggerSearch(unfocus: false);
                      },
                    ),
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: _onQueryChanged,
            onSubmitted: (_) => _triggerSearch(unfocus: true),
          ),
        ),
        const SizedBox(height: 8),
        if (_isSearching)
          const LinearProgressIndicator(minHeight: 2)
        else
          const SizedBox(height: 2),
        Expanded(
          child: FutureBuilder<List<RecipeSummary>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting &&
                  !snapshot.hasData &&
                  !snapshot.hasError) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError && (!snapshot.hasData || (snapshot.data?.isEmpty ?? true))) {
                return _ErrorBody(
                  message: snapshot.error.toString(),
                  onRetry: _refresh,
                );
              }
              final recipes = snapshot.data ?? const <RecipeSummary>[];
              if (recipes.isEmpty && !_isSearching) {
                final q = _query.text.trim();
                return RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 80),
                      Center(
                        child: Text(
                          q.isEmpty
                              ? 'No public recipes yet.'
                              : 'No recipes found for "$q".',
                        ),
                      ),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: _refresh,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: recipes.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final recipe = recipes[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: RemoteThumb(
                        url: recipe.imageUrl,
                        size: 52,
                        icon: Icons.restaurant_menu_outlined,
                      ),
                      title: Text(recipe.title),
                      subtitle: Text(
                        '${recipe.servings} servings · ${recipe.difficulty}'
                        '${recipe.cookTimeMin != null ? ' · ${recipe.cookTimeMin} min cook' : ''}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => widget.onOpen(recipe),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SavedTab extends StatelessWidget {
  const _SavedTab({
    required this.future,
    required this.onRefresh,
    required this.onOpen,
  });

  final Future<List<SavedRecipe>> future;
  final Future<void> Function() onRefresh;
  final Future<void> Function(RecipeSummary) onOpen;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<SavedRecipe>>(
      future: future,
      builder: (context, snapshot) {
        // Initial load only — keep previous list visible while refreshing.
        if (!snapshot.hasData && !snapshot.hasError) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError && !snapshot.hasData) {
          return _ErrorBody(message: snapshot.error.toString(), onRetry: onRefresh);
        }
        final rows = snapshot.data ?? const <SavedRecipe>[];
        if (rows.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 80),
                Center(child: Text('No saved recipes.\nOpen a recipe and tap Save.')),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final row = rows[index];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: RemoteThumb(
                  url: row.recipe.imageUrl,
                  size: 52,
                  icon: Icons.bookmark_outline,
                ),
                title: Text(row.recipe.title),
                subtitle: Text('${row.recipe.servings} servings'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => onOpen(row.recipe),
              );
            },
          ),
        );
      },
    );
  }
}

class _PlannedTab extends StatelessWidget {
  const _PlannedTab({
    required this.future,
    required this.onRefresh,
    required this.onOpen,
    required this.onRemove,
    required this.onShop,
  });

  final Future<List<PlannedRecipe>> future;
  final Future<void> Function() onRefresh;
  final Future<void> Function(PlannedRecipe) onOpen;
  final Future<void> Function(PlannedRecipe) onRemove;
  final Future<void> Function(List<PlannedRecipe>) onShop;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PlannedRecipe>>(
      future: future,
      builder: (context, snapshot) {
        // Initial load only — keep previous list visible while refreshing.
        if (!snapshot.hasData && !snapshot.hasError) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError && !snapshot.hasData) {
          return _ErrorBody(message: snapshot.error.toString(), onRetry: onRefresh);
        }
        final rows = snapshot.data ?? const <PlannedRecipe>[];
        if (rows.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 80),
                Center(
                  child: Text(
                    'No planned recipes.\nPlan from a recipe detail, then tap Shop.',
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            itemCount: rows.length + 1,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: FilledButton.icon(
                    onPressed: () => onShop(rows),
                    icon: const Icon(Icons.shopping_cart_checkout),
                    label: Text('Shop from planned (${rows.length})'),
                  ),
                );
              }
              final row = rows[index - 1];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: RemoteThumb(
                  url: row.recipe.imageUrl,
                  size: 52,
                  icon: Icons.event_note_outlined,
                ),
                title: Text(row.recipe.title),
                subtitle: Text('${row.servings} servings planned'),
                trailing: IconButton(
                  tooltip: 'Remove plan',
                  onPressed: () => onRemove(row),
                  icon: const Icon(Icons.close),
                ),
                onTap: () => onOpen(row),
              );
            },
          ),
        );
      },
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

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
