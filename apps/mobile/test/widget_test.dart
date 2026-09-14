import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pantrio_mobile/main.dart';

void main() {
  testWidgets('Pantrio shell smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const PantrioApp());
    await tester.pumpAndSettle();
    expect(find.text('Pantrio'), findsOneWidget);
    expect(find.text('Inventory'), findsOneWidget);
  });
}
