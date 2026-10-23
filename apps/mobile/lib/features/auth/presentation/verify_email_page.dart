import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

/// Confirms the email address: paste the code from the emailed link, or ask for a new link.
class VerifyEmailPage extends ConsumerStatefulWidget {
  const VerifyEmailPage({super.key});

  @override
  ConsumerState<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends ConsumerState<VerifyEmailPage> {
  final _token = TextEditingController();
  bool _busy = false;
  bool _resent = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _token.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await guardApi(
        () => ref
            .read(authApiProvider)
            .verifyEmail(VerifyEmailRequest(token: _token.text.trim())),
      );
      ref.read(authControllerProvider.notifier).markEmailVerified();
      if (mounted) setState(() => _done = true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(
        () =>
            _error =
                error.fields.containsKey('token')
                    ? l10n.emailVerifyInvalid
                    : errorText(l10n, error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _resent = false;
    });
    try {
      await guardApi(() => ref.read(authApiProvider).resendVerification());
      if (mounted) setState(() => _resent = true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(authControllerProvider);
    final email = state is SignedIn ? (state.user.email ?? '') : '';
    return Scaffold(
      appBar: AppBar(title: Text(l10n.emailVerifyTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child:
            _done
                ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.emailVerifyDone,
                      key: const Key('email-verified'),
                      textAlign: TextAlign.center,
                    ),
                  ],
                )
                : ListView(
                  children: [
                    Text(l10n.emailVerifyBody(email)),
                    const SizedBox(height: 16),
                    TextField(
                      key: const Key('verify-token'),
                      controller: _token,
                      autocorrect: false,
                      enableSuggestions: false,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: l10n.emailVerifyCode,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      key: const Key('verify-submit'),
                      onPressed:
                          _busy || _token.text.trim().isEmpty ? null : _verify,
                      child: Text(l10n.emailVerifyAction),
                    ),
                    TextButton(
                      key: const Key('verify-resend'),
                      onPressed: _busy ? null : _resend,
                      child: Text(l10n.emailVerifyResend),
                    ),
                    if (_resent)
                      Text(
                        l10n.emailVerifyResent,
                        key: const Key('verify-resent'),
                        textAlign: TextAlign.center,
                      ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          _error!,
                          key: const Key('verify-error'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                  ],
                ),
      ),
    );
  }
}
