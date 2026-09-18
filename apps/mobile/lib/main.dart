import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/theme/app_theme.dart';
import 'package:pantrio_mobile/features/home/home_shell.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = AuthSession();
  await session.restore();
  runApp(PantrioApp(session: session));
}

class PantrioApp extends StatelessWidget {
  const PantrioApp({super.key, required this.session});

  final AuthSession session;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: session,
      child: MaterialApp(
        title: 'Pantrio',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const HomeShell(),
      ),
    );
  }
}
