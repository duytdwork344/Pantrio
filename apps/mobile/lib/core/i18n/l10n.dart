import 'package:flutter/widgets.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:intl/intl.dart';
import 'package:pantrio_mobile/core/api/api_exception.dart';

export 'package:flutter_gen/gen_l10n/app_localizations.dart';

/// `context.l10n.navRecipes` instead of `AppLocalizations.of(context).navRecipes`.
extension L10nContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);

  String get localeTag => Localizations.localeOf(this).toLanguageTag();
}

/// User-facing text for any error: translated ErrorCode for [ApiException],
/// else the generic message (requirements 2b.1 #8).
String localizedError(BuildContext context, Object error) {
  final l10n = context.l10n;
  if (error is ApiException) {
    final fallback =
        error.message.isNotEmpty ? error.message : l10n.errorUnknown;
    return error.code == null ? fallback : l10n.errorMessage(error.code!, fallback);
  }
  return l10n.errorUnknown;
}

/// Locale-aware formatting (requirements 2b.1 #7). Date symbols for the app
/// locales are loaded by GlobalMaterialLocalizations.
String formatDate(BuildContext context, DateTime? value) =>
    value == null ? '' : DateFormat.yMd(context.localeTag).format(value.toLocal());

String formatDateTime(BuildContext context, DateTime? value) => value == null
    ? ''
    : DateFormat.yMd(context.localeTag).add_Hm().format(value.toLocal());

String formatNumber(BuildContext context, num? value, {int maxFractionDigits = 2}) {
  if (value == null) return '';
  final fmt = NumberFormat.decimalPattern(context.localeTag)
    ..maximumFractionDigits = maxFractionDigits;
  return fmt.format(value);
}

/// Quantity + translated unit, e.g. "1,5 kg" (vi) / "1.5 kg" (en), "2 cái".
String formatQuantity(BuildContext context, num? value, String unit) =>
    '${formatNumber(context, value)} ${context.l10n.unitLabel(unit)}';
