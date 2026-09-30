import 'dart:io';

import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:pantrio_mobile/core/widgets/pick_recipe_image.dart';
import 'package:provider/provider.dart';

class _DraftIngredient {
  FoodItem? food;
  final quantity = TextEditingController(text: '1');
  String unit = 'g';
  bool optional = false;
}

class _DraftStep {
  final body = TextEditingController();
  String? imagePath;
  String? uploadedImageUrl;
}

/// Create or edit a catalog recipe (CREATOR / ADMIN). Same fields as web Studio.
class CatalogRecipeEditorPage extends StatefulWidget {
  const CatalogRecipeEditorPage({super.key, this.slug});

  final String? slug;

  @override
  State<CatalogRecipeEditorPage> createState() => _CatalogRecipeEditorPageState();
}

class _CatalogRecipeEditorPageState extends State<CatalogRecipeEditorPage> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _servings = TextEditingController(text: '2');
  final _prep = TextEditingController();
  final _cook = TextEditingController();
  final _foodQuery = TextEditingController();
  final _ingredients = <_DraftIngredient>[_DraftIngredient()];
  final _steps = <_DraftStep>[_DraftStep()];

  String? _recipeId;
  String _difficulty = 'EASY';
  String _visibility = 'PUBLIC';
  bool _loading = false;
  bool _saving = false;
  String? _imagePath;
  String? _uploadedImageUrl;
  List<FoodItem> _foodHits = const [];

  static const _units = ['g', 'kg', 'ml', 'l', 'pcs'];
  static const _difficulties = ['EASY', 'MEDIUM', 'HARD'];
  static const _visibilities = ['PUBLIC', 'UNLISTED', 'PRIVATE'];

  bool get _editing => widget.slug != null;

  @override
  void initState() {
    super.initState();
    if (_editing) {
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _servings.dispose();
    _prep.dispose();
    _cook.dispose();
    _foodQuery.dispose();
    for (final row in _ingredients) {
      row.quantity.dispose();
    }
    for (final step in _steps) {
      step.body.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final recipe =
          await context.read<AuthSession>().api.getRecipeBySlug(widget.slug!);
      if (!mounted) return;
      _apply(recipe);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      Navigator.of(context).pop();
    }
  }

  void _apply(RecipeDetail recipe) {
    _recipeId = recipe.id;
    _title.text = recipe.title;
    _description.text = recipe.description ?? '';
    _servings.text = '${recipe.servings}';
    _prep.text = recipe.prepTimeMin?.toString() ?? '';
    _cook.text = recipe.cookTimeMin?.toString() ?? '';
    _difficulty = recipe.difficulty;
    _visibility = recipe.visibility;
    _uploadedImageUrl = recipe.imageUrl;
    for (final row in _ingredients) {
      row.quantity.dispose();
    }
    _ingredients
      ..clear()
      ..addAll(
        recipe.ingredients.isEmpty
            ? [_DraftIngredient()]
            : recipe.ingredients.map((ing) {
                final row = _DraftIngredient()
                  ..food = FoodItem(
                    id: ing.foodId,
                    slug: ing.foodId,
                    name: ing.foodName,
                    baseUnit: ing.unit,
                    visibility: 'PUBLIC',
                    imageUrl: ing.foodImageUrl,
                  )
                  ..unit = _units.contains(ing.unit) ? ing.unit : 'g'
                  ..optional = ing.optional;
                row.quantity.text = '${ing.quantity}';
                return row;
              }),
      );
    for (final step in _steps) {
      step.body.dispose();
    }
    final steps = recipe.steps.isNotEmpty
        ? recipe.steps
        : recipe.instructions
            .split('\n')
            .map((line) => line.trim())
            .where((line) => line.isNotEmpty)
            .map((body) => RecipeStep(id: '', sortOrder: 0, body: body))
            .toList();
    _steps
      ..clear()
      ..addAll(
        steps.isEmpty
            ? [_DraftStep()]
            : steps.map((step) {
                final draft = _DraftStep()..uploadedImageUrl = step.imageUrl;
                draft.body.text = step.body;
                return draft;
              }),
      );
    setState(() => _loading = false);
  }

  Future<void> _searchFoods(String q) async {
    if (q.trim().length < 2) {
      setState(() => _foodHits = const []);
      return;
    }
    try {
      final hits = await context.read<AuthSession>().api.searchFoods(
            q: q,
            locale: 'vi',
          );
      if (mounted) setState(() => _foodHits = hits);
    } on ApiException {
      if (mounted) setState(() => _foodHits = const []);
    }
  }

  Future<String?> _upload(String path) {
    return context.read<AuthSession>().api.uploadImage(filePath: path);
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final servings = int.tryParse(_servings.text.trim());
    final stepBodies =
        _steps.map((s) => s.body.text.trim()).where((b) => b.isNotEmpty);
    if (title.length < 2 || stepBodies.isEmpty || servings == null || servings < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Title, servings, and at least one step are required'),
        ),
      );
      return;
    }

    final ingredients = <Map<String, dynamic>>[];
    for (final row in _ingredients) {
      final food = row.food;
      final qty = double.tryParse(row.quantity.text.trim());
      if (food == null || qty == null || qty < 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Each ingredient needs food + quantity')),
        );
        return;
      }
      ingredients.add({
        'foodId': food.id,
        'quantity': qty,
        'unit': row.unit,
        'optional': row.optional,
      });
    }

    setState(() => _saving = true);
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    try {
      String? imageUrl = _uploadedImageUrl;
      if (_imagePath != null) {
        imageUrl = await _upload(_imagePath!);
        _uploadedImageUrl = imageUrl;
        _imagePath = null;
      }
      final steps = <Map<String, dynamic>>[];
      for (final step in _steps) {
        final body = step.body.text.trim();
        if (body.isEmpty) continue;
        var image = step.uploadedImageUrl;
        if (step.imagePath != null) {
          image = await _upload(step.imagePath!);
          step
            ..uploadedImageUrl = image
            ..imagePath = null;
        }
        steps.add({
          'body': body,
          'sortOrder': steps.length,
          if (image != null && image.isNotEmpty) 'imageUrl': image,
        });
      }
      final prep = int.tryParse(_prep.text.trim());
      final cook = int.tryParse(_cook.text.trim());
      final description = _description.text.trim();
      if (_recipeId == null) {
        await api.createCatalogRecipe(
          title: title,
          description: description.isEmpty ? null : description,
          imageUrl: imageUrl,
          servings: servings,
          difficulty: _difficulty,
          visibility: _visibility,
          prepTimeMin: prep,
          cookTimeMin: cook,
          ingredients: ingredients,
          steps: steps,
        );
      } else {
        await api.updateCatalogRecipe(
          _recipeId!,
          title: title,
          description: description,
          imageUrl: imageUrl,
          servings: servings,
          difficulty: _difficulty,
          visibility: _visibility,
          prepTimeMin: prep,
          cookTimeMin: cook,
          ingredients: ingredients,
          steps: steps,
        );
      }
      if (!mounted) return;
      nav.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_editing ? 'Edit recipe' : 'New recipe'),
        actions: [
          TextButton(
            onPressed: (_saving || _loading) ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _description,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _servings,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Servings',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _difficulty,
                        decoration: const InputDecoration(
                          labelText: 'Difficulty',
                          border: OutlineInputBorder(),
                        ),
                        items: _difficulties
                            .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => _difficulty = v);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _visibility,
                  decoration: const InputDecoration(
                    labelText: 'Visibility',
                    border: OutlineInputBorder(),
                  ),
                  items: _visibilities
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _visibility = v);
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _prep,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Prep min',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _cook,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Cook min',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 72,
                        height: 72,
                        child: _imagePath != null
                            ? Image.file(File(_imagePath!), fit: BoxFit.cover)
                            : (_uploadedImageUrl != null &&
                                    _uploadedImageUrl!.isNotEmpty)
                                ? Image.network(_uploadedImageUrl!, fit: BoxFit.cover)
                                : ColoredBox(
                                    color: Theme.of(context).colorScheme.surfaceVariant,
                                    child: const Icon(Icons.image_outlined),
                                  ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton.icon(
                      onPressed: _saving
                          ? null
                          : () async {
                              final picked = await pickRecipeImage(context);
                              if (picked == null) return;
                              setState(() {
                                _imagePath = picked.path;
                              });
                            },
                      icon: const Icon(Icons.add_a_photo_outlined),
                      label: const Text('Cover photo'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text('Steps', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (var i = 0; i < _steps.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 14,
                          child: Text('${i + 1}', style: const TextStyle(fontSize: 12)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _steps[i].body,
                            minLines: 2,
                            maxLines: 5,
                            decoration: InputDecoration(
                              labelText: 'Step ${i + 1}',
                              border: const OutlineInputBorder(),
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: _steps.length <= 1
                              ? null
                              : () {
                                  setState(() {
                                    _steps[i].body.dispose();
                                    _steps.removeAt(i);
                                  });
                                },
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                      ],
                    ),
                  ),
                TextButton.icon(
                  onPressed: () => setState(() => _steps.add(_DraftStep())),
                  icon: const Icon(Icons.add),
                  label: const Text('Add step'),
                ),
                const SizedBox(height: 12),
                Text('Ingredients', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                TextField(
                  controller: _foodQuery,
                  decoration: const InputDecoration(
                    labelText: 'Search food',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: _searchFoods,
                ),
                if (_foodHits.isNotEmpty)
                  ..._foodHits.take(8).map(
                    (food) => ListTile(
                      dense: true,
                      title: Text(food.name),
                      subtitle: Text(food.baseUnit),
                      onTap: () {
                        setState(() {
                          _DraftIngredient? empty;
                          for (final row in _ingredients) {
                            if (row.food == null) {
                              empty = row;
                              break;
                            }
                          }
                          if (empty != null) {
                            empty.food = food;
                            empty.unit = _units.contains(food.baseUnit)
                                ? food.baseUnit
                                : 'g';
                          } else {
                            final row = _DraftIngredient()
                              ..food = food
                              ..unit = _units.contains(food.baseUnit)
                                  ? food.baseUnit
                                  : 'g';
                            _ingredients.add(row);
                          }
                          _foodHits = const [];
                          _foodQuery.clear();
                        });
                      },
                    ),
                  ),
                const SizedBox(height: 8),
                for (var i = 0; i < _ingredients.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _ingredients[i].food?.name ?? 'Pick a food above',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        SizedBox(
                          width: 72,
                          child: TextField(
                            controller: _ingredients[i].quantity,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: 'Qty',
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 80,
                          child: DropdownButtonFormField<String>(
                            value: _units.contains(_ingredients[i].unit)
                                ? _ingredients[i].unit
                                : 'g',
                            decoration: const InputDecoration(
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                            items: _units
                                .map((u) => DropdownMenuItem(value: u, child: Text(u)))
                                .toList(),
                            onChanged: (v) {
                              if (v != null) setState(() => _ingredients[i].unit = v);
                            },
                          ),
                        ),
                        IconButton(
                          onPressed: _ingredients.length <= 1
                              ? null
                              : () {
                                  setState(() {
                                    _ingredients[i].quantity.dispose();
                                    _ingredients.removeAt(i);
                                  });
                                },
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                      ],
                    ),
                  ),
                TextButton.icon(
                  onPressed: () => setState(() => _ingredients.add(_DraftIngredient())),
                  icon: const Icon(Icons.add),
                  label: const Text('Another ingredient'),
                ),
              ],
            ),
    );
  }
}
