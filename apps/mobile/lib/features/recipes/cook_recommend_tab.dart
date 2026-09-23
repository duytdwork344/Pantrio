import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/cooking.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/groups/group_scope_widgets.dart';
import 'package:pantrio_mobile/features/recipes/recipe_detail_page.dart';
import 'package:provider/provider.dart';

/// Recommendations from personal or group pantry.
class CookRecommendTab extends StatefulWidget {
  const CookRecommendTab({super.key});

  @override
  State<CookRecommendTab> createState() => _CookRecommendTabState();
}

class _CookRecommendTabState extends State<CookRecommendTab> {
  int _scope = 0;
  InventoryGroup? _group;
  bool _groupLoading = true;
  late Future<List<RecipeRecommendation>> _future;

  @override
  void initState() {
    super.initState();
    _future = _loadRecs();
    _reloadGroup();
  }

  String? get _activeGroupId => _scope == 1 ? _group?.id : null;

  Future<List<RecipeRecommendation>> _loadRecs() {
    return context.read<AuthSession>().api.getRecipeRecommendations(
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
        await _refresh();
      }
    } on ApiException catch (_) {
      if (!mounted) return;
      setState(() {
        _group = null;
        _groupLoading = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _loadRecs();
    });
    await _future;
  }

  Future<void> _onScopeChanged(int value) async {
    setState(() => _scope = value);
    if (value == 1) {
      await _reloadGroup();
    } else {
      await _refresh();
    }
  }

  Future<void> _open(RecipeRecommendation row) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecipeDetailPage(
          slug: row.recipe.slug,
          pantryGroupId: _activeGroupId,
        ),
      ),
    );
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final inGroup = _group != null;

    return Column(
      children: [
        ScopeSegmentBar(index: _scope, onChanged: _onScopeChanged),
        if (_scope == 1 && _groupLoading)
          const LinearProgressIndicator(minHeight: 2),
        if (_scope == 1 && !_groupLoading && inGroup)
          GroupHeaderBar(group: _group!, onChanged: _reloadGroup),
        Expanded(
          child: _scope == 1 && !_groupLoading && !inGroup
              ? RefreshIndicator(
                  onRefresh: _reloadGroup,
                  child: GroupJoinPane(onJoined: _reloadGroup),
                )
              : FutureBuilder<List<RecipeRecommendation>>(
                  future: _future,
                  builder: (context, snapshot) {
                    if (!snapshot.hasData && !snapshot.hasError) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError && !snapshot.hasData) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                snapshot.error.toString(),
                                textAlign: TextAlign.center,
                              ),
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
                    final rows = snapshot.data ?? const <RecipeRecommendation>[];
                    if (rows.isEmpty) {
                      return RefreshIndicator(
                        onRefresh: _refresh,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(24),
                          children: const [
                            SizedBox(height: 48),
                            Text(
                              'No recipes to recommend yet.\nAdd pantry stock, then pull to refresh.',
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      );
                    }
                    final label = _scope == 0 ? 'Personal' : 'Group';
                    return RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: rows.length + 1,
                        separatorBuilder: (_, __) => const SizedBox(height: 4),
                        itemBuilder: (context, index) {
                          if (index == 0) {
                            final can = rows.where((r) => r.canCook).length;
                            return Padding(
                              padding: const EdgeInsets.only(top: 4, bottom: 4),
                              child: Text(
                                '$label pantry · $can can cook / ${rows.length} recipes',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            );
                          }
                          final row = rows[index - 1];
                          final missingPreview = row.missing
                              .take(2)
                              .map((m) => m.foodName)
                              .join(', ');
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: RemoteThumb(
                              url: row.recipe.imageUrl,
                              size: 52,
                              icon: row.canCook
                                  ? Icons.check_circle_outline
                                  : Icons.restaurant_menu_outlined,
                            ),
                            title: Text(row.recipe.title),
                            subtitle: Text(
                              row.canCook
                                  ? 'Ready · ${row.matchedCount}/${row.requiredCount} ingredients'
                                  : 'Missing ${row.missingCount}'
                                      '${missingPreview.isEmpty ? '' : ' · $missingPreview'}'
                                      '${row.missing.length > 2 ? '…' : ''}',
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => _open(row),
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
