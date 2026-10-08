import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pantrio_mobile/core/widgets/pick_recipe_image.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_group.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:provider/provider.dart';

class RecipeDetailPage extends StatefulWidget {
  const RecipeDetailPage({
    super.key,
    required this.slug,
    this.initialServings,
    this.pantryGroupId,
    this.useGroupCookbook = false,
  });

  final String slug;
  /// When opened from a plan, show ingredients scaled to this.
  final int? initialServings;
  /// When set, inInventory flags + cook use this InventoryGroup pantry.
  final String? pantryGroupId;
  /// Load via /groups/me/recipes/:slug (group cookbook).
  final bool useGroupCookbook;

  @override
  State<RecipeDetailPage> createState() => _RecipeDetailPageState();
}

class _RecipeDetailPageState extends State<RecipeDetailPage> {
  static const _profileCodes = {
    'energy_kcal',
    'protein',
    'carb',
    'fat',
    'fiber',
    'sugar',
  };

  late Future<RecipeDetail> _future;
  RecipeDetail? _recipe;
  int _viewServings = 1;
  String? _pantryGroupId;
  bool _cooking = false;
  String? _openNutrientCode;

  List<NutrientAmount> _profileNutrients(List<NutrientAmount> rows) {
    return rows.where((row) => _profileCodes.contains(row.code)).toList();
  }

  String _formatNutrient(num amount) {
    final value = amount.toDouble();
    if (value >= 100) return value.round().toString();
    if (value >= 10) return value.toStringAsFixed(1);
    return value.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  }

  @override
  void initState() {
    super.initState();
    _pantryGroupId = widget.pantryGroupId;
    _future = _load();
  }

  Future<RecipeDetail> _load() async {
    final api = context.read<AuthSession>().api;
    final recipe = widget.useGroupCookbook
        ? await api.getGroupCookbookRecipe(widget.slug)
        : await api.getRecipeBySlug(
            widget.slug,
            groupId: _pantryGroupId,
          );
    if (!mounted) return recipe;
    setState(() {
      _recipe = recipe;
      _viewServings = widget.initialServings ?? recipe.servings;
      if (_viewServings < 1) _viewServings = 1;
    });
    return recipe;
  }

  Future<void> _refresh() async {
    setState(() {
      _future = _load();
    });
    await _future;
  }

  double get _scale {
    final base = _recipe?.servings ?? 1;
    return _viewServings / (base < 1 ? 1 : base);
  }

  String _fmtQty(num value) {
    final scaled = value * _scale;
    if (scaled == scaled.roundToDouble()) {
      return scaled.round().toString();
    }
    return scaled.toStringAsFixed(scaled >= 10 ? 1 : 2);
  }

  Future<void> _toggleSave(RecipeDetail recipe) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    try {
      if (recipe.saved == true) {
        await api.unsaveRecipe(recipe.id);
        messenger.showSnackBar(
          const SnackBar(content: Text('Removed from saved')),
        );
      } else {
        await api.saveRecipe(recipe.id);
        messenger.showSnackBar(const SnackBar(content: Text('Saved')));
      }
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _share(RecipeDetail recipe) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final apiUri = Uri.parse(
      api.baseUrl.endsWith('/')
          ? api.baseUrl.substring(0, api.baseUrl.length - 1)
          : api.baseUrl,
    );
    // Intent share copies the Web recipe URL (same host as API, port 4200).
    final link =
        '${apiUri.scheme}://${apiUri.host}:4200/recipes/${recipe.slug}';
    try {
      await Clipboard.setData(ClipboardData(text: link));
      final result = await api.shareRecipe(recipe.id, channel: 'copy');
      if (!mounted) return;
      setState(() {
        _recipe = recipe.copyWith(shareCount: result.shareCount);
      });
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            result.rateLimited
                ? 'Link copied · share rate-limited'
                : 'Link copied · ${result.shareCount} shares',
          ),
        ),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _plan(RecipeDetail recipe) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final servings = await showDialog<int>(
      context: context,
      builder: (ctx) => _ServingsDialog(initialServings: _viewServings),
    );
    if (servings == null || !mounted) return;
    try {
      await api.planRecipe(recipeId: recipe.id, servings: servings);
      setState(() => _viewServings = servings);
      messenger.showSnackBar(
        SnackBar(content: Text('Planned ${recipe.title} × $servings')),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _addToInventory(RecipeIngredient ingredient) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final scaledQty = ingredient.quantity * _scale;
    final qty = await showDialog<num>(
      context: context,
      builder: (ctx) => _QuantityDialog(
        foodName: ingredient.foodName,
        unit: ingredient.unit,
        initialQuantity: scaledQty,
      ),
    );
    if (qty == null || !mounted) return;
    try {
      await api.createInventoryItem(
        foodId: ingredient.foodId,
        quantity: qty,
        unit: ingredient.unit,
        groupId: _pantryGroupId,
      );
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Added ${ingredient.foodName} to '
            '${_pantryGroupId != null ? 'group' : 'personal'} inventory',
          ),
        ),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _pickPantryScope() async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    InventoryGroup? group;
    try {
      group = await api.getMyGroup();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
      return;
    }
    if (!mounted) return;
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Personal pantry'),
              selected: _pantryGroupId == null,
              onTap: () => Navigator.pop(ctx, 'personal'),
            ),
            ListTile(
              leading: const Icon(Icons.groups_outlined),
              title: Text(
                group == null
                    ? 'Group pantry (join a group first)'
                    : 'Group · ${group.name}',
              ),
              enabled: group != null,
              selected: _pantryGroupId != null,
              onTap: group == null ? null : () => Navigator.pop(ctx, group!.id),
            ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;
    setState(() {
      _pantryGroupId = choice == 'personal' ? null : choice;
    });
    await _refresh();
  }

