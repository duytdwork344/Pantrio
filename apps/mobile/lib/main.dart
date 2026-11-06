import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/i18n/l10n.dart';
import 'package:pantrio_mobile/core/i18n/locale_controller.dart';
import 'package:pantrio_mobile/core/theme/app_theme.dart';
import 'package:pantrio_mobile/features/home/home_shell.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final localeController = await LocaleController.load();
  final session = AuthSession(localeController: localeController);
  await session.restore();
  runApp(PantrioApp(session: session, localeController: localeController));
}

class PantrioApp extends StatelessWidget {
  const PantrioApp({
    super.key,
    required this.session,
    required this.localeController,
  });

  final AuthSession session;
  final LocaleController localeController;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: localeController),
        ChangeNotifierProvider.value(value: session),
      ],
      child: Consumer<LocaleController>(
        builder: (context, locale, _) => MaterialApp(
          onGenerateTitle: (context) => context.l10n.appName,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          locale: locale.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const HomeShell(),
        ),
      ),
    );
  }
}
