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
  });

  final String id;
  final String title;
  final String notes;
  final TaskKind kind;
  final DateTime dueDate;
  final String? dueTime;
  final String? subjectId;
  final bool done;

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
      );
}
