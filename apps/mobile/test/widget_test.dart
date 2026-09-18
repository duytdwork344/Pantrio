import 'package:flutter_test/flutter_test.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/main.dart';

void main() {
  testWidgets('shows login when unauthenticated', (tester) async {
    final session = AuthSession(baseUrl: 'http://127.0.0.1:3001/api');
    session.restoring = false;

    await tester.pumpWidget(PantrioApp(session: session));
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Pantrio'), findsWidgets);
  });
}
