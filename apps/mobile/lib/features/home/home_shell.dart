import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/i18n/l10n.dart';
import 'package:pantrio_mobile/core/i18n/locale_controller.dart';
import 'package:pantrio_mobile/features/auth/login_page.dart';
import 'package:pantrio_mobile/features/inventory/inventory_page.dart';
import 'package:pantrio_mobile/features/nutrition/nutrition_target_page.dart';
import 'package:pantrio_mobile/features/recipes/recipes_page.dart';
import 'package:pantrio_mobile/features/shopping/shopping_page.dart';
import 'package:provider/provider.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    if (session.restoring) {
      return Scaffold(
        backgroundColor: const Color(0xFFE8F6F4),
        body: Center(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.asset(
              'assets/brand/splash/Pantrio-logo.png',
              width: 160,
              height: 160,
              fit: BoxFit.cover,
            ),
          ),
        ),
      );
    }
    if (!session.isAuthenticated) {
      return const LoginPage();
    }

    const pages = [
      RecipesPage(),
      InventoryPage(),
      ShoppingPage(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: ColoredBox(
                color: const Color(0xFFE8F6F4),
                child: Image.asset(
                  'assets/brand/logo/Pantrio-logo.png',
                  width: 32,
                  height: 32,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(context.l10n.appName),
          ],
        ),
        actions: [
          IconButton(
            tooltip: context.l10n.languageLabel,
            onPressed: () => showLanguageSheet(context),
            icon: const Icon(Icons.translate),
          ),
          IconButton(
            tooltip: context.l10n.nutritionTarget,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const NutritionTargetPage(),
                ),
              );
            },
            icon: const Icon(Icons.monitor_heart_outlined),
          ),
          if (session.user != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Text(
                  session.user!.displayName,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),
          IconButton(
            tooltip: context.l10n.navLogout,
            onPressed: () => session.logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.restaurant_menu_outlined),
            selectedIcon: const Icon(Icons.restaurant_menu),
            label: context.l10n.navRecipes,
          ),
          NavigationDestination(
            icon: const Icon(Icons.kitchen_outlined),
            selectedIcon: const Icon(Icons.kitchen),
            label: context.l10n.navInventory,
          ),
          NavigationDestination(
            icon: const Icon(Icons.shopping_basket_outlined),
            selectedIcon: const Icon(Icons.shopping_basket),
            label: context.l10n.navShopping,
          ),
        ],
      ),
    );
  }
}

/// Language picker (design screen 10): device default or an explicit locale.
/// Saved on the device and, when signed in, on the account (User.locale).
Future<void> showLanguageSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      final l10n = sheetContext.l10n;
      final session = sheetContext.read<AuthSession>();
      final current = sheetContext.watch<LocaleController>().preference;
      Widget option(String? code, String title) => RadioListTile<String?>(
            value: code,
            groupValue: current,
            title: Text(title),
            onChanged: (value) {
              Navigator.of(sheetContext).pop();
              session.setLocale(value);
            },
          );
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(24, 0, 24, 8),
              child: Text(
                l10n.languageLabel,
                style: Theme.of(sheetContext).textTheme.titleLarge,
              ),
            ),
            for (final code in supportedLocaleCodes)
              option(code, localeNativeNames[code] ?? code),
            option(null, l10n.languageSystem),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(24, 8, 24, 16),
              child: Text(
                l10n.languageNote,
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      );
    },
  );
}
