import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/inventory_item.dart';
import 'package:provider/provider.dart';

const _units = ['g', 'kg', 'ml', 'l', 'pcs'];
const _locations = ['PANTRY', 'FRIDGE', 'FREEZER', 'OTHER'];

class EditInventoryPage extends StatefulWidget {
  const EditInventoryPage({super.key, required this.item});

  final InventoryItem item;

  @override
  State<EditInventoryPage> createState() => _EditInventoryPageState();
}

class _EditInventoryPageState extends State<EditInventoryPage> {
  late final TextEditingController _quantity;
  late final TextEditingController _notes;
  late String _unit;
  late String _location;
  late bool _opened;
  late bool _hasExpiry;
  late bool _hasPurchaseDate;
  DateTime? _expiry;
  DateTime? _purchaseDate;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final item = widget.item;
    _quantity = TextEditingController(text: _fmt(item.quantity));
    _notes = TextEditingController(text: item.notes ?? '');
    _unit = item.unit;
    _location = _locations.contains(item.storageLocation)
        ? item.storageLocation
        : 'OTHER';
    _opened = item.opened;
    if (item.expiryDate != null && item.expiryDate!.isNotEmpty) {
      _hasExpiry = true;
      _expiry = DateTime.tryParse(item.expiryDate!) ?? DateTime.now();
    } else {
      _hasExpiry = false;
      _expiry = null;
    }
    if (item.purchaseDate != null && item.purchaseDate!.isNotEmpty) {
      _hasPurchaseDate = true;
      _purchaseDate =
          DateTime.tryParse(item.purchaseDate!) ?? DateTime.now();
    } else {
      _hasPurchaseDate = false;
      _purchaseDate = null;
    }
  }

  @override
  void dispose() {
    _quantity.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _fmt(num value) {
    if (value == value.roundToDouble()) {
      return value.round().toString();
    }
    return value.toString();
  }

  String _dayLabel(DateTime d) => d.toIso8601String().substring(0, 10);

  String _dayIso(DateTime d) =>
      DateTime.utc(d.year, d.month, d.day).toIso8601String();

  Future<void> _pickExpiry() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiry ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      setState(() {
        _hasExpiry = true;
        _expiry = picked;
      });
    }
  }

  Future<void> _pickPurchase() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _purchaseDate ?? now,
      firstDate: now.subtract(const Duration(days: 365 * 2)),
      lastDate: now,
    );
    if (picked != null) {
      setState(() {
        _hasPurchaseDate = true;
        _purchaseDate = picked;
      });
    }
  }

  Future<void> _save() async {
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
      await context.read<AuthSession>().api.updateInventoryItem(
            id: widget.item.id,
            quantity: qty,
            unit: _unit,
            storageLocation: _location,
            opened: _opened,
            notes: _notes.text.trim(),
            clearExpiry: !_hasExpiry,
            expiryDate: _hasExpiry && _expiry != null
                ? _dayIso(_expiry!)
                : null,
            clearPurchaseDate: !_hasPurchaseDate,
            purchaseDate: _hasPurchaseDate && _purchaseDate != null
                ? _dayIso(_purchaseDate!)
                : null,
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
    final item = widget.item;
    return Scaffold(
      appBar: AppBar(title: Text('Edit ${item.foodName}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            item.foodName,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
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
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Has purchase date'),
            value: _hasPurchaseDate,
            onChanged: (v) => setState(() {
              _hasPurchaseDate = v;
              if (v && _purchaseDate == null) {
                _purchaseDate = DateTime.now();
              }
            }),
          ),
          if (_hasPurchaseDate)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                _purchaseDate == null
                    ? 'Pick purchase date'
                    : 'Purchased ${_dayLabel(_purchaseDate!)}',
              ),
              trailing: const Icon(Icons.calendar_today),
              onTap: _pickPurchase,
            ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Has expiry date'),
            value: _hasExpiry,
            onChanged: (v) => setState(() {
              _hasExpiry = v;
              if (v && _expiry == null) {
                _expiry = DateTime.now().add(const Duration(days: 7));
              }
            }),
          ),
          if (_hasExpiry)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                _expiry == null
                    ? 'Pick expiry date'
                    : 'Expiry ${_dayLabel(_expiry!)}',
              ),
              trailing: const Icon(Icons.event),
              onTap: _pickExpiry,
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
                : const Text('Save batch'),
          ),
        ],
      ),
    );
  }
}
