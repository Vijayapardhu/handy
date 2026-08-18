/// "Hub" attendance — CodeForge and skills-hour sessions tracked by Aditya
/// University's separate Maya platform, not by Campus Connect.
///
/// A port of src/types/hubAttendance.ts. Maya has no per-day attendance record
/// the way Handy's own `attendance` collection does: it counts sessions per
/// topic, within a module, within a course a student is enrolled in. These
/// types mirror *that* shape rather than being bent into Handy's attendance
/// model, because the two are genuinely different data and pretending
/// otherwise would mean inventing days that were never recorded.
library;

/// Every field below comes out of a scrape of Maya, so nothing is read with a
/// cast that can throw. A `as String?` against an id that came back as a
/// number would raise a TypeError out of the middle of parsing — not a
/// HubException — and take the whole screen with it rather than the one field
/// that surprised us. This renders what arrived instead.
String _str(Object? value) => value == null ? '' : '$value';

int _int(Object? value) => switch (value) {
      num n => n.toInt(),
      String s => int.tryParse(s) ?? 0,
      _ => 0,
    };

double? _percent(Object? value) => switch (value) {
      num n => n.toDouble(),
      String s => double.tryParse(s),
      _ => null,
    };

class HubTopic {
  const HubTopic({
    required this.topicName,
    required this.totalSessions,
    required this.attendedCount,
  });

  final String topicName;
  final int totalSessions;
  final int attendedCount;

  factory HubTopic.fromMap(Map<String, dynamic> d) => HubTopic(
        topicName: _str(d['topicName']),
        totalSessions: _int(d['totalSessions']),
        attendedCount: _int(d['attendedCount']),
      );
}

class HubModule {
  const HubModule({
    required this.moduleId,
    required this.moduleName,
    required this.topics,
    required this.totalSessions,
    required this.attendedSessions,
  });

  final String moduleId;
  final String moduleName;
  final List<HubTopic> topics;
  final int totalSessions;
  final int attendedSessions;

  /// Whether this module has run at all. A course carries modules the student
  /// has not reached yet, and 0/0 is not 0% — it is "not started".
  bool get started => totalSessions > 0;

  /// A single topic named after the module says nothing the module did not
  /// already say, so it is not worth a second line.
  bool get hasDistinctTopics {
    if (topics.length > 1) return true;
    if (topics.isEmpty) return false;
    return topics.first.topicName.trim().toLowerCase() != moduleName.trim().toLowerCase();
  }

  factory HubModule.fromMap(Map<String, dynamic> d) => HubModule(
        moduleId: _str(d['moduleId']),
        moduleName: _str(d['moduleName']),
        topics: [
          for (final t in (d['topics'] as List? ?? const []))
            HubTopic.fromMap((t as Map).cast<String, dynamic>()),
        ],
        totalSessions: _int(d['totalSessions']),
        attendedSessions: _int(d['attendedSessions']),
      );
}

class HubCourse {
  const HubCourse({
    required this.batchId,
    required this.technologyId,
    required this.courseName,
    required this.technologyName,
    required this.modules,
    required this.totalSessions,
    required this.attendedSessions,
    required this.percentage,
  });

  /// batchId and technologyId together are the key: a student can be enrolled
  /// in the same course across separate batches, and only the pair tells them
  /// apart. See aggregateHubCourse in api/_hubPortal.js.
  final String batchId;
  final String technologyId;
  final String courseName;
  final String technologyName;
  final List<HubModule> modules;
  final int totalSessions;
  final int attendedSessions;

  /// Null when nothing has been held yet — there is nothing to divide by.
  final double? percentage;

  String get key => '${batchId}_$technologyId';

  String get title => technologyName.isNotEmpty
      ? technologyName
      : (courseName.isNotEmpty ? courseName : 'Course');

  /// The course name only when it says something the title did not.
  String? get subtitle =>
      courseName.isNotEmpty && courseName != technologyName ? courseName : null;

  List<HubModule> get started => modules.where((m) => m.started).toList();
  List<HubModule> get upcoming => modules.where((m) => !m.started).toList();

