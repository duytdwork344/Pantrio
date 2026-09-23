import 'dart:io';

import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/widgets/pick_recipe_image.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:provider/provider.dart';

class _DraftIngredient {
  FoodItem? food;
  final quantity = TextEditingController(text: '1');
  String unit = 'g';
}

class _DraftStep {
  final body = TextEditingController();
  String? imagePath;
  String? uploadedImageUrl;
}

/// Minimal create form for group cookbook (requirements 4.2c / 4.2e).
class CreateGroupRecipePage extends StatefulWidget {
  const CreateGroupRecipePage({super.key, required this.groupName});

  final String groupName;

  @override
  State<CreateGroupRecipePage> createState() => _CreateGroupRecipePageState();
}

class _CreateGroupRecipePageState extends State<CreateGroupRecipePage> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _foodQuery = TextEditingController();
  final _ingredients = <_DraftIngredient>[_DraftIngredient()];
  final _steps = <_DraftStep>[_DraftStep()];
  bool _saving = false;
  List<FoodItem> _foodHits = const [];
  String? _imagePath;
  String? _uploadedImageUrl;
  bool _uploadingImage = false;

  static const _units = ['g', 'kg', 'ml', 'l', 'pcs'];

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _foodQuery.dispose();
    for (final row in _ingredients) {
      row.quantity.dispose();
    }
    for (final step in _steps) {
      step.body.dispose();
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

  Future<void> _pickCoverImage() async {
    final picked = await pickRecipeImage(context);
    if (picked == null) return;
    setState(() {
      _imagePath = picked.path;
      _uploadedImageUrl = null;
    });
  }

  Future<void> _pickStepImage(int index) async {
    final picked = await pickRecipeImage(context);
    if (picked == null) return;
    setState(() {
      _steps[index].imagePath = picked.path;
      _steps[index].uploadedImageUrl = null;
    });
  }

  Future<String?> _uploadPath(String path, {String folder = 'recipes'}) async {
    final api = context.read<AuthSession>().api;
    return api.uploadImage(filePath: path, folder: folder);
  }

  Future<String?> _ensureCoverUploaded() async {
    if (_uploadedImageUrl != null) return _uploadedImageUrl;
    if (_imagePath == null) return null;
    final url = await _uploadPath(_imagePath!);
    if (mounted) setState(() => _uploadedImageUrl = url);
    return url;
  }

  Future<List<Map<String, dynamic>>> _buildStepsPayload() async {
    final out = <Map<String, dynamic>>[];
    for (var i = 0; i < _steps.length; i++) {
      final step = _steps[i];
      final body = step.body.text.trim();
      if (body.isEmpty) continue;
      String? imageUrl = step.uploadedImageUrl;
      if (imageUrl == null && step.imagePath != null) {
        imageUrl = await _uploadPath(step.imagePath!);
        step.uploadedImageUrl = imageUrl;
      }
      out.add({
        'body': body,
        'sortOrder': out.length,
        if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      });
    }
    return out;
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final stepBodies =
        _steps.map((s) => s.body.text.trim()).where((b) => b.isNotEmpty);
    if (title.length < 2 || stepBodies.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and at least one step are required')),
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

    setState(() {
      _saving = true;
      _uploadingImage = true;
    });
    final api = context.read<AuthSession>().api;
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    try {
      final imageUrl = await _ensureCoverUploaded();
      final steps = await _buildStepsPayload();
      await api.createGroupCookbookRecipe(
        title: title,
        description: _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        imageUrl: imageUrl,
        ingredients: ingredients,
        steps: steps,
      );
      if (!mounted) return;
      nav.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _uploadingImage = false;
        });
      }
    }
  }

  Widget _stepThumb(_DraftStep step) {
    if (step.imagePath != null) {
      return Image.file(File(step.imagePath!), fit: BoxFit.cover);
    }
    return ColoredBox(
      color: Theme.of(context).colorScheme.surfaceVariant,
      child: const Icon(Icons.add_a_photo_outlined, size: 20),
    );
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
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 72,
                  height: 72,
                  child: _imagePath != null
                      ? Image.file(File(_imagePath!), fit: BoxFit.cover)
                      : ColoredBox(
                          color: Theme.of(context).colorScheme.surfaceVariant,
                          child: const Icon(Icons.image_outlined),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OutlinedButton.icon(
                      onPressed:
                          (_saving || _uploadingImage) ? null : _pickCoverImage,
                      icon: const Icon(Icons.add_a_photo_outlined),
                      label: Text(
                        _imagePath == null ? 'Add cover photo' : 'Change cover',
                      ),
                    ),
                    Text(
                      'Optional cover for the dish. Step photos go below.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            decoration: const InputDecoration(
              labelText: 'Description (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),
          Text('Steps', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'One card per step. Photo optional (uploaded via Media).',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < _steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        child: Text('${i + 1}', style: const TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: (_saving || _uploadingImage)
                            ? null
                            : () => _pickStepImage(i),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: 56,
                            height: 56,
                            child: _stepThumb(_steps[i]),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _steps[i].body,
                      minLines: 2,
                      maxLines: 5,
                      decoration: InputDecoration(
                        labelText: 'Step ${i + 1}',
                        border: const OutlineInputBorder(),
                        alignLabelWithHint: true,
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
