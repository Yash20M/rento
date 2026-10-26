import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../core/ui/responsive.dart';

/// The customer's identity-verification state.
final kycStatusProvider = FutureProvider.autoDispose<KycStatus>(
  (ref) => ref.watch(kycApiProvider).status(),
);

/// Groups the digits in fours as they are typed: `2345 6789 0123`.
class _AadhaarFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final capped = digits.length > 12 ? digits.substring(0, 12) : digits;
    final buffer = StringBuffer();
    for (var i = 0; i < capped.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(capped[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

String kycStatusText(AppLocalizations l10n, String status) => switch (status) {
  'verified' => l10n.kycStatusVerified,
  'pending' => l10n.kycStatusPending,
  'rejected' => l10n.kycStatusRejected,
  _ => l10n.kycStatusNone,
};

/// Verify with Aadhaar: number → one-time code → done. The number is held in this screen's text field only until the code
/// was requested; it is never kept anywhere else.
class KycPage extends ConsumerStatefulWidget {
  const KycPage({super.key});

  @override
  ConsumerState<KycPage> createState() => _KycPageState();
}

class _KycPageState extends ConsumerState<KycPage> {
  final _number = TextEditingController();
  final _code = TextEditingController();
  AadhaarRequest? _request;
  KycStatus? _done;
  bool _busy = false;
  String? _error;
  String? _codeError;

  @override
  void dispose() {
    _number.dispose();
    _code.dispose();
    super.dispose();
  }

  String _message(AppLocalizations l10n, ApiException error) {
    if (error.code == ErrorCode.aadhaarInUse) return l10n.kycInUse;
    if (error.code == ErrorCode.rateLimited) return l10n.kycTooMany;
    if (error.code == ErrorCode.invalidState) return l10n.kycDeclined;
    if (error.fields.containsKey('aadhaarNumber')) return l10n.kycInvalidNumber;
    return errorText(l10n, error);
  }

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final request = await ref.read(kycApiProvider).start(_number.text);
      if (mounted) {
        setState(() {
          _request = request;
          _number.clear(); // the number is not needed any more
        });
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = _message(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _codeError = null;
      _error = null;
    });
    try {
      final status = await ref
          .read(kycApiProvider)
          .verify(_request!.requestId, _code.text.trim());
      ref.invalidate(kycStatusProvider);
      if (mounted) setState(() => _done = status);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _codeError = error.fields['otp'];
        if (_codeError == null) _error = _message(l10n, error);
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.kycTitle)),
      body: ListView(
        padding: pagePadding(context, maxWidth: 640, top: 24, bottom: 24),
        children: [
          if (_done != null) ...[
            Icon(
              Icons.verified_user,
              size: 56,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.kycVerifiedTitle,
              key: const Key('kyc-verified'),
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall,
            ),
            Text(
              l10n.kycVerifiedBody(_done!.maskedAadhaar ?? ''),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('kyc-continue'),
              onPressed:
                  () => context.canPop() ? context.pop(true) : context.go('/'),
              child: Text(l10n.kycContinue),
            ),
          ] else if (_request == null) ...[
            Text(l10n.kycWhy),
            const SizedBox(height: 8),
            Text(l10n.kycConsent, style: theme.textTheme.bodySmall),
            const SizedBox(height: 16),
            TextField(
              key: const Key('kyc-number'),
              controller: _number,
              keyboardType: TextInputType.number,
              inputFormatters: [_AadhaarFormatter()],
              decoration: InputDecoration(
                labelText: l10n.kycNumberLabel,
                helperText: l10n.kycNumberHint,
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                key: const Key('kyc-error'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('kyc-send'),
              onPressed:
                  !_busy && _number.text.replaceAll(' ', '').length == 12
                      ? _send
                      : null,
              child: Text(l10n.kycSendCode),
            ),
          ] else ...[
            Text(
              l10n.kycCodeSent(_request!.maskedAadhaar),
              key: const Key('kyc-code-sent'),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const Key('kyc-code'),
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 8,
              decoration: InputDecoration(
                labelText: l10n.kycCodeLabel,
                errorText: _codeError,
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null) ...[
              Text(
                _error!,
                key: const Key('kyc-error'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
            const SizedBox(height: 8),
            FilledButton(
              key: const Key('kyc-verify'),
              onPressed:
                  !_busy && _code.text.trim().length >= 4 ? _verify : null,
              child: Text(l10n.kycVerifyAction),
            ),
            TextButton(
              key: const Key('kyc-change'),
              onPressed:
                  () => setState(() {
                    _request = null;
                    _code.clear();
                    _error = null;
                    _codeError = null;
                  }),
              child: Text(l10n.kycChangeNumber),
            ),
          ],
        ],
      ),
    );
  }
}
