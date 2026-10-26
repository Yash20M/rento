import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/models.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/error_text.dart';
import '../../../l10n/generated/app_localizations.dart';

/// Shared frame of the two screens: title, subtitle, form and a switch link.
class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget hero({required bool tall}) => BrandSurface(
      art: true,
      radius: tall ? 0 : 32,
      padding: EdgeInsets.fromLTRB(24, tall ? 48 : 24, 24, tall ? 48 : 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _BrandMark(),
          SizedBox(height: tall ? 72 : 44),
          Text(
            title,
            style: (tall
                    ? theme.textTheme.displaySmall
                    : theme.textTheme.headlineMedium)
                ?.copyWith(
                  color: AppTheme.onBrand,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: AppTheme.onBrand.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, box) {
          final wide = box.maxWidth >= 860;
          final form = SafeArea(
            child: Align(
              alignment: wide ? Alignment.center : Alignment.topCenter,
              child: SingleChildScrollView(
                padding: EdgeInsets.all(wide ? 40 : 20),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!wide) ...[
                        hero(tall: false),
                        const SizedBox(height: 24),
                      ],
                      child,
                    ],
                  ),
                ),
              ),
            ),
          );
          if (!wide) return form;
          return Row(
            children: [
              Expanded(flex: 5, child: hero(tall: true)),
              Expanded(flex: 6, child: form),
            ],
          );
        },
      ),
    );
  }
}

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .signIn(_email.text, _password.text);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(
        () =>
            _error =
                error.code == ErrorCode.unauthenticated
                    ? l10n.loginFailed
                    : errorText(l10n, error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _AuthScaffold(
      title: l10n.loginTitle,
      subtitle: l10n.loginSubtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.username],
            decoration: InputDecoration(labelText: l10n.emailLabel),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(labelText: l10n.passwordLabel),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _canSubmit ? _submit() : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              key: const Key('auth-error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _canSubmit ? _submit : null,
            child: Text(l10n.signInAction),
          ),
          TextButton(
            key: const Key('forgot-link'),
            onPressed: () => context.go('/forgot'),
            child: Text(l10n.forgotPasswordLink),
          ),
          TextButton(
            onPressed: () => context.go('/register'),
            child: Text(l10n.goToRegister),
          ),
        ],
      ),
    );
  }

  bool get _canSubmit =>
      !_busy && _email.text.trim().isNotEmpty && _password.text.isNotEmpty;
}

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _passwordError;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      !_busy &&
      _name.text.trim().isNotEmpty &&
      _email.text.trim().isNotEmpty &&
      _password.text.isNotEmpty;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _passwordError = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .register(
            name: _name.text,
            email: _email.text,
            password: _password.text,
          );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _passwordError = error.fields['password'];
        if (_passwordError == null) _error = errorText(l10n, error);
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _AuthScaffold(
      title: l10n.registerTitle,
      subtitle: l10n.registerSubtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
            decoration: InputDecoration(labelText: l10n.nameLabel),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: InputDecoration(labelText: l10n.emailLabel),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
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
              key: const Key('auth-error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _canSubmit ? _submit : null,
            child: Text(l10n.registerAction),
          ),
          TextButton(
            onPressed: () => context.go('/login'),
            child: Text(l10n.goToLogin),
          ),
        ],
      ),
    );
  }
}

/// The logo above the sign-in and register forms: the white "Rento." wordmark, as on the orange of the logo.
class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment.centerLeft,
    child: SizedBox(
      key: Key('brand-mark'),
      child: RentoWordmark(height: 44, color: Colors.white),
    ),
  );
}
