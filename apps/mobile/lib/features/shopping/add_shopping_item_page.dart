import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:pantrio_mobile/core/widgets/remote_thumb.dart';
import 'package:provider/provider.dart';

const _units = ['g', 'kg', 'ml', 'l', 'pcs'];

class AddShoppingItemPage extends StatefulWidget {
  const AddShoppingItemPage({super.key, required this.listId});

  final String listId;

  @override
  State<AddShoppingItemPage> createState() => _AddShoppingItemPageState();
}

class _AddShoppingItemPageState extends State<AddShoppingItemPage> {
  final _search = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  Timer? _debounce;
  List<FoodItem> _results = const [];
  FoodItem? _selected;
  String _unit = 'g';
  bool _searching = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _quantity.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _runSearch(value);
    });
  }

  Future<void> _runSearch(String q) async {
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final foods = await context.read<AuthSession>().api.searchFoods(q: q);
      if (!mounted) return;
      setState(() {
        _results = foods;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _searching = false;
      });
    }
  }

  Future<void> _save() async {
    final food = _selected;
    if (food == null) {
      setState(() => _error = 'Select a food from search');
      return;
    }
    final qty = num.tryParse(_quantity.text.trim());
    if (qty == null || qty < 0) {
      setState(() => _error = 'Enter a valid quantity');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<AuthSession>().api.addShoppingItem(
            listId: widget.listId,
            foodId: food.id,
            quantity: qty,
            unit: _unit,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add shopping item')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _search,
            decoration: InputDecoration(
              labelText: 'Search foods',
              border: const OutlineInputBorder(),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () => _runSearch(_search.text),
                    ),
            ),
            onChanged: _onQueryChanged,
          ),
          if (_selected != null)
            Chip(
              label: Text(_selected!.name),
              onDeleted: () => setState(() => _selected = null),
            ),
          ..._results.take(12).map(
                (food) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: RemoteThumb(
                    url: food.imageUrl,
                    size: 44,
                    icon: Icons.egg_outlined,
                  ),
                  title: Text(food.name),
                  subtitle: Text('${food.baseUnit} · ${food.visibility}'),
                  selected: _selected?.id == food.id,
                  onTap: () => setState(() {
                    _selected = food;
                    _unit = food.baseUnit;
                  }),
                ),
              ),
          const SizedBox(height: 12),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Quantity',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _unit,
            decoration: const InputDecoration(
              labelText: 'Unit',
              border: OutlineInputBorder(),
            ),
            items: _units
                .map((u) => DropdownMenuItem(value: u, child: Text(u)))
                .toList(),
            onChanged: (v) {
              if (v != null) setState(() => _unit = v);
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Add item'),
          ),
        ],
      ),
    );
  }
}
