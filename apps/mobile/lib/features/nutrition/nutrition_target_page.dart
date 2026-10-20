import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/models/recipe.dart';
import 'package:provider/provider.dart';

class NutritionTargetPage extends StatefulWidget {
  const NutritionTargetPage({super.key});

  @override
  State<NutritionTargetPage> createState() => _NutritionTargetPageState();
}

class _NutritionTargetPageState extends State<NutritionTargetPage> {
  NutritionTarget? _target;
  List<NutritionPreset> _presets = const [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _ok;

  String _sex = 'FEMALE';
  final _ageCtrl = TextEditingController(text: '30');
  final _weightCtrl = TextEditingController(text: '55');
  final _heightCtrl = TextEditingController(text: '160');
  String _activity = 'MODERATE';
  String _presetCode = 'ADULT_DEFAULT';

  final _kcalCtrl = TextEditingController(text: '2000');
  final _proteinCtrl = TextEditingController(text: '100');
  final _fatCtrl = TextEditingController(text: '67');
  final _carbCtrl = TextEditingController(text: '250');

  static const _activities = {
    'SEDENTARY': 'Ít vận động',
    'LIGHT': 'Nhẹ',
    'MODERATE': 'Vừa',
    'ACTIVE': 'Nhiều',
    'VERY_ACTIVE': 'Rất nhiều',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ageCtrl.dispose();
    _weightCtrl.dispose();
    _heightCtrl.dispose();
    _kcalCtrl.dispose();
    _proteinCtrl.dispose();
    _fatCtrl.dispose();
    _carbCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<AuthSession>().api;
    try {
      final presets = await api.listNutritionPresets();
      final target = await api.getNutritionTarget();
      if (!mounted) return;
      setState(() {
        _presets = presets;
        _target = target;
        if (target != null) _applyTarget(target);
        if (presets.isNotEmpty &&
            !presets.any((p) => p.code == _presetCode)) {
          _presetCode = presets.first.code;
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : e.toString();
      });
    }
  }

  void _applyTarget(NutritionTarget t) {
    if (t.sex != null) _sex = t.sex!;
    if (t.ageYears != null) _ageCtrl.text = '${t.ageYears}';
    if (t.weightKg != null) _weightCtrl.text = '${t.weightKg}';
    if (t.heightCm != null) _heightCtrl.text = '${t.heightCm}';
    _activity = t.activity;
    if (t.presetCode != null) _presetCode = t.presetCode!;
    _kcalCtrl.text = '${t.energyKcal}';
    _proteinCtrl.text = '${t.proteinG}';
    _fatCtrl.text = '${t.fatG}';
    _carbCtrl.text = '${t.carbG}';
  }

  Future<void> _compute() async {
    setState(() {
      _saving = true;
      _error = null;
      _ok = null;
    });
    final api = context.read<AuthSession>().api;
    try {
      final row = await api.computeNutritionTarget(
        sex: _sex,
        ageYears: int.parse(_ageCtrl.text.trim()),
        weightKg: num.parse(_weightCtrl.text.trim()),
        heightCm: num.parse(_heightCtrl.text.trim()),
        activity: _activity,
      );
      if (!mounted) return;
      setState(() {
        _target = row;
        _applyTarget(row);
        _saving = false;
        _ok = 'Đã tính và lưu target ngày.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e is ApiException ? e.message : e.toString();
      });
    }
  }

  Future<void> _applyPreset() async {
    setState(() {
      _saving = true;
      _error = null;
      _ok = null;
    });
    final api = context.read<AuthSession>().api;
    try {
      final row = await api.applyNutritionPreset(_presetCode);
      if (!mounted) return;
      setState(() {
        _target = row;
        _applyTarget(row);
        _saving = false;
        _ok = 'Đã áp dụng preset.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e is ApiException ? e.message : e.toString();
      });
    }
  }

  Future<void> _saveManual() async {
    setState(() {
      _saving = true;
      _error = null;
      _ok = null;
    });
    final api = context.read<AuthSession>().api;
    try {
      final row = await api.saveManualNutritionTarget(
        energyKcal: int.parse(_kcalCtrl.text.trim()),
        proteinG: int.parse(_proteinCtrl.text.trim()),
        fatG: int.parse(_fatCtrl.text.trim()),
        carbG: int.parse(_carbCtrl.text.trim()),
      );
      if (!mounted) return;
      setState(() {
        _target = row;
        _applyTarget(row);
        _saving = false;
        _ok = 'Đã lưu target chỉnh tay.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e is ApiException ? e.message : e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mục tiêu dinh dưỡng')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text(
                  'Tính nhu cầu ngày (Mifflin) để xem % trên recipe. Tuổi dưới 18 dùng preset.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  _target?.disclaimer ??
                      'Ước lượng dinh dưỡng mang tính tham khảo, không thay thế tư vấn y tế.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                if (_ok != null) ...[
                  const SizedBox(height: 8),
                  Text(_ok!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                ],
                if (_target != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Hiện tại: ${_target!.source} · ${_target!.energyKcal} kcal · '
                    'P ${_target!.proteinG}g · F ${_target!.fatG}g · C ${_target!.carbG}g',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
                const SizedBox(height: 20),
                Text('Tính từ chỉ số (18+)', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _sex,
                  decoration: const InputDecoration(labelText: 'Giới'),
                  items: const [
                    DropdownMenuItem(value: 'FEMALE', child: Text('Nữ')),
                    DropdownMenuItem(value: 'MALE', child: Text('Nam')),
                  ],
                  onChanged: (v) => setState(() => _sex = v ?? 'FEMALE'),
                ),
                TextField(
                  controller: _ageCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Tuổi'),
                ),
                TextField(
                  controller: _weightCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Cân nặng (kg)'),
                ),
                TextField(
                  controller: _heightCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Chiều cao (cm)'),
                ),
                DropdownButtonFormField<String>(
                  value: _activity,
                  decoration: const InputDecoration(labelText: 'Vận động'),
                  items: _activities.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _activity = v ?? 'MODERATE'),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _saving ? null : _compute,
                  child: const Text('Tính & lưu'),
                ),
                const SizedBox(height: 24),
                Text('Preset', style: Theme.of(context).textTheme.titleMedium),
                DropdownButtonFormField<String>(
                  value: _presetCode,
                  decoration: const InputDecoration(labelText: 'Mẫu'),
                  items: _presets
                      .map(
                        (p) => DropdownMenuItem(
                          value: p.code,
                          child: Text('${p.code} · ${p.energyKcal} kcal'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) =>
                      setState(() => _presetCode = v ?? _presetCode),
                ),
                const SizedBox(height: 8),
                FilledButton.tonal(
                  onPressed: _saving ? null : _applyPreset,
                  child: const Text('Áp dụng preset'),
                ),
                const SizedBox(height: 24),
                Text('Chỉnh tay', style: Theme.of(context).textTheme.titleMedium),
                TextField(
                  controller: _kcalCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'kcal'),
                ),
                TextField(
                  controller: _proteinCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Protein (g)'),
                ),
                TextField(
                  controller: _fatCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Fat (g)'),
                ),
                TextField(
                  controller: _carbCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Carb (g)'),
                ),
                const SizedBox(height: 8),
                FilledButton.tonal(
                  onPressed: _saving ? null : _saveManual,
                  child: const Text('Lưu chỉnh tay'),
                ),
              ],
            ),
    );
  }
}
