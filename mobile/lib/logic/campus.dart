/// Which college a roll number belongs to.
///
/// A direct port of `src/lib/campus.ts`. The two have to agree: the web app
/// decides whether to ask for a portal password, and so does this — a roll
/// number treated as AEC on a laptop and AUS on a phone gives one student two
/// different sign-in screens for the same account.
///
/// The discriminator is the three characters at index 2–4, the college code
/// embedded in Andhra Pradesh roll numbers. Shape cannot do it: the seeded demo
/// student `23A31A05B1` has exactly the same shape as `24A91A0501` (AEC) and
/// `23P31A0341` (ACET) and belongs to neither.
///
/// Getting this wrong is not cosmetic — a misrouted guess sends an AEC
/// student's password to ACET's portal. So an unrecognised roll number returns
/// null and the screen asks, rather than picking the nearest match.
///
/// Evidence, which is uneven and worth knowing:
///   AUS  `B\d\d`  strong — ten real accounts across two intakes.
///   AEC  `A9\d`   weak   — one observed roll, 24A91A0501.
///   ACET `P3\d`   weak   — one observed roll, 23P31A0341.
library;

enum Campus { aus, aec, acet }

extension CampusName on Campus {
  /// What /api/verify expects in its `campus` field.
  String get wire => switch (this) {
        Campus.aus => 'AUS',
        Campus.aec => 'AEC',
        Campus.acet => 'ACET',
      };

  String get label => switch (this) {
        Campus.aus => 'Aditya University',
        Campus.aec => 'AEC',
        Campus.acet => 'ACET',
      };

  /// Whether Handy can sign in to this portal server-side.
  ///
  /// AUS cannot: its portal enforces a domain-locked Cloudflare Turnstile, so
  /// those students use the browser extension and never type a college
  /// password. The others do, and that login is the identity check.
  bool get usesPortalLogin => this == Campus.aec || this == Campus.acet;
}

final _admissionNo = RegExp(r'^AUS\d{2}-\d+$');
final _ausCode = RegExp(r'^B\d{2}$');
final _aecCode = RegExp(r'^A9\d$');
final _acetCode = RegExp(r'^P3\d$');

/// The campus, or null when the roll number does not say clearly.
Campus? detectCampus(String rollNumber) {
  final roll = rollNumber.trim().toUpperCase();
  if (roll.length < 5) return null;

  // Admission numbers name the campus outright.
  if (_admissionNo.hasMatch(roll)) return Campus.aus;

  final code = roll.substring(2, 5);
  if (_ausCode.hasMatch(code)) return Campus.aus;
  if (_aecCode.hasMatch(code)) return Campus.aec;
  if (_acetCode.hasMatch(code)) return Campus.acet;

  // Includes the demo student's A31. Unknown is a real answer.
  return null;
}
