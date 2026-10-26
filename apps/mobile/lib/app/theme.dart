import 'package:flutter/material.dart';

/// Material 3 themes built from the Rento logo: its orange (`#EF8E30`), warm neutrals and a warm near-black "ink".
/// White text on that orange is only 2.6:1, so text and icons ON the brand orange are ink (7:1); orange used as TEXT
/// on a light surface is the deeper [brandText]. The look follows from these few values (Q-13).
abstract final class AppTheme {
  /// The orange of the logo.
  static const Color seed = Color(0xFFEF8E30);

  /// Text and icons on the brand orange.
  static const Color ink = Color(0xFF1F1408);

  /// Brand orange used as text on a light surface (5.5:1 on white); the light orange on dark surfaces.
  static Color brandText(Brightness b) =>
      b == Brightness.light ? const Color(0xFFB34700) : const Color(0xFFF7A857);

  /// The blue tick of a verified person, and the amber of "in review".
  static const Color verified = Color(0xFF1D7FEA);
  static const Color warning = Color(0xFFB45309);

  /// Green of "open now" / "available".
  static const Color success = Color(0xFF138A4B);

  /// The brand gradient: logo orange, a touch lighter at the top left. Put [ink] on it.
  static List<Color> brandGradient(bool dark) =>
      dark
          ? const [Color(0xFFE98425), Color(0xFFD96E12)]
          : const [Color(0xFFF7A24B), Color(0xFFEF8E30)];

  /// Colour for text and icons placed on [brandGradient].
  static const Color onBrand = ink;

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final light = brightness == Brightness.light;
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    ).copyWith(
      primary: light ? seed : const Color(0xFFF59A3E),
      onPrimary: ink,
      primaryContainer:
          light ? const Color(0xFFFFE7CF) : const Color(0xFF5A2B05),
      onPrimaryContainer:
          light ? const Color(0xFF4A2200) : const Color(0xFFFFDFC0),
      secondary: light ? const Color(0xFF5E4B3A) : const Color(0xFFE2C9B0),
      secondaryContainer:
          light ? const Color(0xFFF7ECDF) : const Color(0xFF3A2D22),
      onSecondaryContainer:
          light ? const Color(0xFF2B1D10) : const Color(0xFFF5E3D0),
      surface: light ? const Color(0xFFFFFAF5) : const Color(0xFF16100A),
      onSurface: light ? ink : const Color(0xFFF7EDE2),
      onSurfaceVariant:
          light ? const Color(0xFF65564A) : const Color(0xFFCDBBAA),
      surfaceContainerLowest: light ? Colors.white : const Color(0xFF1D1610),
      surfaceContainerLow:
          light ? const Color(0xFFFFF4E9) : const Color(0xFF211912),
      surfaceContainer:
          light ? const Color(0xFFFBEEDF) : const Color(0xFF281F17),
      surfaceContainerHigh:
          light ? const Color(0xFFF6E7D5) : const Color(0xFF31271D),
      surfaceContainerHighest:
          light ? const Color(0xFFF0DEC8) : const Color(0xFF3B2F24),
      outline: light ? const Color(0xFF857463) : const Color(0xFF9C8A78),
      outlineVariant: light ? const Color(0xFFEBDDCD) : const Color(0xFF45382B),
    );
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: 'Poppins',
      visualDensity: VisualDensity.adaptivePlatformDensity,
    );
    final text = base.textTheme;
    final shape16 = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
    );

    return base.copyWith(
      scaffoldBackgroundColor: scheme.surface,
      textTheme: text.copyWith(
        headlineMedium: text.headlineMedium?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        headlineSmall: text.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        titleLarge: text.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
        ),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        titleTextStyle: text.titleLarge?.copyWith(
          color: scheme.onSurface,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 12),
        clipBehavior: Clip.antiAlias,
        surfaceTintColor: Colors.transparent,
        color: scheme.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.8)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 52),
          shape: shape16,
          textStyle: const TextStyle(
            fontFamily: 'Poppins',
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 52),
          shape: shape16,
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: scheme.outline.withValues(alpha: 0.55)),
          textStyle: const TextStyle(
            fontFamily: 'Poppins',
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppTheme.brandText(brightness),
          shape: shape16,
          textStyle: const TextStyle(
            fontFamily: 'Poppins',
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: const StadiumBorder(),
        side: BorderSide(color: scheme.outlineVariant),
        selectedColor: scheme.primaryContainer,
        labelStyle: TextStyle(
          fontFamily: 'Poppins',
          fontWeight: FontWeight.w500,
          color: scheme.onSurface,
        ),
        secondaryLabelStyle: TextStyle(
          fontFamily: 'Poppins',
          fontWeight: FontWeight.w700,
          color: scheme.onPrimaryContainer,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: scheme.surfaceContainerLowest,
        indicatorColor: scheme.primaryContainer,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color:
                states.contains(WidgetState.selected)
                    ? scheme.onPrimaryContainer
                    : scheme.onSurfaceVariant,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight:
                states.contains(WidgetState.selected)
                    ? FontWeight.w700
                    : FontWeight.w500,
          ),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: scheme.onSurface,
        unselectedLabelColor: scheme.onSurfaceVariant,
        indicatorColor: scheme.primary,
        dividerColor: scheme.outlineVariant.withValues(alpha: 0.5),
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.primaryContainer,
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: scheme.onSurface),
      ),
      listTileTheme: ListTileThemeData(shape: shape16),
      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: shape16,
      ),
    );
  }
}
