import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/class_content.dart';
import '../models/models.dart';
import '../models/timetable_entry.dart';

/// Reads the record the desktop extension captured, and owns the one
/// collection the student writes: tasks.
///
/// Everything here is scoped to the signed-in uid, matching firestore.rules —
/// the phone has no privileged access, it's the same student account the web
/// app uses.
class Repository {
  Repository(this._db, this._auth);

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  String get _uid => _auth.currentUser!.uid;

  /// Accounts use synthetic `<roll>@handy.local` addresses — Firebase Auth has
  /// no notion of a roll number, so it's mapped the same way the web app and
  /// the extension map it. Keep in step with rollNumberToEmail().
  static String emailForRoll(String rollNumber) =>
      '${rollNumber.trim().toLowerCase()}@handy.local';

  /// The password every account is created with. Students may change it in the
  /// web app, which is why this is a default rather than a constant used blindly.
  static const defaultPassword = 'Handy@123';

  Future<void> signIn(String rollNumber, String password) async {
    await _auth.signInWithEmailAndPassword(
      email: emailForRoll(rollNumber),
      password: password,
    );
  }

  Future<void> signOut() => _auth.signOut();

  Stream<Student?> watchStudent() => _db.collection('students').doc(_uid).snapshots().map(
        (snap) => snap.exists ? Student.fromMap(snap.id, snap.data()!) : null,
      );

  Future<List<Subject>> subjects(String semesterId) async {
    final snap = await _db
        .collection('subjects')
        .where('semesterId', isEqualTo: semesterId)
        .where('active', isEqualTo: true)
        .get();
    return snap.docs.map((d) => Subject.fromMap(d.id, d.data())).toList();
  }

  /// Every class group this student sits in, as the server recorded it on sync.
  ///
  /// A "class" is not a subject: two students on one timetable taking the same
  /// elective sit with different lecturers, in different rooms, under different
  /// reps. The key is `<timetableId>-<CODE>-<facultyId>`, and these documents
  /// are what /api/announce actually fans out to — so anything shown from them
  /// is the room the student would really be notified in.
  Future<List<String>> classGroupKeys() async {
    final snap = await _db
        .collection('classGroupMembers')
        .where('uid', isEqualTo: _uid)
        .get();
    return snap.docs.map((d) => d.data()['groupKey'] as String? ?? '').where((k) => k.isNotEmpty).toList();
  }

  /// The group among [keys] that is this subject taught by this student's own
  /// lecturer. Matched on the suffix, since the last two parts of the key are
  /// exactly what separates two rooms taking the same subject.
  static String? matchGroupKey(List<String> keys, String subjectCode, String facultyId) {
    if (subjectCode.trim().isEmpty || facultyId.trim().isEmpty) return null;
    final suffix = '-${subjectCode.trim().toUpperCase()}-${facultyId.trim()}';
    for (final key in keys) {
      if (key.toUpperCase().endsWith(suffix.toUpperCase())) return key;
    }
    return null;
  }

  /// Course material for one class, newest first.
  ///
  /// Sorted here rather than in the query so the collection needs no composite
  /// index alongside the groupKey filter.
  Future<List<ClassNote>> classNotes(String groupKey) async {
    final snap = await _db
        .collection('classNotes')
        .where('groupKey', isEqualTo: groupKey)
        .get();
    final notes = snap.docs.map((d) => ClassNote.fromMap(d.id, d.data())).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return notes;
  }

  /// Announcements posted to one class, newest first.
  Future<List<AnnouncementSummary>> groupAnnouncements(String groupKey) async {
    final snap = await _db
        .collection('announcements')
        .where('groupKey', isEqualTo: groupKey)
        .get();
    final items = snap.docs.map((d) => AnnouncementSummary.fromMap(d.id, d.data())).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return items;
  }

  /// How many classes this student had on each day the college recorded one.
  ///
  /// Read from `attendance` — the college's own per-day record, which only the
  /// campuses whose portal reports days have. Empty for Aditya University,
  /// whose portal gives running totals only.
  ///
  /// One record is one subject on one day, so a subject with two back-to-back
  /// periods counts once. That makes this a slight undercount, which is the
  /// safe direction: it says a student needs *more* days rather than fewer.
  Future<List<int>> classesPerRecordedDay() async {
    final snap = await _db
        .collection('attendance')
        .where('studentId', isEqualTo: _uid)
        .get();

    final perDay = <String, int>{};
    for (final doc in snap.docs) {
      final date = doc.data()['date'] as String?;
      if (date == null) continue;
      perDay[date] = (perDay[date] ?? 0) + 1;
    }
    return perDay.values.toList();
  }

