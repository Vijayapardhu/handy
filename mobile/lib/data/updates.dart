import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Whether there is a newer Handy to install, and how badly it is needed.
///
/// Handy is not on the Play Store, so nothing updates it on a student's behalf.
/// Without a check like this the only way anyone learns about a fix is being
/// told in person, and a bug shipped on Tuesday is still on half the phones in
/// December.
///
/// Reads the `appUpdates` collection the admin panel publishes to, rather than
/// asking GitHub directly. Two sources of truth for "what is the current
/// version" is how one of them quietly goes stale.
class AppUpdate {
  const AppUpdate({
    required this.version,
    required this.changelog,
    required this.downloadUrl,
    required this.required,
  });

  final String version;
  final String changelog;
  final String downloadUrl;

  /// The installed build is older than minSupportedVersion — it is not merely
  /// behind, it is expected to misbehave. The prompt for this one cannot be
  /// dismissed.
  final bool required;
}

class Updates {
  Updates(this._db);

  final FirebaseFirestore _db;

  static const _dismissedKey = 'handy.updateDismissed';

  /// The leading number in one dotted part, ignoring whatever decorates it.
  ///
  /// Versions are typed by a person in the admin panel, and 'v1.2.0' is what
  /// somebody copying a GitHub tag will paste. Parsing that part strictly gives
  /// zero, which makes the whole version 0.0.0 — older than every install, so
  /// nobody is ever told an update exists and the failure is completely silent.
  /// Same for a '1.2.0-beta' suffix.
  static int _part(String value) {
    final match = RegExp(r'\d+').firstMatch(value);
    return match == null ? 0 : int.parse(match.group(0)!);
  }

  /// Compares dotted versions numerically.
  ///
  /// String comparison gets this wrong exactly when it matters: '1.10.0' sorts
  /// before '1.9.0', so the release that fixes something looks older than the
  /// one that broke it. Missing parts count as zero, so '1.2' == '1.2.0'.
  static int compareVersions(String a, String b) {
    final left = a.split('.').map(_part).toList();
    final right = b.split('.').map(_part).toList();
    for (var i = 0; i < (left.length > right.length ? left.length : right.length); i++) {
      final l = i < left.length ? left[i] : 0;
      final r = i < right.length ? right[i] : 0;
      if (l != r) return l.compareTo(r);
    }
    return 0;
  }

  /// The newest Android release, or null when this build is already current.
  ///
  /// Never throws: an update check is the least important thing the app does on
  /// launch, and it must not be able to stop the app opening. A failed check
  /// just means asking again next time.
  Future<AppUpdate?> check({bool ignoreDismissed = false}) async {
    try {
      final info = await PackageInfo.fromPlatform();
      final installed = info.version;

      // Ordered client-side so the collection needs no composite index
      // alongside the platform filter, and the whole query stays one read.
      final snap = await _db
          .collection('appUpdates')
          .where('platform', isEqualTo: 'android')
          .get();
      if (snap.docs.isEmpty) return null;

      final latest = snap.docs
          .map((d) => d.data())
          .where((d) => (d['version'] as String?)?.isNotEmpty ?? false)
          .toList()
        ..sort((a, b) => compareVersions(b['version'] as String, a['version'] as String));

      final newest = latest.first;
      final version = newest['version'] as String;
      if (compareVersions(version, installed) <= 0) return null;

      final minSupported = newest['minSupportedVersion'] as String?;
      final mustUpdate =
          minSupported != null && compareVersions(installed, minSupported) < 0;

      // A dismissed version stays dismissed until a newer one arrives — asking
      // again every launch is how an update prompt becomes something people
      // learn to tap through without reading. A required update ignores this.
      if (!mustUpdate && !ignoreDismissed) {
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getString(_dismissedKey) == version) return null;
      }

      return AppUpdate(
        version: version,
        changelog: (newest['changelog'] as String?) ?? '',
        downloadUrl: (newest['downloadUrl'] as String?) ?? '',
        required: mustUpdate,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> dismiss(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dismissedKey, version);
  }
}
