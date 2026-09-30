import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/cooking.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:provider/provider.dart';

String formatCookedAt(String iso) {
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(dt.day)}/${two(dt.month)}/${dt.year} ${two(dt.hour)}:${two(dt.minute)}';
}

/// Past cooks for the current user, with undo (restores pantry and deletes the session).
class CookingSessionsPage extends StatefulWidget {
  const CookingSessionsPage({super.key});

  @override
  State<CookingSessionsPage> createState() => _CookingSessionsPageState();
}

class _CookingSessionsPageState extends State<CookingSessionsPage> {
  List<CookingSession> _sessions = const [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  Future<void> _reload() async {
    final api = context.read<AuthSession>().api;
    setState(() {
      _error = null;
      if (_sessions.isEmpty) _loading = true;
    });
    try {
      final sessions = await api.getCookingSessions();
      if (!mounted) return;
      setState(() {
        _sessions = sessions;
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

  Future<void> _undo(CookingSession session) async {
    final title = session.recipe?.title ?? 'this cook';
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Undo this cook?'),
        content: Text(
          'Returns the estimated ingredients for $title back to the pantry and removes the session.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Undo'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await api.undoCookingSession(session.id);
      messenger.showSnackBar(
        const SnackBar(content: Text('Cook undone · pantry restored')),
      );
      await _reload();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cooking sessions')),
      body: _loading && _sessions.isEmpty && _error == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _sessions.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error is ApiException
                              ? (_error! as ApiException).message
                              : _error.toString(),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _reload, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _reload,
                  child: _sessions.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 80),
                            Center(
                              child: Text(
                                'No cooking sessions yet.\nCook a recipe and it will show up here.',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                          itemCount: _sessions.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 4),
                          itemBuilder: (context, index) {
                            final session = _sessions[index];
                            final short = session.consumptions
                                .where((line) => line.shortfallQuantity > 0)
                                .length;
                            return ListTile(
                              leading: RemoteThumb(
                                url: session.recipe?.imageUrl,
                                size: 48,
                                icon: Icons.soup_kitchen_outlined,
                              ),
                              title: Text(session.recipe?.title ?? 'Recipe'),
                              subtitle: Text(
                                '${formatCookedAt(session.cookedAt)} · ${session.servings} servings'
                                '${short > 0 ? ' · $short short' : ''}',
                              ),
                              trailing: IconButton(
                                tooltip: 'Undo',
                                onPressed: () => _undo(session),
                                icon: const Icon(Icons.undo),
                              ),
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => CookingSessionDetailPage(
                                      sessionId: session.id,
                                    ),
                                  ),
                                );
                                if (mounted) await _reload();
                              },
                            );
                          },
                        ),
                ),
    );
  }
}

class CookingSessionDetailPage extends StatefulWidget {
  const CookingSessionDetailPage({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<CookingSessionDetailPage> createState() =>
      _CookingSessionDetailPageState();
}

class _CookingSessionDetailPageState extends State<CookingSessionDetailPage> {
  CookingSession? _session;
  bool _loading = true;
  Object? _error;
  bool _undoing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final session =
          await context.read<AuthSession>().api.getCookingSession(widget.sessionId);
      if (!mounted) return;
      setState(() {
        _session = session;
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

  Future<void> _undo(CookingSession session) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Undo this cook?'),
        content: const Text(
          'Estimated ingredients go back to the pantry. This session is removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Undo'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    setState(() => _undoing = true);
    try {
      await api.undoCookingSession(session.id);
      messenger.showSnackBar(
        const SnackBar(content: Text('Cook undone · pantry restored')),
      );
      nav.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _undoing = false);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    return Scaffold(
      appBar: AppBar(
        title: Text(session?.recipe?.title ?? 'Cooking session'),
        actions: [
          if (session != null)
            TextButton(
              onPressed: _undoing ? null : () => _undo(session),
              child: const Text('Undo'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || session == null
              ? Center(
                  child: Text(
                    _error is ApiException
                        ? (_error! as ApiException).message
                        : (_error?.toString() ?? 'Not found'),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      '${formatCookedAt(session.cookedAt)} · ${session.servings} servings',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (session.notes != null && session.notes!.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(session.notes!),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      'Ingredients used',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    if (session.consumptions.isEmpty)
                      const Text('No consumption lines recorded.')
                    else
                      ...session.consumptions.map((line) {
                        final short = line.shortfallQuantity > 0;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(line.foodName),
                          subtitle: Text(
                            'Used ${line.consumedQuantity} ${line.consumedUnit}'
                            ' of ${line.neededQuantity} ${line.neededUnit}'
                            '${short ? ' · short ${line.shortfallQuantity} ${line.neededUnit}' : ''}',
                          ),
                        );
                      }),
                  ],
                ),
    );
  }
}
