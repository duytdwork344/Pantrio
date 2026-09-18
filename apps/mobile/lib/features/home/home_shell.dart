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
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
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
        title: const Text('Pantrio'),
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
