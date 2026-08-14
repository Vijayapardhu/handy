import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Accent choices. The palette is deliberately small and all of it works on
/// both grounds — a picker with thirty swatches mostly offers thirty ways to
/// make the app look worse.
enum AccentChoice {
  orange('Sunset', Color(0xFFF97316)),
  indigo('Indigo', Color(0xFF6366F1)),
  teal('Teal', Color(0xFF0D9488)),
  rose('Rose', Color(0xFFE11D48)),
  violet('Violet', Color(0xFF8B5CF6));

  const AccentChoice(this.label, this.colour);
  final String label;
  final Color colour;
}

/// Theme preferences, persisted so the app opens the way it was left.
///
/// Named AppSettings rather than Settings because cloud_firestore exports a
/// Settings of its own, and the clash is silent until it is not.
class AppSettings extends ChangeNotifier {
  static const _themeKey = 'handy.themeMode';
  static const _accentKey = 'handy.accent';
  static const _nameKey = 'handy.preferredName';
  static const _widgetStyleKey = 'handy.widgetStyle';
  static const _widgetFacultyKey = 'handy.widgetFaculty';
  static const _widgetRowsKey = 'handy.widgetRows';

  ThemeMode themeMode = ThemeMode.system;
  AccentChoice accent = AccentChoice.orange;

  /// What the student wants to be called on the home screen.
  ///
  /// The portal gives a full legal name in caps — "MAGAPU VIJAYA PARDHU" —
  /// which is nobody's actual name for themselves. Empty means fall back to
  /// the first word of the official one.
  String preferredName = '';

  /// Home-screen widget appearance and content.
  ///
  /// Widgets run in the launcher's process and can't read the app's theme, so
  /// these are pushed across as plain values for the Kotlin providers to read
  /// (see AppState.pushToWidget).
  WidgetStyle widgetStyle = WidgetStyle.accent;
  bool widgetShowFaculty = true;

  /// How many rows the list widgets draw. Fewer rows, bigger text.
  int widgetRows = 4;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();

    final theme = prefs.getString(_themeKey);
    themeMode = ThemeMode.values.firstWhere(
      (m) => m.name == theme,
      orElse: () => ThemeMode.system,
    );

    final accentName = prefs.getString(_accentKey);
    accent = AccentChoice.values.firstWhere(
      (a) => a.name == accentName,
      orElse: () => AccentChoice.orange,
    );

    preferredName = prefs.getString(_nameKey) ?? '';

    widgetStyle = WidgetStyle.values.firstWhere(
      (w) => w.name == prefs.getString(_widgetStyleKey),
      orElse: () => WidgetStyle.accent,
    );
    widgetShowFaculty = prefs.getBool(_widgetFacultyKey) ?? true;
    widgetRows = prefs.getInt(_widgetRowsKey) ?? 4;

    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, mode.name);
  }

  Future<void> setAccent(AccentChoice choice) async {
    accent = choice;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accentKey, choice.name);
  }

  Future<void> setPreferredName(String name) async {
    preferredName = name.trim();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_nameKey, preferredName);
  }

  /// The name to greet with: what they chose, else the first word of the
  /// official one, else nothing.
  String greetingName(String? officialName) {
    if (preferredName.isNotEmpty) return preferredName;
    final first = (officialName ?? '').trim().split(RegExp(r'\s+')).first;
    if (first.isEmpty) return '';
    // Title-case the portal's shouting: MAGAPU -> Magapu.
    return first[0].toUpperCase() + first.substring(1).toLowerCase();
  }

  Future<void> setWidgetStyle(WidgetStyle style) async {
    widgetStyle = style;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_widgetStyleKey, style.name);
  }

  Future<void> setWidgetShowFaculty(bool show) async {
    widgetShowFaculty = show;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_widgetFacultyKey, show);
  }

  Future<void> setWidgetRows(int rows) async {
    widgetRows = rows;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_widgetRowsKey, rows);
  }
}

/// How the home-screen widgets are painted.
enum WidgetStyle {
  /// Filled with the app's accent — loud, reads at a glance.
  accent('Colour'),

  /// Dark card with a hairline border — quieter on a busy wallpaper.
  dark('Dark');

  const WidgetStyle(this.label);
  final String label;
}
