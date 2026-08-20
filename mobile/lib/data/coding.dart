import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../models/coding.dart';

/// Client for /api/coding and /api/coding-complexity, plus the one collection
/// the phone writes here: `codingSolutions`.
///
/// A port of src/services/coding/codingService.ts, and split the same way it
/// is, for the same two reasons:
///
///   - Platforms go through the server. LeetCode and CodeChef cannot be read
///     from an app (no CORS, no API key, HTML that needs parsing), and the
///     numbers behind a leaderboard must not be client-written: `totalSolved`
///     decides a board position, so only api/coding.js sets it.
///   - The solve log is plain Firestore. It is the student's own writing, and
///     firestore.rules already fences `codingSolutions` to their uid — the
///     same shape Repository uses for tasks.
///
/// No password is involved anywhere here. Every platform is read from its
/// public profile using a handle the student typed, which is exactly why this
/// needs none of the stored-credential machinery Hub has.
class Coding {
  Coding({http.Client? client, FirebaseAuth? auth, FirebaseFirestore? db})
      : _client = client ?? http.Client(),
        _auth = auth ?? FirebaseAuth.instance,
        _db = db ?? FirebaseFirestore.instance;

  final http.Client _client;
  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  static const _base = 'https://handy.vijayaapardhu.dev';

  String get _uid => _auth.currentUser!.uid;

  // ── Platforms (server) ────────────────────────────────────────────────────

  /// The student's snapshot, or `linked: false` for someone who has connected
  /// nothing — not an error, and the state the connect form renders from.
  Future<CodingProfileResult> profile({bool forceRefresh = false}) async {
    final body = await _send(
      {'action': 'profile', 'forceRefresh': forceRefresh},
      // The refresh path fans out to five sites; the cached path is instant.
      // One ceiling for both, generous enough for the slow one.
      timeout: const Duration(seconds: 45),
      fallback: 'Could not load your practice profile.',
    );
    return _profileFrom(body);
  }

  /// Saves the usernames. A platform left out is unlinked, which is how
  /// clearing a field removes one without a separate delete per site.
  Future<CodingProfileResult> link(Map<CodingPlatform, String> handles) async {
    final body = await _send(
      {
        'action': 'link',
        'handles': {
          for (final entry in handles.entries)
            if (entry.value.trim().isNotEmpty) entry.key.id: entry.value.trim(),
        },
      },
      timeout: const Duration(seconds: 45),
      fallback: 'Could not save those usernames.',
    );
    return _profileFrom(body);
  }

  Future<void> settings({int? weeklyTarget, bool? shareToLeaderboard}) async {
    await _send(
      {
        'action': 'settings',
        if (weeklyTarget != null) 'weeklyTarget': weeklyTarget,
        if (shareToLeaderboard != null) 'shareToLeaderboard': shareToLeaderboard,
      },
      fallback: 'Could not save that setting.',
    );
  }

  Future<List<ContestItem>> contests() async {
    final body = await _send(
      {'action': 'contests'},
      fallback: 'Could not load upcoming contests.',
    );
    return [
      for (final raw in (body?['contests'] as List? ?? []))
        if (raw is Map) ContestItem.fromMap(raw.cast<String, dynamic>()),
    ].whereType<ContestItem>().toList();
  }

  Future<DailyProblem?> daily() async {
    final body = await _send(
      {'action': 'daily'},
      fallback: "Could not load today's problem.",
    );
    return DailyProblem.fromMap(body?['daily']);
  }

  Future<List<LeaderboardEntry>> leaderboard() async {
    final body = await _send(
      {'action': 'leaderboard'},
      fallback: 'Could not load the class board.',
    );
    return [
      for (final raw in (body?['entries'] as List? ?? []))
        if (raw is Map) LeaderboardEntry.fromMap(raw.cast<String, dynamic>()),
    ];
  }

  /// Reads the complexity of a pasted solution.
  ///
  /// Throws [CodingException] with `ai_unconfigured` when no key is set on the
  /// server — a normal state with a normal answer (type it in yourself), not a
  /// crash, which is why the screen catches it into an editable blank verdict.
  Future<ComplexityVerdict> analyse({
    required String code,
    required String language,
    String? title,
    CodingPlatform? platform,
  }) async {
    final body = await _send(
      {
        'code': code,
        'language': language,
        if (title != null && title.isNotEmpty) 'title': title,
        if (platform != null) 'platform': platform.id,
      },
      path: '/api/coding-complexity',
      // A model reading a page of code takes longer than any other call here.
      timeout: const Duration(seconds: 60),
      fallback: 'Could not analyse that solution.',
    );

    final verdict = ComplexityVerdict.fromMap(body?['verdict']);
    if (verdict == null) {
      throw const CodingException('ai_unparseable', "The analyser gave an answer we couldn't read. Try again.");
    }
    return verdict;
  }

