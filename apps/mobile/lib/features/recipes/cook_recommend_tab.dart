import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/cooking.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:pantrio_mobile/features/groups/group_scope_widgets.dart';
import 'package:pantrio_mobile/features/recipes/cooking_sessions_page.dart';
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
  String? _loadedKey;
  late Future<List<RecipeRecommendation>> _future;

  @override
  void initState() {
    super.initState();
    _future = Future.value(const []);
  }

  String? _groupId(AuthSession session) =>
      _scope == 1 ? session.membership?.id : null;

  String _scopeKey(AuthSession session) {
    if (_scope == 0) return 'personal';
    if (!session.membershipReady) return 'pending';
    return 'group:${session.membership?.id ?? '-'}';
  }

  Future<void> _refresh() async {
    final session = context.read<AuthSession>();
    await session.reloadMembership();
    if (!mounted) return;
    final groupId = _groupId(session);
    setState(() {
      _loadedKey = _scopeKey(session);
      _future = session.api.getRecipeRecommendations(
        groupId: _scope == 1 ? groupId : null,
      );
    });
    await _future;
  }

  Future<void> _onScopeChanged(int value) async {
    setState(() => _scope = value);
    final session = context.read<AuthSession>();
    if (!session.membershipReady) {
      await session.reloadMembership();
    }
    if (!mounted) return;
    final groupId = _groupId(session);
    setState(() {
      _loadedKey = _scopeKey(session);
      _future = session.api.getRecipeRecommendations(
        groupId: _scope == 1 ? groupId : null,
      );
    });
  }

  Future<void> _open(RecipeRecommendation row) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecipeDetailPage(
          slug: row.recipe.slug,
          pantryGroupId: _scope == 1
              ? context.read<AuthSession>().membership?.id
              : null,
        ),
      ),
    );
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final group = session.membership;
    final key = _scopeKey(session);
    if (key != 'pending' && key != _loadedKey) {
      _loadedKey = key;
      _future = session.api.getRecipeRecommendations(
        groupId: _scope == 1 ? group?.id : null,
      );
    }
    final waiting = _scope == 1 && !session.membershipReady;
    final inGroup = group != null;

    return Column(
      children: [
        ScopeSegmentBar(index: _scope, onChanged: _onScopeChanged),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CookingSessionsPage(),
                ),
              );
            },
            icon: const Icon(Icons.history),
            label: const Text('Sessions'),
          ),
        ),
        if (waiting) const LinearProgressIndicator(minHeight: 2),
        if (_scope == 1 && !waiting && inGroup)
          GroupHeaderBar(group: group, onChanged: _refresh),
        Expanded(
          child: waiting
              ? const Center(child: CircularProgressIndicator())
              : _scope == 1 && !inGroup
              ? RefreshIndicator(
                  onRefresh: _refresh,
                  child: GroupJoinPane(onJoined: _refresh),
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
