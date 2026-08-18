/// Firestore document shapes, mirroring src/types/*.ts in the web app.
///
/// The phone only ever reads these — capture and import happen on the desktop
/// extension — with the single exception of tasks, which the student authors.
library;

class Student {
  const Student({
    required this.id,
    required this.rollNumber,
    required this.name,
    required this.department,
    required this.course,
    required this.year,
    required this.section,
    required this.semesterId,
    required this.collegeId,
    required this.photoUrl,
    required this.profileComplete,
    this.updatedAt,
  });

  final String id;
  final String rollNumber;
  final String name;
  final String department;
  final String course;
  final int year;
  final String section;
  final String semesterId;
  final String collegeId;
  final String? photoUrl;
  final bool profileComplete;

  /// ISO timestamp of the last write, which for these documents means the last
  /// sync from the portal. Used as the cut-off for self-marked attendance, so
  /// a class the portal has already counted is not counted again.
  final String? updatedAt;

  factory Student.fromMap(String id, Map<String, dynamic> d) => Student(
        id: id,
        rollNumber: d['rollNumber'] as String? ?? '',
        name: d['name'] as String? ?? '',
        department: d['department'] as String? ?? '',
        course: d['course'] as String? ?? '',
        year: (d['year'] as num?)?.toInt() ?? 0,
        section: d['section'] as String? ?? '',
        semesterId: d['semesterId'] as String? ?? '',
        collegeId: d['collegeId'] as String? ?? '',
        photoUrl: d['photoUrl'] as String?,
        profileComplete: d['profileComplete'] as bool? ?? false,
        updatedAt: d['updatedAt'] as String?,
      );
}

class Subject {
  const Subject({
    required this.id,
    required this.code,
    required this.name,
    required this.shortName,
    required this.facultyName,
    this.facultyId = '',
    this.targetAttendance,
  });

  final String id;
  final String code;
  final String name;
  final String shortName;
  final String facultyName;

  /// Which lecturer, as the portal numbers them.
  ///
  /// Carried because it is half of what identifies a *class* rather than a
  /// subject: two students on the same timetable taking the same elective sit
  /// in different rooms with different reps, and only this tells them apart.
  final String facultyId;

  /// This subject's own minimum, when it has been given one.
  ///
  /// Null is the normal answer and means "whatever the college requires" — the
  /// caller resolves it against the college config rather than this defaulting
  /// to 75, because a subject that quietly claimed a target it had not been
  /// given would be indistinguishable from one that really had it. See
  /// AppState.targetFor, which mirrors subjectService.ts.
  final double? targetAttendance;

  factory Subject.fromMap(String id, Map<String, dynamic> d) => Subject(
        id: id,
        code: d['code'] as String? ?? '',
        name: d['name'] as String? ?? '',
        shortName: d['shortName'] as String? ?? '',
        facultyName: d['facultyName'] as String? ?? '',
        facultyId: d['facultyId'] as String? ?? '',
        targetAttendance: (d['targetAttendance'] as num?)?.toDouble(),
      );
}

/// Running totals per subject. The portal publishes only these — never which
/// individual days were attended.
class AttendanceSummary {
  const AttendanceSummary({required this.subjectId, required this.attended, required this.held});

  final String subjectId;
  final int attended;
  final int held;

  factory AttendanceSummary.fromMap(Map<String, dynamic> d) => AttendanceSummary(
        subjectId: d['subjectId'] as String? ?? '',
        attended: (d['attended'] as num?)?.toInt() ?? 0,
        held: (d['held'] as num?)?.toInt() ?? 0,
      );
}

enum TaskKind { assignment, presentation, exam, record, other }

const taskKindLabels = {
  TaskKind.assignment: 'Assignment',
  TaskKind.presentation: 'Presentation',
  TaskKind.exam: 'Exam',
  TaskKind.record: 'Record / Lab',
  TaskKind.other: 'Reminder',
};

/// How often a deadline comes back. Weekly lab records and daily reading are
/// the two that actually recur in a semester; the rest is padding.
enum TaskRepeat { none, daily, weekly, fortnightly, monthly }

