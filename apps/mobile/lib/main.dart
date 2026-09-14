import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/theme/app_theme.dart';
import 'package:pantrio_mobile/features/home/home_shell.dart';

void main() {
  runApp(const PantrioApp());
}

class PantrioApp extends StatelessWidget {
  const PantrioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pantrio',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const HomeShell(),
    );
  }
}
