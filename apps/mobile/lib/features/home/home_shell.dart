import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/features/auth/login_page.dart';
import 'package:pantrio_mobile/features/inventory/inventory_page.dart';
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
            const Text('Pantrio'),
          ],
        ),
        actions: [
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
            tooltip: 'Sign out',
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
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.restaurant_menu_outlined),
            selectedIcon: Icon(Icons.restaurant_menu),
            label: 'Recipes',
          ),
          NavigationDestination(
            icon: Icon(Icons.kitchen_outlined),
            selectedIcon: Icon(Icons.kitchen),
            label: 'Inventory',
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_basket_outlined),
            selectedIcon: Icon(Icons.shopping_basket),
            label: 'Shopping',
          ),
        ],
      ),
    );
  }
}