const taskRepeatLabels = {
  TaskRepeat.none: 'Does not repeat',
  TaskRepeat.daily: 'Every day',
  TaskRepeat.weekly: 'Every week',
  TaskRepeat.fortnightly: 'Every two weeks',
  TaskRepeat.monthly: 'Every month',
};

/// One step inside a deadline.
///
/// "Lab record" is never one action — it is write it up, print it, get it
/// signed — and a single checkbox for the lot means it stays unticked until
/// the last minute, which is exactly when it stops being useful.
class Subtask {
  const Subtask({required this.title, required this.done});

  final String title;
  final bool done;

  Subtask copyWith({String? title, bool? done}) =>
      Subtask(title: title ?? this.title, done: done ?? this.done);

  Map<String, dynamic> toMap() => {'title': title, 'done': done};

  factory Subtask.fromMap(Map<String, dynamic> d) => Subtask(
        title: d['title'] as String? ?? '',
        done: d['done'] as bool? ?? false,
      );
}

/// The one thing the student authors rather than the portal.
class Task {
  const Task({
    required this.id,
    required this.title,
    required this.notes,
    required this.kind,
    required this.dueDate,
    required this.dueTime,
    required this.subjectId,
    required this.done,
    this.subtasks = const [],
    this.repeat = TaskRepeat.none,
    this.attachDay,
    this.attachTime,
    this.attachLabel,
    this.leadDays,
    this.completedAt,
  });

  final String id;
  final String title;
  final String notes;
  final TaskKind kind;
  final DateTime dueDate;
  final String? dueTime;
  final String? subjectId;
  final bool done;
  final List<Subtask> subtasks;
  final TaskRepeat repeat;

  /// The timetable slot this is pinned to, as a weekday (0=Sunday, matching
  /// DateTime.weekday % 7) and a start time.
  ///
  /// Stored as day-and-time rather than as a timetable entry id on purpose:
  /// entry ids are rebuilt on every sync and change when the published version
  /// does, so a pinned deadline would quietly come unpinned the next time the
  /// college republished the timetable. A day and a clock time survive that.
  final int? attachDay;
  final String? attachTime;

  /// What that slot is, in words — "Free period" or a subject's short name.
  ///
  /// Stored rather than looked up, because a pin can outlive the timetable it
  /// was made against: the college republishes, the slot becomes something
  /// else, and a pin that silently renamed itself would be lying about what
  /// the student chose.
  final String? attachLabel;

  /// Days before the due date for this deadline's first nudge.
  ///
  /// Null means "use whatever the student set as their default". A lab record
  /// wants a week and an assignment wants two days, and forcing one number on
  /// both makes the early one noise and the late one useless.
  final int? leadDays;

  /// ISO timestamp of when this was ticked off. Written since the beginning
  /// but never read until there was a record to build from it — which is why
  /// tasks completed earlier have one and older ones may not.
  final String? completedAt;

  bool get isAttached => attachDay != null && attachTime != null;

  int get subtasksDone => subtasks.where((s) => s.done).length;

  factory Task.fromMap(String id, Map<String, dynamic> d) => Task(
        id: id,
        title: d['title'] as String? ?? '',
        notes: d['notes'] as String? ?? '',
        kind: TaskKind.values.firstWhere(
          (k) => k.name == d['kind'],
          orElse: () => TaskKind.other,
        ),
        dueDate: DateTime.parse(d['dueDate'] as String? ?? '1970-01-01'),
        dueTime: d['dueTime'] as String?,
        subjectId: d['subjectId'] as String?,
        done: d['done'] as bool? ?? false,
        // Both are additive: documents written before these existed, and
        // documents written by the web app, simply have neither.
        subtasks: ((d['subtasks'] as List<dynamic>?) ?? [])
            .map((s) => Subtask.fromMap(Map<String, dynamic>.from(s as Map)))
            .toList(),
        repeat: TaskRepeat.values.firstWhere(
          (r) => r.name == d['repeat'],
          orElse: () => TaskRepeat.none,
        ),
        attachDay: (d['attachDay'] as num?)?.toInt(),
        attachTime: d['attachTime'] as String?,
        attachLabel: d['attachLabel'] as String?,
        leadDays: (d['leadDays'] as num?)?.toInt(),
        completedAt: d['completedAt'] as String?,
      );
}

