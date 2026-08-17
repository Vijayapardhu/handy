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
///
/// AGBS (Aditya Global Business School) runs on the same portal but shares
/// AEC's college code (A9) and ACET's (P3); only the program marker at index 5
/// separates a management roll (`M`/`E`, e.g. 23A91M0035, 18P31M0013) from a
/// B.Tech one (`A`). It also issues non-JNTU admission numbers (numeric like
/// 240218301030, or PGDM like 13PGDM005) that match no code — [detectCampus]
/// returns null for those, and [fallbackCampus] makes AGBS the last resort so
/// the phone tries it automatically without offering a button.
library;

enum Campus { aus, aec, acet, agbs }

extension CampusName on Campus {
  /// What /api/verify expects in its `campus` field.
  String get wire => switch (this) {
        Campus.aus => 'AUS',
        Campus.aec => 'AEC',
        Campus.acet => 'ACET',
        Campus.agbs => 'AGBS',
      };

  String get label => switch (this) {
        Campus.aus => 'Aditya University',
        Campus.aec => 'AEC',
        Campus.acet => 'ACET',
        Campus.agbs => 'AGBS',
      };

  /// Whether Handy can sign in to this portal server-side.
  ///
  /// AUS cannot: its portal enforces a domain-locked Cloudflare Turnstile, so
  /// those students use the browser extension and never type a college
  /// password. The others do, and that login is the identity check.
  bool get usesPortalLogin =>
      this == Campus.aec || this == Campus.acet || this == Campus.agbs;
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

  // AGBS shares AEC's (A9) and ACET's (P3) code; the M/E program marker at
  // index 5 is what tells its management rolls from a B.Tech one. Checked first
  // so those are not swallowed by the B.Tech rules below.
  final program = roll.length > 5 ? roll[5] : '';
  if ((_aecCode.hasMatch(code) || _acetCode.hasMatch(code)) &&
      (program == 'M' || program == 'E')) {
    return Campus.agbs;
  }

  if (_ausCode.hasMatch(code)) return Campus.aus;
  if (_aecCode.hasMatch(code)) return Campus.aec;
  if (_acetCode.hasMatch(code)) return Campus.acet;

  // Includes the demo student's A31. Unknown is a real answer.
  return null;
}

/// The campus to *try* when [detectCampus] cannot say — the last resort, not a
/// confident answer.
///
/// AGBS is that resort: its admission numbers (numeric or PGDM) match no
/// college code, so an unrecognised roll is far more likely to be an AGBS
/// student than anything else Handy signs into. The phone uses this to go
/// straight to the portal password prompt instead of asking, so there is no
/// AGBS button anywhere.
///
/// It never fires for an AUS-shaped roll. AUS signs in through the extension
/// with no portal password, so sending one of those students to a portal login
/// would be both wrong and a dead end — better to fall through to the campus
/// question than to guess AGBS.
Campus? fallbackCampus(String rollNumber) {
  final roll = rollNumber.trim().toUpperCase();
  if (roll.length < 8) return null;
  if (detectCampus(roll) != null) return null;
  if (_looksLikeAus(roll)) return null;
  return Campus.agbs;
}

/// A roll that reads as Aditya University even though [detectCampus] did not
/// pin it down — the college code position holds AUS's `B`, or it is an
/// `AUS…` admission number. Kept deliberately loose: this only has to hold the
/// AGBS fallback back, and the real detection above already handles the clean
/// cases.
bool _looksLikeAus(String roll) =>
    roll.startsWith('AUS') || (roll.length > 2 && roll[2] == 'B');
