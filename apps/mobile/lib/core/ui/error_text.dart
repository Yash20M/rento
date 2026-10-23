import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../api/api_exception.dart';
import '../api/models/models.dart';
import 'brand.dart';

/// Customer-facing text for a failure. Branches on the stable error `code`, never on the server's wording; anything
/// unexpected gets the generic message (details stay in the logs, never on screen).
String errorText(AppLocalizations l10n, Object error) {
  if (error is! ApiException) return l10n.errorGeneric;
  if (error.isNetwork) return l10n.errorNetwork;
  return switch (error.code) {
    ErrorCode.retryLater => l10n.errorBusy,
    ErrorCode.bookingSlotTaken => l10n.slotTakenError,
    ErrorCode.leadTimeViolation => l10n.leadTimeError,
    ErrorCode.drawerClosed => l10n.drawerClosedError,
    ErrorCode.durationInvalid => l10n.durationInvalidError,
    ErrorCode.outsideServiceArea => l10n.outsideServiceArea,
    ErrorCode.holdExpired => l10n.holdExpiredBody,
    ErrorCode.paymentInvalid => l10n.paymentFailed,
    ErrorCode.emailTaken => l10n.emailTakenError,
    ErrorCode.kycRequired => l10n.kycRequiredError,
    ErrorCode.aadhaarInUse => l10n.kycInUse,
    ErrorCode.lastLoginMethod => l10n.methodLastError,
    ErrorCode.unauthenticated => l10n.loginFailed,
    ErrorCode.invalidState => l10n.cancelNotAllowed,
    _ => l10n.errorGeneric,
  };
}

/// An error with a retry button, for lists and screens that failed to load.
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final failure = error;
    final offline = failure is ApiException && failure.isNetwork;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            IllustrationBadge(
              key: const Key('error-illustration'),
              icon:
                  offline
                      ? Icons.cloud_off_rounded
                      : Icons.error_outline_rounded,
              size: 104,
              error: true,
            ),
            const SizedBox(height: 14),
            Text(
              errorText(l10n, error),
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: Text(l10n.actionRetry)),
          ],
        ),
      ),
    );
  }
}

/// Duration text from minutes: `30 min`, `1 h`, `1 h 30 min`.
String durationText(AppLocalizations l10n, int minutes) {
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  if (hours == 0) return l10n.durationMinutes(rest);
  if (rest == 0) return l10n.durationHours(hours);
  return l10n.durationHoursMinutes(hours, rest);
}

/// Booking status as customer-facing text.
String statusText(AppLocalizations l10n, String status) => switch (status) {
  'held' => l10n.statusHeld,
  'confirmed' => l10n.statusConfirmed,
  'active' => l10n.statusActive,
  'overdue' => l10n.statusOverdue,
  'completed' => l10n.statusCompleted,
  'cancelled' => l10n.statusCancelled,
  'expired' => l10n.statusExpired,
  'no_show' => l10n.statusNoShow,
  _ => status,
};