/// One help entry, maintained in Firestore rather than shipped in the binary:
/// an answer that needs an app release to correct will stay wrong.
class Faq {
  const Faq({
    required this.id,
    required this.category,
    required this.question,
    required this.answer,
    required this.order,
  });

  final String id;
  final String category;
  final String question;
  final String answer;
  final int order;

  factory Faq.fromMap(String id, Map<String, dynamic> d) => Faq(
        id: id,
        category: d['category'] as String? ?? 'General',
        question: d['question'] as String? ?? '',
        answer: d['answer'] as String? ?? '',
        // Missing order sinks to the bottom rather than jumping to the top.
        order: (d['order'] as num?)?.toInt() ?? 9999,
      );
}

/// What a student says about one class on one day.
///
/// The portal publishes only per-subject totals — 32 of 47 — and republishes
/// them irregularly, so between syncs a student has no idea where they stand.
/// These marks fill that gap. They are the student's own account, never the
/// college's: they live in their own collection, cannot overwrite the imported
/// summaries, and anything computed from them is labelled an estimate.
enum MarkStatus {
  present('Present'),
  absent('Missed'),
  /// Held on the timetable but didn't happen. Counts as neither attended nor
  /// held, which is the whole reason it needs a state of its own — recording a
  /// cancelled class as "missed" would quietly damage your own projection.
  cancelled('Cancelled');

  const MarkStatus(this.label);
  final String label;
}

class AttendanceMark {
  const AttendanceMark({
    required this.id,
    required this.subjectId,
    required this.date,
    required this.status,
    required this.startTime,
    required this.periods,
    this.updatedAt,
  });

  final String id;
  final String subjectId;

  /// yyyy-MM-dd, matching how task due dates are stored.
  final String date;
  final MarkStatus status;

  /// Which slot on that day, so two sessions of one subject stay distinct.
  final String startTime;

  /// A merged block counts once per period it covers — a three-period lab you
  /// sat through is three classes to the register, not one.
  final int periods;

  /// When this mark was last written, ISO 8601, or null for one written before
  /// the field existed — or by the web, which did not send it.
  ///
  /// Only used to settle a disagreement between two documents describing the
  /// same class. See dedupeMarks.
  final String? updatedAt;

  /// Stable id, so marking the same class twice edits rather than duplicates.
  ///
  /// Underscore-separated, and identical to attendanceMarkId in
  /// src/types/attendanceMark.ts — which is the whole point. It used to be
  /// `uid-subject-date-HHmm`, hyphenated with the colon stripped, while the web
  /// wrote `uid_subject_date_HH:mm`. Both are stable; they are stable at *two
  /// different ids*, so the same class marked on a phone and on a laptop became
  /// two documents, and every percentage counted it twice. The web's type file
  /// claimed the two schemes matched exactly, which is how it went unnoticed.
  ///
  /// The separator matters and is not arbitrary: a date already contains
  /// hyphens, so the old form could not be told apart from a subject id with a
  /// hyphen in it. Nothing parses these, but a scheme that cannot be read back
  /// is a scheme nobody can debug.
  static String idFor(String uid, String subjectId, String date, String startTime) =>
      '${uid}_${subjectId}_${date}_$startTime';

  /// What this app wrote before [idFor] was corrected.
  ///
  /// Kept so a write or a clear can delete the old document as well as the new
  /// one. Without that, clearing a mark made before the fix would delete the
  /// canonical id, leave the legacy one untouched, and the mark would come
  /// straight back on the next read.
  static String legacyIdFor(String uid, String subjectId, String date, String startTime) =>
      '$uid-$subjectId-$date-${startTime.replaceAll(':', '')}';