  // ── Solve log (Firestore, student-owned) ──────────────────────────────────

  /// Newest first — the question is always "what did I do lately".
  Stream<List<CodingSolution>> watchSolutions() => _db
      .collection('codingSolutions')
      .where('studentId', isEqualTo: _uid)
      .snapshots()
      .map((snap) {
        final solutions = snap.docs
            .map((doc) => CodingSolution.fromMap(doc.id, doc.data()))
            .toList()
          // Sorted here rather than in the query: ordering server-side needs
          // the composite index, and a phone that opened before the index
          // finished building would show an error instead of a list.
          ..sort((a, b) => b.solvedAt.compareTo(a.solvedAt));
        return solutions;
      });

  Future<void> createSolution({
    required CodingPlatform platform,
    required String title,
    required String solvedAt,
    required String language,
    String url = '',
    ProblemDifficulty? difficulty,
    String code = '',
    String notes = '',
    ComplexityVerdict? complexity,
  }) async {
    final now = DateTime.now().toIso8601String();
    await _db.collection('codingSolutions').add({
      'studentId': _uid,
      'platform': platform.id,
      'title': title.trim(),
      'url': url.trim(),
      'difficulty': difficulty?.name,
      'language': language.trim(),
      'code': code,
      'notes': notes.trim(),
      'complexity': complexity?.toMap(),
      'solvedAt': solvedAt,
      'createdAt': now,
      'updatedAt': now,
    });
  }

  Future<void> deleteSolution(String solutionId) =>
      _db.collection('codingSolutions').doc(solutionId).delete();

  // ── Transport ─────────────────────────────────────────────────────────────

  CodingProfileResult _profileFrom(Map<String, dynamic>? body) {
    final raw = body?['profile'];
    return CodingProfileResult(
      linked: body?['linked'] == true,
      profile: raw is Map ? CodingProfile.fromMap(raw.cast<String, dynamic>()) : CodingProfile.empty,
      rateLimited: body?['rateLimited'] == true,
    );
  }

  Future<Map<String, dynamic>?> _send(
    Map<String, Object?> body, {
    String path = '/api/coding',
    Duration timeout = const Duration(seconds: 25),
    required String fallback,
  }) async {
    // Fetched per call rather than held: an ID token expires after an hour,
    // and a screen left open outlives one.
    final user = _auth.currentUser;
    if (user == null) throw const CodingException('signed_out', 'Sign in to Handy first.');

    late String idToken;
    try {
      idToken = await user.getIdToken() ?? '';
    } catch (_) {
      throw const CodingException('network', 'Could not reach Handy. Check your connection.');
    }

    late http.Response response;
    try {
      response = await _client
          .post(
            Uri.parse('$_base$path'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $idToken',
            },
            body: jsonEncode(body),
          )
          .timeout(timeout);
    } catch (_) {
      throw const CodingException('network', 'Could not reach Handy. Check your connection.');
    }

    final decoded = _decode(response.body);
    // The complexity endpoint answers 200 with ok:false when analysis is
    // switched off, so success is `ok`, never the status code alone.
    if (response.statusCode != 200 || decoded?['ok'] != true) {
      final code = (decoded?['error'] as String?) ?? 'unknown';
      throw CodingException(code, _messageFor(code) ?? fallback);
    }
    return decoded;
  }

  static Map<String, dynamic>? _decode(String body) {
    try {
      final value = jsonDecode(body);
      return value is Map ? value.cast<String, dynamic>() : null;
    } catch (_) {
      return null;
    }
  }

  static String? _messageFor(String code) {
    if (code.startsWith('invalid_handle_')) {
      final platform = code.replaceFirst('invalid_handle_', '');
      return 'That $platform username has characters no username can contain — check it and try again.';
    }
    return _messages[code];
  }

  /// Kept word for word with the web's MESSAGES map. The same failure should
  /// read the same on both, or a student comparing them concludes one of the
  /// two is broken.
  static const _messages = <String, String>{
    'rate_limited': "You've refreshed a lot in the last hour. Try again shortly.",
    'coding_failed': 'Could not reach the coding platforms. Try again shortly.',
    'ai_unconfigured':
        "Complexity analysis isn't switched on for this app yet — you can still enter the complexity yourself.",
    'ai_unreachable': "The analyser didn't respond. Try again, or enter the complexity yourself.",
    'ai_failed': "The analyser couldn't read that solution. Try again, or enter it yourself.",
    'ai_unparseable': "The analyser gave an answer we couldn't read. Try again.",
    'ai_truncated':
        "That solution needed more room to think through than we allow. Try again, or trim the code to just the solution.",
    'code_too_long': "That's too much code to analyse — paste just the solution.",
    'missing_code': 'Paste your solution first.',
  };
}

class CodingException implements Exception {
  const CodingException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}
