import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

/// Step 1: ask for a recovery email. The answer is always the same, so nobody can find out which emails have accounts.
class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await guardApi(
        () => ref
            .read(authApiProvider)
            .forgotPassword(ForgotPasswordRequest(email: _email.text.trim())),
      );
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.forgotSubtitle),
            const SizedBox(height: 16),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: l10n.emailLabel),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('forgot-send'),
              onPressed: _busy || _email.text.trim().isEmpty ? null : _send,
              child: Text(l10n.forgotSendAction),
            ),
            if (_sent) ...[
              const SizedBox(height: 12),
              Text(l10n.forgotSent, key: const Key('forgot-sent')),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            TextButton(
              key: const Key('have-code'),
              onPressed: () => context.go('/reset'),
              child: Text(l10n.haveCodeAction),
            ),
            TextButton(
              onPressed: () => context.go('/login'),
              child: Text(l10n.signInAction),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step 2: the code from the email plus a new password.
class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key});

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _token = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;
  String? _passwordError;

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _ready =>
      !_busy && _token.text.trim().isNotEmpty && _password.text.isNotEmpty;

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _passwordError = null;
    });
    try {
      await guardApi(
        () => ref
            .read(authApiProvider)
            .resetPassword(
              ResetPasswordRequest(
                token: _token.text.trim(),
                newPassword: _password.text,
              ),
            ),
      );
      if (mounted) setState(() => _done = true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _passwordError = error.fields['newPassword'];
        if (_passwordError == null) {
          _error =
              error.fields.containsKey('token')
                  ? l10n.resetCodeInvalid
                  : errorText(l10n, error);
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.resetTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child:
            _done
                ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.resetDone, key: const Key('reset-done')),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.go('/login'),
                      child: Text(l10n.signInAction),
                    ),
                  ],
                )
                : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _token,
                      decoration: InputDecoration(
                        labelText: l10n.resetCodeLabel,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _password,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: l10n.passwordLabel,
                        helperText: l10n.passwordHint,
                        errorText: _passwordError,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        key: const Key('reset-error'),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      key: const Key('reset-save'),
                      onPressed: _ready ? _save : null,
                      child: Text(l10n.resetAction),
                    ),
                  ],
                ),
      ),
    );
  }
}
