/// What this student's college actually gives Handy.
///
/// A direct port of `src/hooks/useCampusFeatures.ts`, and it has to stay one:
/// a student who sees a Timetable tab on their phone and none on their laptop
/// would reasonably conclude one of the two is broken.
///
/// AEC, ACET and AGBS are read by signing into their portal server-side, and
/// that portal exposes attendance and marks but no timetable and never names
/// the lecturer for a subject. So those students have no classes to be
/// reminded of, no free periods to plan around, and no class groups — a group
/// is timetable + subject + faculty, and without the faculty two lecturers'
/// rooms cannot be told apart.
///
/// Hiding those surfaces is the honest thing rather than leaving them empty. An
/// empty timetable reads as "nothing scheduled today", which is a claim about
/// the student's week. Absent reads as what it is: not something Handy can show
/// for this college.
library;

import 'campus.dart';

class CampusFeatures {
  const CampusFeatures({
    required this.campus,
    required this.hasTimetable,
    required this.hasClassGroups,
  });

  final Campus? campus;

  /// Timetable tab, next-class card, day progress, class reminders.
  final bool hasTimetable;

  /// Class-rep announcements and shared notes.
  final bool hasClassGroups;
}

/// Derived from the roll number rather than from the campus the student signed
/// in with, so it is right for every account that already exists without a
/// migration — and so it agrees with the web, which has only the roll number
/// to go on.
///
/// An unrecognised roll keeps everything. Someone Handy cannot place is far
/// more likely to be at the university than to be someone whose features
/// should quietly vanish. Note that this deliberately does not consult
/// [fallbackCampus]: guessing AGBS is right for *offering a password prompt*,
/// where the cost of a wrong guess is one failed attempt, and wrong for taking
/// a tab away.
CampusFeatures campusFeaturesFor(String? rollNumber) {
  final campus = rollNumber == null ? null : detectCampus(rollNumber);
  final limited = campus?.usesPortalLogin ?? false;
  return CampusFeatures(
    campus: campus,
    hasTimetable: !limited,
    hasClassGroups: !limited,
  );
}
