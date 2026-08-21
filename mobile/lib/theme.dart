import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Visual language, matched to the web app's tokens (src/styles/tokens.css) so
/// the phone and the site are recognisably one product — same orange, same
/// slate neutrals, same status bands.
///
/// The shape language leans One UI: large collapsing titles, generous
/// 20px-radius cards, quiet dividers, and very little chrome. The rule
/// throughout is that surfaces are calm and only *state* carries colour.
class HandyColors {
  static const orange = Color(0xFFF97316);
  static const orangeDeep = Color(0xFFEA580C);

  // Light
  static const lightBg = Color(0xFFF6F7F9);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightBorder = Color(0xFFE9EDF3);
  static const lightText = Color(0xFF0F172A);
  static const lightMuted = Color(0xFF64748B);

  // Dark
  static const darkBg = Color(0xFF0A0F1A);
  static const darkSurface = Color(0xFF141C2B);
  static const darkBorder = Color(0xFF1F2A3D);
  static const darkText = Color(0xFFF1F5F9);
  static const darkMuted = Color(0xFF94A3B8);

  // Status bands — identical thresholds to getAttendanceStatus() on the web.
  static const good = Color(0xFF16A34A);
  static const warn = Color(0xFFD97706);
  static const bad = Color(0xFFDC2626);

  // The two extra bands topic mastery needs beyond good/warn/bad — matches
  // --color-info and --status-excellent in tokens.css exactly, so a "Learning"
  // or "Mastered" chip is the same colour on both platforms.
  static const info = Color(0xFF2563EB);
  static const excellent = Color(0xFF059669);
}

/// Attendance colour. Null means no class held yet, which is grey rather than
/// red — a fresh subject isn't failing.
Color statusColour(double? percent) {
  if (percent == null) return HandyColors.lightMuted;
  if (percent >= 75) return HandyColors.good;
  if (percent >= 65) return HandyColors.warn;
  return HandyColors.bad;
}

ThemeData handyTheme(Brightness brightness, [Color accent = HandyColors.orange]) {
  final dark = brightness == Brightness.dark;

  final bg = dark ? HandyColors.darkBg : HandyColors.lightBg;
  final surface = dark ? HandyColors.darkSurface : HandyColors.lightSurface;
  final border = dark ? HandyColors.darkBorder : HandyColors.lightBorder;
  final text = dark ? HandyColors.darkText : HandyColors.lightText;
  final muted = dark ? HandyColors.darkMuted : HandyColors.lightMuted;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: bg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: accent,
      brightness: brightness,
    ).copyWith(
      primary: accent,
      surface: surface,
      onSurface: text,
      outlineVariant: border,
      error: HandyColors.bad,
    ),
    dividerColor: border,
    splashFactory: InkSparkle.splashFactory,

    textTheme: Typography.material2021(platform: TargetPlatform.android)
        .black
        .apply(bodyColor: text, displayColor: text)
        .copyWith(
          // -0.5 tracking on large text is what stops big headings looking
          // like default Material.
          headlineMedium: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
            color: text,
          ),
          titleLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: text),
          titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: text),
          bodyMedium: TextStyle(fontSize: 14, color: text, height: 1.45),
          bodySmall: TextStyle(fontSize: 12.5, color: muted, height: 1.45),
          labelSmall: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.7,
            color: muted,
          ),
        ),

    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
        color: text,
      ),
      iconTheme: IconThemeData(color: text, size: 22),
    ),

    cardTheme: CardThemeData(
      elevation: 0,
      color: surface,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: border),
      ),
    ),

    // Filled, borderless fields: a One UI-ish look, and far calmer than
    // Material's default outlined boxes stacked down a form.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF1B2536) : const Color(0xFFEFF2F6),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: accent, width: 1.6),
      ),
      hintStyle: TextStyle(color: muted),
      labelStyle: TextStyle(color: muted),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
      ),
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: accent.withValues(alpha: 0.14),
      elevation: 0,
      height: 68,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 23,
          color: states.contains(WidgetState.selected) ? accent : muted,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          color: states.contains(WidgetState.selected) ? accent : muted,
        ),
      ),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: surface,
      side: BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      labelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: text),
    ),

    // Slide-up transitions rather than Material's default fade-through:
    // closer to how a One UI app moves between screens.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