  Future<List<AttendanceSummary>> summaries() async {
    final snap = await _db
        .collection('attendanceSummaries')
        .where('studentId', isEqualTo: _uid)
        .get();
    return snap.docs.map((d) => AttendanceSummary.fromMap(d.data())).toList();
  }

  /// The active published timetable and its entries.
  ///
  /// The status filter is not optional: firestore.rules only permits reading a
  /// published version, and Firestore rejects any query it can't prove is
  /// confined to readable documents.
  Future<List<TimetableEntry>> timetableEntries(String semesterId) async {
    final versions = await _db
        .collection('timetableVersions')
        .where('semesterId', isEqualTo: semesterId)
        .where('status', isEqualTo: 'published')
        .get();
    if (versions.docs.isEmpty) return [];

    final versionId = versions.docs.first.id;
    final entries = await _db
        .collection('timetableEntries')
        .where('timetableVersionId', isEqualTo: versionId)
        .get();
    return entries.docs.map((d) => TimetableEntry.fromMap(d.id, d.data())).toList();
  }

  Stream<List<Task>> watchTasks() => _db
      .collection('tasks')
      .where('studentId', isEqualTo: _uid)
      .snapshots()
      .map((snap) {
        final tasks = snap.docs.map((d) => Task.fromMap(d.id, d.data())).toList()
          ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
        return tasks;
      });

  Future<String> addTask({
    required String title,
    required String notes,
    required TaskKind kind,
    required DateTime dueDate,
    String? dueTime,
    String? subjectId,
    List<Subtask> subtasks = const [],
    TaskRepeat repeat = TaskRepeat.none,
    int? attachDay,
    String? attachTime,
    String? attachLabel,
    int? leadDays,
  }) async {
    final now = DateTime.now().toIso8601String();
    final doc = await _db.collection('tasks').add({
      'studentId': _uid,
      'title': title.trim(),
      'notes': notes.trim(),
      'kind': kind.name,
      // Stored as a yyyy-MM-dd string, matching the web app's TaskDoc.
      'dueDate': dueDate.toIso8601String().substring(0, 10),
      'dueTime': dueTime,
      'subjectId': subjectId,
      'subtasks': subtasks.map((s) => s.toMap()).toList(),
      'repeat': repeat.name,
      'attachDay': attachDay,
      'attachTime': attachTime,
      'attachLabel': attachLabel,
      'leadDays': leadDays,
      'done': false,
      'completedAt': null,
      'createdAt': now,
      'updatedAt': now,
    });
    return doc.id;
  }

