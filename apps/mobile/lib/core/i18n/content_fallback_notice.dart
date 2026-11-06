import 'package:flutter/material.dart';
import 'package:pantrio_mobile/core/i18n/l10n.dart';

/// "No English version yet · showing the original (Vietnamese)" when content
/// is shown in another language than the app (requirements 2b.2 #6).
class ContentFallbackNotice extends StatelessWidget {
  const ContentFallbackNotice({super.key, required this.displayLocale});

  final String? displayLocale;

  @override
  Widget build(BuildContext context) {
    final shown = displayLocale;
    final appLocale = Localizations.localeOf(context).languageCode;
    if (shown == null || shown == appLocale) return const SizedBox.shrink();
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surfaceVariant,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            l10n.contentFallbackNotice(
              l10n.languageName(appLocale),
              l10n.languageName(shown),
            ),
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
      ),
    );
  }
}
