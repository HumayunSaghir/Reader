import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand colors shared with the web app (frontend/src/index.css).
@immutable
class ReaderColors extends ThemeExtension<ReaderColors> {
  const ReaderColors({
    required this.background,
    required this.surface,
    required this.accent,
    required this.border,
    required this.text,
    required this.muted,
    required this.button,
    required this.onButton,
    required this.star,
    required this.success,
    required this.danger,
    required this.skeleton,
    required this.skeletonShine,
  });

  final Color background;
  final Color surface;
  final Color accent;
  final Color border;
  final Color text;
  final Color muted;
  final Color button;
  final Color onButton;
  final Color star;
  final Color success;
  final Color danger;
  final Color skeleton;
  final Color skeletonShine;

  static const light = ReaderColors(
    background: Color(0xFFFFFFFF),
    surface: Color(0xFFF4F5F4),
    accent: Color(0xFFCCFBC0),
    border: Color(0xFFE2E4E2),
    text: Color(0xFF0C1A11),
    muted: Color(0xFF575F5A),
    button: Color(0xFF0C1A11),
    onButton: Color(0xFFFFFFFF),
    star: Color(0xFFF59E0B),
    success: Color(0xFF16A34A),
    danger: Color(0xFFDC2626),
    skeleton: Color(0xFFECEEEC),
    skeletonShine: Color(0xFFF6F7F6),
  );

  static const dark = ReaderColors(
    background: Color(0xFF09130D),
    surface: Color(0xFF0D1C13),
    accent: Color(0xFF213B28),
    border: Color(0xFF1A2E20),
    text: Color(0xFFEAFCE4),
    muted: Color(0xFF8F9E94),
    button: Color(0xFFCCFBC0),
    onButton: Color(0xFF09130D),
    star: Color(0xFFF59E0B),
    success: Color(0xFF4ADE80),
    danger: Color(0xFFF87171),
    skeleton: Color(0xFF11241A),
    skeletonShine: Color(0xFF183224),
  );

  @override
  ReaderColors copyWith() => this;

  @override
  ReaderColors lerp(ReaderColors? other, double t) => t < 0.5 ? this : (other ?? this);
}

extension ReaderThemeX on BuildContext {
  ReaderColors get colors => Theme.of(this).extension<ReaderColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
}

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.light ? ReaderColors.light : ReaderColors.dark;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.button,
    onPrimary: c.onButton,
    secondary: c.accent,
    onSecondary: c.text,
    surface: c.background,
    onSurface: c.text,
    surfaceContainerHighest: c.surface,
    surfaceContainerHigh: c.surface,
    surfaceContainer: c.surface,
    surfaceContainerLow: c.background,
    onSurfaceVariant: c.muted,
    outline: c.border,
    outlineVariant: c.border,
    error: c.danger,
    onError: Colors.white,
  );

  // google_fonts' TextTheme helpers target the standalone material_ui package,
  // so apply the font family to Flutter's own TextTheme instead
  final body = ThemeData(brightness: brightness)
      .textTheme
      .apply(fontFamily: GoogleFonts.inter().fontFamily, bodyColor: c.text, displayColor: c.text);
  TextStyle heading(TextStyle? base, double size, {FontWeight weight = FontWeight.w800}) =>
      GoogleFonts.plusJakartaSans(textStyle: base, fontSize: size, fontWeight: weight, color: c.text, letterSpacing: -0.4, height: 1.15);

  final textTheme = body.copyWith(
    displaySmall: heading(body.displaySmall, 32),
    headlineMedium: heading(body.headlineMedium, 26),
    headlineSmall: heading(body.headlineSmall, 22),
    titleLarge: heading(body.titleLarge, 19, weight: FontWeight.w700),
    titleMedium: body.titleMedium?.copyWith(fontWeight: FontWeight.w600),
    bodyMedium: body.bodyMedium?.copyWith(height: 1.5),
    bodyLarge: body.bodyLarge?.copyWith(height: 1.6),
  );

  final radius = BorderRadius.circular(10);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.background,
    textTheme: textTheme,
    extensions: [c],
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: c.background,
      foregroundColor: c.text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: heading(body.titleLarge, 20),
    ),
    dividerTheme: DividerThemeData(color: c.border, space: 1, thickness: 1),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.button,
        foregroundColor: c.onButton,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.text,
        minimumSize: const Size(48, 48),
        side: BorderSide(color: c.border),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: c.text, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: TextStyle(color: c.muted),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c.border)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c.border)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c.text, width: 1.5)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.background,
      selectedColor: c.button,
      labelStyle: TextStyle(color: c.text, fontWeight: FontWeight.w600, fontSize: 13),
      secondaryLabelStyle: TextStyle(color: c.onButton, fontWeight: FontWeight.w600, fontSize: 13),
      side: BorderSide(color: c.border),
      shape: const StadiumBorder(),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      indicatorColor: c.accent,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? c.text : c.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? c.text : c.muted,
          )),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.text,
      contentTextStyle: TextStyle(color: c.background, fontWeight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: radius),
    ),
    dialogTheme: DialogThemeData(backgroundColor: c.background, surfaceTintColor: Colors.transparent),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.text, linearTrackColor: c.border),
    tabBarTheme: TabBarThemeData(
      labelColor: c.text,
      unselectedLabelColor: c.muted,
      indicatorColor: c.text,
      dividerColor: c.border,
      labelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}
