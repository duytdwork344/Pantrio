import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:provider/provider.dart';

class _DraftIngredient {
  FoodItem? food;
  final quantity = TextEditingController(text: '1');
  String unit = 'g';
}

/// Minimal create form for group cookbook (requirements 4.2c).
class CreateGroupRecipePage extends StatefulWidget {
  const CreateGroupRecipePage({super.key, required this.groupName});

  final String groupName;

  @override
  State<CreateGroupRecipePage> createState() => _CreateGroupRecipePageState();
}

class _CreateGroupRecipePageState extends State<CreateGroupRecipePage> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _instructions = TextEditingController();
  final _foodQuery = TextEditingController();
  final _ingredients = <_DraftIngredient>[_DraftIngredient()];
  bool _saving = false;
  List<FoodItem> _foodHits = const [];

  static const _units = ['g', 'kg', 'ml', 'l', 'pcs'];

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _instructions.dispose();
    _foodQuery.dispose();
    for (final row in _ingredients) {
      row.quantity.dispose();
    }
    super.dispose();
  }

  Future<void> _searchFoods(String q) async {
    if (q.trim().length < 2) {
      setState(() => _foodHits = const []);
      return;
    }
    try {
      final hits = await context.read<AuthSession>().api.searchFoods(q: q);
      if (mounted) setState(() => _foodHits = hits);
    } on ApiException {
      if (mounted) setState(() => _foodHits = const []);
    }
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final instructions = _instructions.text.trim();
    if (title.length < 2 || instructions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and instructions are required')),
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
      });
    }

    setState(() => _saving = true);
    try {
      await context.read<AuthSession>().api.createGroupCookbookRecipe(
            title: title,
            instructions: instructions,
            description: _description.text.trim().isEmpty
                ? null
                : _description.text.trim(),
            ingredients: ingredients,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Cookbook · ${widget.groupName}'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
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
      body: ListView(
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
          TextField(
            controller: _instructions,
            minLines: 4,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Instructions',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),
          Text('Ingredients', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(
            controller: _foodQuery,
            decoration: const InputDecoration(
              labelText: 'Search food to add',
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
                subtitle: Text('${food.baseUnit} · ${food.visibility}'),
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
                      empty.unit = food.baseUnit;
                    } else {
                      final row = _DraftIngredient()
                        ..food = food
                        ..unit = food.baseUnit;
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
                    flex: 3,
                    child: Text(
                      _ingredients[i].food?.name ?? 'Pick a food above',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
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
                    width: 88,
                    child: DropdownButtonFormField<String>(
                      value: _units.contains(_ingredients[i].unit)
                          ? _ingredients[i].unit
                          : 'g',
                      decoration: const InputDecoration(
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                      items: _units
                          .map(
                            (u) => DropdownMenuItem(value: u, child: Text(u)),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) {
                          setState(() => _ingredients[i].unit = v);
                        }
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
