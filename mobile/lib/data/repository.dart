import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

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

  Future<void> addTask({
    required String title,
    required String notes,
    required TaskKind kind,
    required DateTime dueDate,
    String? dueTime,
    String? subjectId,
  }) async {
    final now = DateTime.now().toIso8601String();
    await _db.collection('tasks').add({
      'studentId': _uid,
      'title': title.trim(),
      'notes': notes.trim(),
      'kind': kind.name,
      // Stored as a yyyy-MM-dd string, matching the web app's TaskDoc.
      'dueDate': dueDate.toIso8601String().substring(0, 10),
      'dueTime': dueTime,
      'subjectId': subjectId,
      'done': false,
      'completedAt': null,
      'createdAt': now,
      'updatedAt': now,
    });
  }

  Future<void> setTaskDone(String taskId, bool done) async {
    final now = DateTime.now().toIso8601String();
    await _db.collection('tasks').doc(taskId).update({
      'done': done,
      'completedAt': done ? now : null,
      'updatedAt': now,
    });
  }

  Future<void> deleteTask(String taskId) => _db.collection('tasks').doc(taskId).delete();
}
