import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/l10n/generated/app_localizations.dart';

void main() {
  test('L-01 English strings exist and placeholders format', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('en'));

    for (final value in [
      l10n.appName,
      l10n.notFoundTitle,
      l10n.notFoundAction,
      l10n.loginTitle,
      l10n.exploreTitle,
      l10n.reserveAction,
      l10n.myBookingsTitle,
    ]) {
      expect(value, isNotEmpty);
    }
    expect(l10n.envFlavorLabel('dev'), 'Environment: dev');
    expect(l10n.searchingNear('Indiranagar'), 'Near Indiranagar');
    expect(l10n.payAction('₹298'), 'Pay ₹298');
    expect(AppLocalizations.supportedLocales, [const Locale('en')]);
  });

  test('L-02 counts are pluralised', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('en'));
    expect(l10n.availableNowCount(0), 'None free right now');
    expect(l10n.availableNowCount(1), '1 available now');
    expect(l10n.availableNowCount(3), '3 available now');
  });

  test('L-03 durations read naturally', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('en'));
    expect(l10n.durationMinutes(30), '30 min');
    expect(l10n.durationHours(2), '2 h');
    expect(l10n.durationHoursMinutes(1, 30), '1 h 30 min');
  });
}
