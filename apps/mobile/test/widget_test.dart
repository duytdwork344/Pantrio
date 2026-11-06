import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';
import 'package:pantrio_mobile/core/auth/auth_session.dart';
import 'package:pantrio_mobile/core/i18n/content_fallback_notice.dart';
import 'package:pantrio_mobile/core/i18n/l10n.dart';
import 'package:pantrio_mobile/core/i18n/locale_controller.dart';
import 'package:pantrio_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<AuthSession> _pumpApp(WidgetTester tester, {String? savedLocale}) async {
  SharedPreferences.setMockInitialValues({
    if (savedLocale != null) 'pantrio.locale': savedLocale,
  });
  final localeController = await LocaleController.load();
  final session = AuthSession(
    baseUrl: 'http://127.0.0.1:3001/api',
    localeController: localeController,
  );
  session.restoring = false;
  await tester.pumpWidget(
    PantrioApp(session: session, localeController: localeController),
  );
  await tester.pumpAndSettle();
  return session;
}

BuildContext _ctx(WidgetTester tester) => tester.element(find.text('Sign in'));

void main() {
  testWidgets('shows login when unauthenticated', (tester) async {
    await _pumpApp(tester);

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Pantrio'), findsWidgets);
  });

  testWidgets('saved locale drives the app locale and can change', (tester) async {
    final session = await _pumpApp(tester, savedLocale: 'vi');
    expect(Localizations.localeOf(_ctx(tester)).languageCode, 'vi');
    expect(session.api.baseUrl, isNotEmpty);

    await session.setLocale('en');
    await tester.pumpAndSettle();
    expect(Localizations.localeOf(_ctx(tester)).languageCode, 'en');
    expect(session.localeController.code, 'en');
  });

  testWidgets('API errors are shown by code in the app language', (tester) async {
    await _pumpApp(tester, savedLocale: 'vi');
    final ctx = _ctx(tester);
    final error = ApiException(
      'Invalid email or password',
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    );
    expect(localizedError(ctx, error), 'Email hoặc mật khẩu không đúng.');
    expect(
      localizedError(ctx, ApiException('Boom', code: 'SOMETHING_NEW')),
      'Boom',
    );
    expect(ctx.l10n.difficultyLabel('EASY'), 'Dễ');
    expect(ctx.l10n.unitLabel('pcs'), 'cái');
  });

  testWidgets('fallback notice shows only when content is in another language', (tester) async {
    await _pumpApp(tester, savedLocale: 'vi');
    final ctx = _ctx(tester);
    final notice = ctx.l10n.contentFallbackNotice(
      ctx.l10n.languageName('vi'),
      ctx.l10n.languageName('en'),
    );
    expect(notice, 'Chưa có bản tiếng Việt · đang hiển thị bản gốc (tiếng Anh)');

    await tester.pumpWidget(
      Localizations(
        locale: const Locale('vi'),
        delegates: AppLocalizations.localizationsDelegates,
        child: const Directionality(
          textDirection: TextDirection.ltr,
          child: Column(children: [
            ContentFallbackNotice(displayLocale: 'en'),
            ContentFallbackNotice(displayLocale: 'vi'),
          ]),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(notice), findsOneWidget);
  });

  test('matchLocaleCode maps tags to supported locales', () {
    expect(matchLocaleCode('en-US'), 'en');
    expect(matchLocaleCode('vi_VN'), 'vi');
    expect(matchLocaleCode('fr'), isNull);
    expect(matchLocaleCode(null), isNull);
  });
}
