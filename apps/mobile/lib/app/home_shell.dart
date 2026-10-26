import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/ui/brand.dart';
import '../core/ui/responsive.dart';
import '../l10n/generated/app_localizations.dart';

/// The three tabs of the signed-in app. Each tab keeps its own navigation state. The phone's back button on another
/// tab returns to Explore; on Explore it leaves the app (Android convention, P3-49).
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: _scaffold(context, l10n),
    );
  }

  Widget _scaffold(BuildContext context, AppLocalizations l10n) {
    void select(int index) =>
        shell.goBranch(index, initialLocation: index == shell.currentIndex);
    final tabs = [
      (Icons.explore_outlined, Icons.explore, l10n.tabExplore),
      (Icons.receipt_long_outlined, Icons.receipt_long, l10n.tabBookings),
      (Icons.person_outline, Icons.person, l10n.tabAccount),
    ];
    // A wide window (tablet, desktop browser) gets a side rail with the logo instead of a bottom bar.
    if (isWideLayout(context)) {
      final size = MediaQuery.sizeOf(context);
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: shell.currentIndex,
              onDestinationSelected: select,
              labelType: NavigationRailLabelType.all,
              leading: const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: RentoLogo(size: 52),
              ),
              destinations: [
                for (final t in tabs)
                  NavigationRailDestination(
                    icon: Icon(t.$1),
                    selectedIcon: Icon(t.$2),
                    label: Text(t.$3),
                  ),
              ],
            ),
            const VerticalDivider(width: 1),
            // Pages size themselves from the width they are given, so tell them the rail is not part of it.
            Expanded(
              child: MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(size: Size(size.width - 81, size.height)),
                child: shell,
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: select,
        destinations: [
          for (final t in tabs)
            NavigationDestination(
              icon: Icon(t.$1),
              selectedIcon: Icon(t.$2),
              label: t.$3,
            ),
        ],
      ),
    );
  }
}
