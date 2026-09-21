import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/food_item.dart';
import 'package:provider/provider.dart';

const _units = ['g', 'kg', 'ml', 'l', 'pcs'];
const _locations = ['PANTRY', 'FRIDGE', 'FREEZER', 'OTHER'];

class AddInventoryPage extends StatefulWidget {
  const AddInventoryPage({super.key, this.groupId});

  /// When set, batch is created in the InventoryGroup pantry.
  final String? groupId;

  @override
  State<AddInventoryPage> createState() => _AddInventoryPageState();
}

class _AddInventoryPageState extends State<AddInventoryPage> {
  final _search = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _notes = TextEditingController();
  Timer? _debounce;
  List<FoodItem> _results = const [];
  FoodItem? _selected;
  String _unit = 'g';
  String _location = 'PANTRY';
  bool _opened = false;
  bool _hasExpiry = false;
  DateTime _purchaseDate = DateTime.now();
  DateTime? _expiryDate;
  bool _searching = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _quantity.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _dayLabel(DateTime d) =>
      d.toIso8601String().substring(0, 10);

  String _dayIso(DateTime d) =>
      DateTime.utc(d.year, d.month, d.day).toIso8601String();

  Future<void> _pickPurchaseDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _purchaseDate,
      firstDate: now.subtract(const Duration(days: 365 * 2)),
      lastDate: now,
    );
    if (picked != null) {
      setState(() => _purchaseDate = picked);
    }
  }

  Future<void> _pickExpiryDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate ?? now.add(const Duration(days: 7)),
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      setState(() {
        _hasExpiry = true;
        _expiryDate = picked;
      });
    }
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

  Future<void> _createPrivateFood() async {
    final name = _search.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Enter a food name first');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final measurementType = (_unit == 'ml' || _unit == 'l')
          ? 'VOLUME'
          : (_unit == 'pcs' ? 'COUNT' : 'WEIGHT');
      final food = await context.read<AuthSession>().api.createPrivateFood(
            name: name,
            baseUnit: _unit,
            measurementType: measurementType,
          );
      if (!mounted) return;
      setState(() {
        _selected = food;
        _unit = food.baseUnit;
        _saving = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _saving = false;
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
      await context.read<AuthSession>().api.createInventoryItem(
            foodId: food.id,
            quantity: qty,
            unit: _unit,
            groupId: widget.groupId,
            storageLocation: _location,
            opened: _opened,
            purchaseDate: _dayIso(_purchaseDate),
            expiryDate:
                _hasExpiry && _expiryDate != null ? _dayIso(_expiryDate!) : null,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
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
      appBar: AppBar(title: const Text('Add to inventory')),
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
          const SizedBox(height: 8),
          if (_selected != null)
            Chip(
              label: Text('${_selected!.name} (${_selected!.visibility})'),
              onDeleted: () => setState(() => _selected = null),
            ),
          ..._results.take(12).map(
                (food) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(food.name),
                  subtitle: Text(
                    '${food.baseUnit} · ${food.visibility}'
                    '${food.category != null ? ' · ${food.category}' : ''}',
                  ),
                  selected: _selected?.id == food.id,
                  onTap: () => setState(() {
                    _selected = food;
                    _unit = food.baseUnit;
                  }),
                ),
              ),
          TextButton(
            onPressed: _saving ? null : _createPrivateFood,
            child: const Text('Create PRIVATE food from search text'),
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
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _location,
            decoration: const InputDecoration(
              labelText: 'Storage',
              border: OutlineInputBorder(),
            ),
            items: _locations
                .map((u) => DropdownMenuItem(value: u, child: Text(u)))
                .toList(),
            onChanged: (v) {
              if (v != null) setState(() => _location = v);
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Opened'),
            value: _opened,
            onChanged: (v) => setState(() => _opened = v),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Purchase date ${_dayLabel(_purchaseDate)}'),
            trailing: const Icon(Icons.calendar_today),
            onTap: _pickPurchaseDate,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Has expiry date'),
            value: _hasExpiry,
            onChanged: (v) => setState(() {
              _hasExpiry = v;
              if (v && _expiryDate == null) {
                _expiryDate = DateTime.now().add(const Duration(days: 7));
              }
            }),
          ),
          if (_hasExpiry)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                _expiryDate == null
                    ? 'Pick expiry date'
                    : 'Expiry ${_dayLabel(_expiryDate!)}',
              ),
              trailing: const Icon(Icons.event),
              onTap: _pickExpiryDate,
            ),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Notes',
              border: OutlineInputBorder(),
            ),
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
                : const Text('Add batch'),
          ),
        ],
      ),
    );
  }
}
