import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:provider/provider.dart';

class RecipeDetailPage extends StatefulWidget {
  const RecipeDetailPage({
    super.key,
    required this.slug,
    this.initialServings,
  });

  final String slug;
  /// When opened from a plan, show ingredients scaled to this.
  final int? initialServings;

  @override
  State<RecipeDetailPage> createState() => _RecipeDetailPageState();
}

class _RecipeDetailPageState extends State<RecipeDetailPage> {
  late Future<RecipeDetail> _future;
  RecipeDetail? _recipe;
  int _viewServings = 1;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<RecipeDetail> _load() async {
    final recipe =
        await context.read<AuthSession>().api.getRecipeBySlug(widget.slug);
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
      );
      messenger.showSnackBar(
        SnackBar(content: Text('Added ${ingredient.foodName} to inventory')),
      );
      await _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe'),
        actions: [
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
              Row(
                children: [
                  FilledButton.tonalIcon(
                    onPressed: () => _toggleSave(recipe),
                    icon: Icon(saved ? Icons.bookmark : Icons.bookmark_border),
                    label: Text(saved ? 'Saved' : 'Save'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () => _plan(recipe),
                    icon: const Icon(Icons.event_note),
                    label: Text('Plan × $_viewServings'),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                'Ingredients ($_viewServings servings)',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ...recipe.ingredients.map((ing) {
                final inInv = ing.inInventory == true;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(ing.foodName),
                  subtitle: Text(
                    '${_fmtQty(ing.quantity)} ${ing.unit}'
                    '${ing.optional ? ' · optional' : ''}'
                    '${inInv ? ' · in inventory' : ''}',
                  ),
                  trailing: IconButton(
                    tooltip: 'Add to inventory',
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
                'Instructions',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(recipe.instructions),
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
