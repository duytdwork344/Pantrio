import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/recipes/catalog_recipe_editor_page.dart';
import 'package:provider/provider.dart';

/// Catalog recipes the signed-in CREATOR / ADMIN can write.
class StudioRecipesTab extends StatefulWidget {
  const StudioRecipesTab({super.key});

  @override
  State<StudioRecipesTab> createState() => _StudioRecipesTabState();
}

class _StudioRecipesTabState extends State<StudioRecipesTab>
    with AutomaticKeepAliveClientMixin {
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
      if (_recipes.isEmpty) _loading = true;
    });
    try {
      final recipes = await api.getMyRecipes();
      if (!mounted) return;
      setState(() {
        _recipes = recipes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _openEditor({String? slug}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CatalogRecipeEditorPage(slug: slug),
      ),
    );
    if (saved == true && mounted) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (_loading && _recipes.isEmpty && _error == null) {
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
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('New recipe'),
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: _recipes.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 80),
                  Center(
                    child: Text(
                      'No catalog recipes yet.\nRecipes you publish here show on Discover when public.',
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
                    leading: RemoteThumb(url: recipe.imageUrl, size: 48),
                    title: Text(recipe.title),
                    subtitle: Text(
                      '${recipe.servings} servings · ${recipe.difficulty}',
                    ),
                    trailing: const Icon(Icons.edit_outlined),
                    onTap: () => _openEditor(slug: recipe.slug),
                  );
                },
              ),
      ),
    );
  }
}