  /// Whether this is a CodeForge course rather than one of the other things
  /// Maya tracks in the same place.
  ///
  /// A student's Maya enrolment covers CodeForge *and* the ability courses —
  /// Arithmetic, Logical, Verbal — and the platform reports them all through one
  /// list. Summing the lot gave a figure that was not any one thing: a good
  /// CodeForge record could be dragged under by a Verbal Ability course the
  /// student never thought of as CodeForge at all.
  ///
  /// Matched loosely on purpose. The data holds `courseName: "CODEFORGE"` with
  /// `technologyName: "CodeForge-Intermediate"`, but the levels are written
  /// inconsistently — "CodeForge - Beginner", "CodeForge-Intermediate" — so
  /// case and separators are stripped before comparing rather than trusted.
  bool get isCodeForge =>
      _squashed(courseName).contains('CODEFORGE') ||
      _squashed(technologyName).contains('CODEFORGE');

  static String _squashed(String value) =>
      value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

  factory HubCourse.fromMap(Map<String, dynamic> d) => HubCourse(
        batchId: _str(d['batchId']),
        technologyId: _str(d['technologyId']),
        // Both arrive as null for a course Maya did not name.
        courseName: _str(d['courseName']),
        technologyName: _str(d['technologyName']),
        modules: [
          for (final m in (d['modules'] as List? ?? const []))
            HubModule.fromMap((m as Map).cast<String, dynamic>()),
        ],
        totalSessions: _int(d['totalSessions']),
        attendedSessions: _int(d['attendedSessions']),
        percentage: _percent(d['percentage']),
      );
}

class HubAttendanceSnapshot {
  const HubAttendanceSnapshot({
    required this.studentName,
    required this.rollNumber,
    required this.courses,
    required this.totalSessions,
    required this.attendedSessions,
    required this.percentage,
    required this.fetchedAt,
  });

  final String? studentName;
  final String? rollNumber;
  final List<HubCourse> courses;
  final int totalSessions;
  final int attendedSessions;
  final double? percentage;
  final DateTime? fetchedAt;

  /// Just the CodeForge courses — Beginner, Intermediate, Advanced.
  ///
  /// What every headline figure is built from. See HubCourse.isCodeForge for
  /// why the ability courses are excluded.
  List<HubCourse> get codeForgeCourses => courses.where((c) => c.isCodeForge).toList();

  /// The other things Maya tracks under the same login. Still listed on the
  /// breakdown screen — they are real courses and a student wants to see them
  /// — they just do not feed the CodeForge percentage.
  List<HubCourse> get otherCourses => courses.where((c) => !c.isCodeForge).toList();

  int get codeForgeAttended =>
      codeForgeCourses.fold(0, (sum, c) => sum + c.attendedSessions);

  int get codeForgeTotal => codeForgeCourses.fold(0, (sum, c) => sum + c.totalSessions);

  /// CodeForge attendance, and only CodeForge.
  ///
  /// Null when nothing has been held — or when this student has no CodeForge
  /// course at all, which is a real case and honestly answered with "—" rather
  /// than with an ability-course figure wearing a CodeForge label.
  double? get codeForgePercentage {
    final total = codeForgeTotal;
    if (total == 0) return null;
    return (codeForgeAttended / total) * 100;
  }

  /// Courses that have actually run, worst first — the one most worth looking
  /// at is the one already on screen. Ones that have not started trail behind
  /// in name order, since they have no percentage to be sorted by.
  List<HubCourse> get sortedCourses {
    final sorted = [...courses];
    sorted.sort((a, b) {
      final aStarted = a.percentage != null;
      final bStarted = b.percentage != null;
      if (aStarted != bStarted) return aStarted ? -1 : 1;
      if (aStarted && bStarted) return a.percentage!.compareTo(b.percentage!);
      return a.technologyName.compareTo(b.technologyName);
    });
    return sorted;
  }

  factory HubAttendanceSnapshot.fromMap(Map<String, dynamic> d) => HubAttendanceSnapshot(
        studentName: d['studentName'] == null ? null : _str(d['studentName']),
        rollNumber: d['rollNumber'] == null ? null : _str(d['rollNumber']),
        courses: [
          for (final c in (d['courses'] as List? ?? const []))
            HubCourse.fromMap((c as Map).cast<String, dynamic>()),
        ],
        totalSessions: _int(d['totalSessions']),
        attendedSessions: _int(d['attendedSessions']),
        percentage: _percent(d['percentage']),
        fetchedAt: DateTime.tryParse(_str(d['fetchedAt']))?.toLocal(),
      );
}

/// What a Hub call came back with.
///
/// `linked: false` is an answer, not a failure — it is what a student who has
/// never connected the Hub gets, and the screen renders a connect prompt
/// rather than an error.
class HubAttendanceResult {
  const HubAttendanceResult({required this.linked, required this.snapshot});

  final bool linked;
  final HubAttendanceSnapshot? snapshot;
}