  Future<void> _setGroupPhoto(RecipeDetail recipe) async {
    if (!widget.useGroupCookbook) return;
    final picked = await pickRecipeImage(context);
    if (picked == null) return;
    if (!mounted) return;
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    try {
      messenger.showSnackBar(const SnackBar(content: Text('Uploading photo…')));
      final url = await api.uploadImage(filePath: picked.path, folder: 'recipes');
      final updated = await api.updateGroupCookbookRecipe(
        recipe.id,
        imageUrl: url,
      );
      if (!mounted) return;
      setState(() => _recipe = updated);
      messenger.showSnackBar(const SnackBar(content: Text('Photo updated')));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _deleteGroupRecipe(RecipeDetail recipe) async {
    if (!widget.useGroupCookbook) return;
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete recipe?'),
        content: Text(
          'Remove “${recipe.title}” from the group cookbook? '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await api.deleteGroupCookbookRecipe(recipe.id);
      if (!mounted) return;
      messenger.showSnackBar(const SnackBar(content: Text('Recipe deleted')));
      nav.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _cook(RecipeDetail recipe) async {
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cook this recipe?'),
        content: Text(
          'Estimate-consume ingredients for $_viewServings servings from your '
          '${_pantryGroupId != null ? 'group' : 'personal'} pantry (FEFO).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cook'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    setState(() => _cooking = true);
    try {
      final session = await api.cookRecipe(
        recipeId: recipe.id,
        servings: _viewServings,
        groupId: _pantryGroupId,
      );
      final shortfalls = session.consumptions
          .where((c) => c.shortfallQuantity > 0)
          .length;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            shortfalls == 0
                ? 'Cooked · pantry updated'
                : 'Cooked · $shortfalls ingredient(s) short',
          ),
        ),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _cooking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.useGroupCookbook ? 'Cookbook recipe' : 'Recipe'),
        actions: [
          if (widget.useGroupCookbook && _recipe != null)
            IconButton(
              tooltip: 'Delete',
              onPressed: () => _deleteGroupRecipe(_recipe!),
              icon: const Icon(Icons.delete_outline),
            ),
          IconButton(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<RecipeDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done &&
              _recipe == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError && _recipe == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
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
          final recipe = _recipe ?? snapshot.data!;
          final saved = recipe.saved == true;
          final scaled = _viewServings != recipe.servings;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              if (recipe.imageUrl != null && recipe.imageUrl!.isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 10,
                    child: Image.network(
                      recipe.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => ColoredBox(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceVariant,
                        child: const Center(
                          child: Icon(Icons.restaurant_menu_outlined, size: 40),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (widget.useGroupCookbook) ...[
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _setGroupPhoto(recipe),
                      icon: const Icon(Icons.add_a_photo_outlined),
                      label: Text(
                        recipe.imageUrl == null || recipe.imageUrl!.isEmpty
                            ? 'Add photo'
                            : 'Change photo',
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _deleteGroupRecipe(recipe),
                      icon: Icon(
                        Icons.delete_outline,
                        color: Theme.of(context).colorScheme.error,
                      ),
                      label: Text(
                        'Delete',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              Text(
                recipe.title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              if (recipe.description != null &&
                  recipe.description!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(recipe.description!),
              ],
              const SizedBox(height: 8),
              Text(
                'Base ${recipe.servings} servings · ${recipe.difficulty}'
                '${recipe.prepTimeMin != null ? ' · prep ${recipe.prepTimeMin}m' : ''}'
                '${recipe.cookTimeMin != null ? ' · cook ${recipe.cookTimeMin}m' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(
                    'Servings',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: _viewServings > 1
                        ? () => setState(() => _viewServings -= 1)
                        : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text(
                    '$_viewServings',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  IconButton(
                    onPressed: () => setState(() => _viewServings += 1),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
              if (scaled)
                Text(
                  'Quantities scaled from base ${recipe.servings} → $_viewServings',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: ActionChip(
                  avatar: Icon(
                    _pantryGroupId != null
                        ? Icons.groups_outlined
                        : Icons.person_outline,
                  ),
                  label: Text(
                    _pantryGroupId != null
                        ? 'Pantry: Group'
                        : 'Pantry: Personal',
                  ),
                  onPressed: _pickPantryScope,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.tonalIcon(
                    onPressed: () => _toggleSave(recipe),
                    icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
                    label: Text(saved ? 'Saved' : 'Save'),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: () => _share(recipe),
                    icon: const Icon(Icons.share_outlined),
                    label: Text('Share (${recipe.shareCount})'),
                  ),
                  FilledButton.icon(
                    onPressed: () => _plan(recipe),
                    icon: const Icon(Icons.event_note),
                    label: Text('Plan × $_viewServings'),
                  ),
                  FilledButton.icon(
                    onPressed: _cooking ? null : () => _cook(recipe),
                    icon: _cooking
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.soup_kitchen_outlined),
                    label: Text('Cook × $_viewServings'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              if (recipe.nutrition != null) ...[
                Text(
                  'Nutrition (per serving)',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (!recipe.nutrition!.complete)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Estimated — some ingredients lack nutrient data',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                const SizedBox(height: 8),
                ..._profileNutrients(recipe.nutrition!.perServing).map((item) {
                  final open = _openNutrientCode == item.code;
                  final hasBreakdown = item.contributions.isNotEmpty;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(item.nameVi),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${_formatNutrient(item.amount)} ${item.unit}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (hasBreakdown)
                              Icon(
                                open
                                    ? Icons.expand_less
                                    : Icons.expand_more,
                                size: 20,
                              ),
                          ],
                        ),
                        onTap: hasBreakdown
                            ? () => setState(() {
                                  _openNutrientCode =
                                      open ? null : item.code;
                                })
                            : null,
                      ),
                      if (open && hasBreakdown)
                        Padding(
                          padding: const EdgeInsets.only(
                            left: 8,
                            bottom: 8,
                          ),
                          child: Column(
                            children: item.contributions
                                .map(
                                  (c) => Padding(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 2,
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            c.foodName,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall,
                                          ),
                                        ),
                                        Text(
                                          '${_formatNutrient(c.amount)} ${item.unit}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w600,
                                              ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                    ],
                  );
                }),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Tap a nutrient to see each ingredient contribution per serving.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text(
                'Ingredients ($_viewServings servings)',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ...recipe.ingredients.map((ing) {
                final inInv = ing.inInventory == true;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: RemoteThumb(
                    url: ing.foodImageUrl,
                    size: 44,
                    icon: Icons.egg_outlined,
                  ),
                  title: Text(ing.foodName),
                  subtitle: Text(
                    '${_fmtQty(ing.quantity)} ${ing.unit}'
                    '${ing.optional ? ' · optional' : ''}'
                    '${inInv ? ' · in pantry' : ''}',
                  ),
                  trailing: IconButton(
                    tooltip: 'Add to pantry',
                    onPressed: () => _addToInventory(ing),
                    icon: Icon(
                      inInv ? Icons.kitchen : Icons.add_box_outlined,
                      color: inInv
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                  ),
                );
              }),
              const SizedBox(height: 16),
              Text(
                'Steps',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (recipe.steps.isNotEmpty)
                ...recipe.steps.map((step) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 14,
                          child: Text(
                            '${step.sortOrder + 1}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(step.body),
                              if (step.imageUrl != null &&
                                  step.imageUrl!.trim().isNotEmpty) ...[
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: AspectRatio(
                                    aspectRatio: 16 / 9,
                                    child: Image.network(
                                      step.imageUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => ColoredBox(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .surfaceVariant,
                                        child: const Center(
                                          child: Icon(Icons.broken_image_outlined),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                })
              else
                Text(
                  recipe.instructions.isEmpty
                      ? 'No steps yet.'
                      : recipe.instructions,
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ServingsDialog extends StatefulWidget {
  const _ServingsDialog({required this.initialServings});

  final int initialServings;

  @override
  State<_ServingsDialog> createState() => _ServingsDialogState();
}

class _ServingsDialogState extends State<_ServingsDialog> {
  late final TextEditingController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: '${widget.initialServings}');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final servings = int.tryParse(_controller.text.trim());
    if (servings == null || servings < 1) {
      setState(() => _error = 'Enter servings ≥ 1');
      return;
    }
    Navigator.pop(context, servings);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Plan recipe'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Servings',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          child: const Text('Plan'),
        ),
      ],
    );
  }
}

class _QuantityDialog extends StatefulWidget {
  const _QuantityDialog({
    required this.foodName,
    required this.unit,
    required this.initialQuantity,
  });

  final String foodName;
  final String unit;
  final num initialQuantity;

  @override
  State<_QuantityDialog> createState() => _QuantityDialogState();
}

class _QuantityDialogState extends State<_QuantityDialog> {
  late final TextEditingController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    final q = widget.initialQuantity;
    final text = q == q.roundToDouble()
        ? q.round().toString()
        : q.toStringAsFixed(q >= 10 ? 1 : 2);
    _controller = TextEditingController(text: text);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final qty = num.tryParse(_controller.text.trim());
    if (qty == null || qty < 0) {
      setState(() => _error = 'Enter a valid quantity');
      return;
    }
    Navigator.pop(context, qty);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Add ${widget.foodName}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Quantity (${widget.unit})',
              border: const OutlineInputBorder(),
            ),
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          child: const Text('Add'),
        ),
      ],
    );
  }
}
