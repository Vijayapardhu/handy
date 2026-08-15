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
  });

  final String id;
  final String code;
  final String name;
  final String shortName;
  final String facultyName;

  factory Subject.fromMap(String id, Map<String, dynamic> d) => Subject(
        id: id,
        code: d['code'] as String? ?? '',
        name: d['name'] as String? ?? '',
        shortName: d['shortName'] as String? ?? '',
        facultyName: d['facultyName'] as String? ?? '',
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

  /// Stable id, so marking the same class twice edits rather than duplicates.
  static String idFor(String uid, String subjectId, String date, String startTime) =>
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
      );
}
