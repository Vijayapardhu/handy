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
  static const _widgetFontKey = 'handy.widgetFont';
  static const _widgetTextColourKey = 'handy.widgetTextColour';
  static const _widgetBlocksKey = 'handy.widgetBlocks';
  static const _remindDeadlinesKey = 'handy.remindDeadlines';
  static const _remindClassesKey = 'handy.remindClasses';
  static const _notifyNewDataKey = 'handy.notifyNewData';
  static const _deadlineLeadKey = 'handy.deadlineLeadDays';
  static const _classLeadKey = 'handy.classLeadMinutes';
  static const _onboardedKey = 'handy.onboarded';

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

  WidgetFont widgetFont = WidgetFont.system;

  /// Empty means "whatever the palette says", which is the right default —
  /// each palette already pairs a background with text that stays legible on
  /// it, and picking the two independently is how people get white on white.
  String widgetTextColour = '';

  /// What Handy may interrupt for. All on by default: a reminder app whose
  /// reminders are off by default is a calendar you have to remember to read.
  bool remindDeadlines = true;
  bool remindClasses = true;
  bool notifyNewData = true;

  /// How many days before a deadline the first nudge arrives. The evening
  /// before is always sent as well and is not configurable — it is the one
  /// that stops something being forgotten outright.
  ///
  /// Two days suits an assignment and is useless for a lab record that takes
  /// a week, which is why this stopped being a constant.
  int deadlineLeadDays = 2;

  /// Minutes before a class starts. Fifteen is enough to get moving across
  /// campus; a student living on it wants five, one commuting wants thirty.
  int classLeadMinutes = 15;

  /// Which blocks the Overview widget shows, in order. This is the whole
  /// point of that widget, so it is a list rather than a set of switches.
  List<WidgetBlock> widgetBlocks = const [WidgetBlock.attendance, WidgetBlock.today];

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

    widgetFont = WidgetFont.values.firstWhere(
      (f) => f.name == prefs.getString(_widgetFontKey),
      orElse: () => WidgetFont.system,
    );
    widgetTextColour = prefs.getString(_widgetTextColourKey) ?? '';

    remindDeadlines = prefs.getBool(_remindDeadlinesKey) ?? true;
    remindClasses = prefs.getBool(_remindClassesKey) ?? true;
    notifyNewData = prefs.getBool(_notifyNewDataKey) ?? true;
    onboarded = prefs.getBool(_onboardedKey) ?? false;
    deadlineLeadDays = prefs.getInt(_deadlineLeadKey) ?? 2;
    classLeadMinutes = prefs.getInt(_classLeadKey) ?? 15;

    final blocks = prefs.getStringList(_widgetBlocksKey);
    if (blocks != null && blocks.isNotEmpty) {
      widgetBlocks = blocks
          .map((b) => WidgetBlock.values.where((v) => v.name == b).firstOrNull)
          .whereType<WidgetBlock>()
          .toList();
    }

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

  /// Whether the intro has been seen. False on a fresh install, and the reason
  /// the app opens on an explanation rather than on a sign-in form asking for a
  /// roll number that does not have an account yet.
  bool onboarded = false;

  Future<void> setOnboarded(bool value) async {
    onboarded = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardedKey, value);
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

  Future<void> setWidgetFont(WidgetFont font) async {
    widgetFont = font;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_widgetFontKey, font.name);
  }

  /// Empty string restores the palette's own text colour.
  Future<void> setWidgetTextColour(String hex) async {
    widgetTextColour = hex;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_widgetTextColourKey, hex);
  }

  Future<void> setRemindDeadlines(bool on) async {
    remindDeadlines = on;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_remindDeadlinesKey, on);
  }

  Future<void> setRemindClasses(bool on) async {
    remindClasses = on;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_remindClassesKey, on);
  }

  Future<void> setDeadlineLeadDays(int days) async {
    deadlineLeadDays = days;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_deadlineLeadKey, days);
  }

  Future<void> setClassLeadMinutes(int minutes) async {
    classLeadMinutes = minutes;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_classLeadKey, minutes);
  }

  Future<void> setNotifyNewData(bool on) async {
    notifyNewData = on;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_notifyNewDataKey, on);
  }

  Future<void> setWidgetBlocks(List<WidgetBlock> blocks) async {
    widgetBlocks = blocks;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_widgetBlocksKey, blocks.map((b) => b.name).toList());
  }
}

/// Typefaces the Android side can apply to a widget.
///
/// Restricted to families TypefaceSpan resolves on every version we support —
/// a bundled font would need a real Typeface, which RemoteViews cannot carry.
enum WidgetFont {
  system('System', 'default'),
  medium('Medium', 'medium'),
  light('Light', 'light'),
  condensed('Condensed', 'condensed'),
  serif('Serif', 'serif'),
  mono('Mono', 'mono');

  const WidgetFont(this.label, this.key);
  final String label;

  /// What the Kotlin side looks up; kept separate so labels can be reworded
  /// without invalidating everyone's saved preference.
  final String key;
}

/// A block on the Overview widget.
enum WidgetBlock {
  attendance('Attendance', 'The overall percentage and the count under it'),
  held('Classes held', 'Attended, held and missed, as a table'),
  today("Today's classes", 'Time, subject and room, lined up in columns'),
  next('Next class', 'What is coming and how long you have'),
  dues('Deadlines', 'What is due, soonest first');

  const WidgetBlock(this.label, this.detail);
  final String label;
  final String detail;
}

/// How the home-screen widgets are painted.
///
/// Each entry pairs a background with the text colours that stay legible on
/// it — see WidgetStyle.kt, which holds the matching half. Adding one here
/// without adding it there leaves the widget on the accent default rather
/// than crashing, which is the failure worth having.
enum WidgetStyle {
  accent('Sunset', Color(0xFFF97316)),
  dark('Dark', Color(0xFF0F172A)),
  light('Light', Color(0xFFFFFFFF)),
  midnight('Midnight', Color(0xFF0B1020)),
  forest('Forest', Color(0xFF14532D)),
  rose('Rose', Color(0xFF9F1239)),
  slate('Slate', Color(0xFF334155)),
  plum('Plum', Color(0xFF4C1D95));

  const WidgetStyle(this.label, this.swatch);
  final String label;
  final Color swatch;
}

/// Text colours a student can force over any palette. Empty means "follow the
/// palette", which is first because it is right nearly always.
const widgetTextColours = <({String label, String hex})>[
  (label: 'Auto', hex: ''),
  (label: 'White', hex: '#FFFFFF'),
  (label: 'Black', hex: '#0F172A'),
  (label: 'Amber', hex: '#FCD34D'),
  (label: 'Sky', hex: '#7DD3FC'),
  (label: 'Mint', hex: '#6EE7B7'),
  (label: 'Rose', hex: '#FDA4AF'),
];