  /// Edits an existing deadline. Only the fields passed are written, so this
  /// can serve both the detail screen's full edit and a single subtask tick.
  Future<void> updateTask(
    String taskId, {
    String? title,
    String? notes,
    TaskKind? kind,
    DateTime? dueDate,
    String? dueTime,
    bool clearDueTime = false,
    String? subjectId,
    bool clearSubject = false,
    List<Subtask>? subtasks,
    TaskRepeat? repeat,
    int? attachDay,
    String? attachTime,
    String? attachLabel,
    bool clearAttachment = false,
    int? leadDays,
    bool clearLeadDays = false,
  }) async {
    await _db.collection('tasks').doc(taskId).update({
      if (title != null) 'title': title.trim(),
      if (notes != null) 'notes': notes.trim(),
      if (kind != null) 'kind': kind.name,
      if (dueDate != null) 'dueDate': dueDate.toIso8601String().substring(0, 10),
      // Null is a legitimate value for these two, so clearing needs its own
      // flag — an absent argument means "leave it alone".
      if (clearDueTime) 'dueTime': null else if (dueTime != null) 'dueTime': dueTime,
      if (clearSubject) 'subjectId': null else if (subjectId != null) 'subjectId': subjectId,
      if (subtasks != null) 'subtasks': subtasks.map((s) => s.toMap()).toList(),
      if (repeat != null) 'repeat': repeat.name,
      // Both halves move together — a day without a time pins nothing.
      if (clearAttachment) ...{'attachDay': null, 'attachTime': null, 'attachLabel': null}
      else if (attachDay != null && attachTime != null) ...{
        'attachDay': attachDay,
        'attachTime': attachTime,
        'attachLabel': attachLabel,
      },
      // Null is a legitimate value here — it means "follow the default" — so
      // clearing needs its own flag rather than an absent argument.
      if (clearLeadDays) 'leadDays': null else if (leadDays != null) 'leadDays': leadDays,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  /// Marks a deadline done, and rolls a repeating one forward.
  ///
  /// The completed copy stays as history rather than being mutated into the
  /// next occurrence — "did I hand in last week's record" is a question worth
  /// being able to answer. Subtasks come back unticked, since the next
  /// occurrence has to be done again from the start.
  Future<void> setTaskDone(String taskId, bool done, {Task? task}) async {
    final now = DateTime.now().toIso8601String();
    await _db.collection('tasks').doc(taskId).update({
      'done': done,
      'completedAt': done ? now : null,
      'updatedAt': now,
    });

    if (!done || task == null || task.repeat == TaskRepeat.none) return;

    await addTask(
      title: task.title,
      notes: task.notes,
      kind: task.kind,
      dueDate: nextOccurrence(task.dueDate, task.repeat),
      dueTime: task.dueTime,
      subjectId: task.subjectId,
      subtasks: task.subtasks.map((s) => s.copyWith(done: false)).toList(),
      repeat: task.repeat,
      attachDay: task.attachDay,
      attachTime: task.attachTime,
      attachLabel: task.attachLabel,
      leadDays: task.leadDays,
    );
  }

  /// Months are added by calendar rather than by 30 days, so "every month on
  /// the 5th" stays on the 5th.
  static DateTime nextOccurrence(DateTime from, TaskRepeat repeat) => switch (repeat) {
        TaskRepeat.daily => from.add(const Duration(days: 1)),
        TaskRepeat.weekly => from.add(const Duration(days: 7)),
        TaskRepeat.fortnightly => from.add(const Duration(days: 14)),
        TaskRepeat.monthly => DateTime(from.year, from.month + 1, from.day),
        TaskRepeat.none => from,
      };

  Future<void> deleteTask(String taskId) => _db.collection('tasks').doc(taskId).delete();

  /// How many notifications the student has not opened.
  ///
  /// Counted rather than listed: the badge only needs a number, and streaming
  /// the whole collection to derive one would grow with every notification
  /// ever sent.
  Stream<int> watchUnreadNotifications() => _db
      .collection('notifications')
      .where('userId', isEqualTo: _uid)
      .where('read', isEqualTo: false)
      .snapshots()
      .map((snap) => snap.size);

  /// The student's own day-by-day marks.
  ///
  /// A separate collection from the imported summaries, and from the
  /// admin-only `attendance` records — the college's account and the
  /// student's must never be able to overwrite one another.
  Stream<List<AttendanceMark>> watchMarks() => _db
      .collection('attendanceMarks')
      .where('studentId', isEqualTo: _uid)
      .snapshots()
      .map((snap) => snap.docs.map((d) => AttendanceMark.fromMap(d.id, d.data())).toList());

  /// Records — or corrects — one class on one day.
  ///
  /// Written at a deterministic id so marking the same class twice edits the
  /// mark rather than stacking a second one; tapping the state it is already
  /// in clears it, because the fastest way to undo a mistap should be to
  /// repeat it.
  Future<void> setMark({
    required String subjectId,
    required DateTime date,
    required String startTime,
    required int periods,
    required MarkStatus? status,
  }) async {
    final day = date.toIso8601String().substring(0, 10);
    final id = AttendanceMark.idFor(_uid, subjectId, day, startTime);
    final ref = _db.collection('attendanceMarks').doc(id);

    if (status == null) {
      await ref.delete();
      return;
    }

    await ref.set({
      'studentId': _uid,
      'subjectId': subjectId,
      'date': day,
      'startTime': startTime,
      'periods': periods,
      'status': status.name,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  /// Lets the server decide whether to interrupt this student on a sync. Kept
  /// on the student document because the server cannot read a phone's
  /// preferences.
  Future<void> setNotifyNewData(bool on) => _db.collection('students').doc(_uid).update({
        'notifyNewData': on,
        'updatedAt': DateTime.now().toIso8601String(),
      });

  /// Help content, maintained centrally rather than shipped in the binary — an
  /// answer that needs an app update to correct will stay wrong.
  ///
  /// Ordered here rather than in the query so the collection needs no index,
  /// and so an entry with a missing `order` sinks rather than disappearing.
  Future<List<Faq>> faqs() async {
    final snap = await _db.collection('faqs').where('active', isEqualTo: true).get();
    final rows = snap.docs.map((d) => Faq.fromMap(d.id, d.data())).toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    return rows;
  }

  /// Feedback is write-only: firestore.rules refuses reads to every client,
  /// including the student who wrote it. It is read with the Admin SDK.
  Future<void> sendFeedback({
    required String message,
    required String kind,
    required String appVersion,
    String? rollNumber,
    String? contact,
  }) async {
    await _db.collection('feedback').add({
      'studentId': _uid,
      'rollNumber': rollNumber ?? '',
      'kind': kind,
      'message': message.trim(),
      'contact': contact?.trim() ?? '',
      'appVersion': appVersion,
      'platform': 'android',
      'createdAt': DateTime.now().toIso8601String(),
    });
  }
}
