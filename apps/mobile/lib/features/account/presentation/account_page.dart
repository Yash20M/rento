import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/ui/product_image.dart';
import '../../../core/ui/brand.dart';
import '../../../core/ui/kit.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../kyc/presentation/kyc_page.dart';
import 'delete_account_dialog.dart';
import 'edit_profile_dialog.dart';
import 'photo_sheet.dart';

class AccountPage extends ConsumerWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(authControllerProvider);
    final signedIn = state is SignedIn ? state : null;
    final who =
        signedIn == null
            ? l10n.unknownUser
            : (signedIn.user.displayName ??
                signedIn.user.email ??
                l10n.unknownUser);
    final email = signedIn?.user.email;
    final emailVerified = signedIn?.user.emailVerified ?? false;
    final kyc = ref.watch(kycStatusProvider).value?.status;
    final idLevel = switch (kyc) {
      'verified' => TrustLevel.ok,
      'pending' => TrustLevel.pending,
      _ => TrustLevel.missing,
    };
    final idLabel = switch (kyc) {
      'verified' => l10n.trustIdOk,
      'pending' => l10n.trustIdPending,
      'rejected' => l10n.trustIdRejected,
      _ => l10n.trustIdNo,
    };
    final scheme = Theme.of(context).colorScheme;
    final avatarRef = signedIn?.user.avatarUrl;
    final avatar =
        avatarRef == null
            ? null
            : resolvePhotoUrl(ref.watch(envProvider).apiBaseUrl, avatarRef);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          BrandHeader(
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Semantics(
                      button: true,
                      label: l10n.photoChange,
                      child: InkWell(
                        key: const Key('change-photo'),
                        customBorder: const CircleBorder(),
                        onTap: () => showPhotoSheet(context),
                        child: UserAvatar(
                          name: who,
                          radius: 36,
                          photoUrl: avatar,
                        ),
                      ),
                    ),
                    Positioned(
                      left: -2,
                      bottom: -2,
                      child: IgnorePointer(
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: scheme.primaryContainer,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: Icon(
                            Icons.photo_camera_rounded,
                            size: 14,
                            color: scheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ),
                    if (kyc == 'verified')
                      Positioned(
                        right: -2,
                        bottom: -2,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: VerifiedBadge(
                            key: const Key('verified-badge'),
                            label: l10n.verifiedBadgeLabel,
                            size: 24,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              who,
                              key: const Key('account-name'),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                      if (email != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          l10n.signedInAs(email),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.88),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionTitle(l10n.trustHeading),
          Wrap(
            key: const Key('trust-row'),
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustChip(
                key: const Key('trust-email'),
                label: emailVerified ? l10n.trustEmailOk : l10n.trustEmailNo,
                level: emailVerified ? TrustLevel.ok : TrustLevel.missing,
                onTap:
                    emailVerified ? null : () => context.push('/verify-email'),
              ),
              TrustChip(
                key: const Key('trust-id'),
                label: idLabel,
                level: idLevel,
                onTap: kyc == 'verified' ? null : () => context.push('/kyc'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  key: const Key('edit-profile'),
                  leading: const Icon(Icons.person_outline),
                  title: Text(l10n.editProfileTile),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => showEditProfileDialog(context),
                ),
                // Once verified, the trust chip above says it; the row is only for getting it done.
                if (signedIn != null && email != null && !emailVerified)
                  ListTile(
                    key: const Key('email-tile'),
                    leading: const Icon(Icons.mark_email_unread_outlined),
                    title: Text(l10n.emailVerifyTile),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/verify-email'),
                  ),
                ListTile(
                  key: const Key('methods-tile'),
                  leading: const Icon(Icons.key_outlined),
                  title: Text(l10n.signInMethodsTile),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/sign-in-methods'),
                ),
                ListTile(
                  key: const Key('kyc-tile'),
                  leading: const Icon(Icons.verified_user_outlined),
                  title: Text(
                    kyc == null ? l10n.kycTitle : kycStatusText(l10n, kyc),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/kyc'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            key: const Key('delete-account'),
            style: TextButton.styleFrom(foregroundColor: scheme.error),
            onPressed: () => showDeleteAccountDialog(context),
            icon: const Icon(Icons.delete_outline),
            label: Text(l10n.deleteAccountTile),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const Key('sign-out'),
            onPressed:
                () => ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
            label: Text(l10n.signOutAction),
          ),
        ],
      ),
    );
  }
}