  factory AttendanceMark.fromMap(String id, Map<String, dynamic> d) => AttendanceMark(
        id: id,
        subjectId: d['subjectId'] as String? ?? '',
        date: d['date'] as String? ?? '',
        status: MarkStatus.values.firstWhere(
          (s) => s.name == d['status'],
          orElse: () => MarkStatus.present,
        ),
        startTime: d['startTime'] as String? ?? '',
        periods: (d['periods'] as num?)?.toInt() ?? 1,
        updatedAt: d['updatedAt'] as String?,
      );
}

/// College-wide configuration — `colleges/{collegeId}`.
///
/// A port of src/types/config.ts, and the reason the phone stopped hardcoding
/// 75%: that number belongs to the college, not to Handy, and a college that
/// requires 80% was being told by its own students' app that they were safe at
/// 76. The default below is a fallback for a college whose document has not
/// been provisioned yet, exactly as DEFAULT_COLLEGE_CONFIG is on the web — not
/// a value any live screen should be reading.
class CollegeConfig {
  const CollegeConfig({
    required this.minimumAttendancePercentage,
    required this.condonationPercentage,
    required this.workingDaysPerWeek,
    required this.classDurationMinutes,
  });

  final double minimumAttendancePercentage;
  final double? condonationPercentage;
  final int workingDaysPerWeek;
  final int classDurationMinutes;

  static const fallback = CollegeConfig(
    minimumAttendancePercentage: 75,
    condonationPercentage: null,
    workingDaysPerWeek: 6,
    classDurationMinutes: 50,
  );

  factory CollegeConfig.fromMap(Map<String, dynamic> d) => CollegeConfig(
        minimumAttendancePercentage:
            (d['minimumAttendancePercentage'] as num?)?.toDouble() ??
                fallback.minimumAttendancePercentage,
        condonationPercentage: (d['condonationPercentage'] as num?)?.toDouble(),
        workingDaysPerWeek:
            (d['workingDaysPerWeek'] as num?)?.toInt() ?? fallback.workingDaysPerWeek,
        classDurationMinutes:
            (d['classDurationMinutes'] as num?)?.toInt() ?? fallback.classDurationMinutes,
      );
}

/// Where a leave request stands with the administration.
enum LeaveStatus { pending, approved, rejected }

/// A leave request — `leaveRequests/{id}`.
///
/// A distinct thing from the Leave *Planner*, and the one place the two are
/// easy to confuse: the planner works out what a day off would cost your
/// attendance, and computing that a Thursday is "safe" is not permission to
/// take it. This is the half that goes to a human. Ported from
/// src/types/leave.ts.
///
/// Students may create one and never touch it again — the security rules
/// reject any write that sets a status other than `pending`, and reject
/// updates outright, so approval only ever comes from the other side.
class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    required this.submittedAt,
    required this.reviewedAt,
    required this.reviewedBy,
  });

  final String id;
  final DateTime startDate;
  final DateTime endDate;
  final String reason;
  final LeaveStatus status;
  final DateTime submittedAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;

  /// Inclusive, because a one-day leave is one day and not zero.
  int get days => endDate.difference(startDate).inDays + 1;

  factory LeaveRequest.fromMap(String id, Map<String, dynamic> d) => LeaveRequest(
        id: id,
        startDate: _date(d['startDate']) ?? DateTime.now(),
        endDate: _date(d['endDate']) ?? _date(d['startDate']) ?? DateTime.now(),
        reason: d['reason'] as String? ?? '',
        status: switch (d['status'] as String?) {
          'approved' => LeaveStatus.approved,
          'rejected' => LeaveStatus.rejected,
          _ => LeaveStatus.pending,
        },
        submittedAt: _date(d['submittedAt']) ?? DateTime.now(),
        reviewedAt: _date(d['reviewedAt']),
        reviewedBy: d['reviewedBy'] as String?,
      );

  static DateTime? _date(Object? value) =>
      value is String ? DateTime.tryParse(value)?.toLocal() : null;
}
