import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../models/hub_attendance.dart';

/// Client for /api/hub-connect and /api/hub-attendance.
///
/// A port of src/services/attendance/hubAttendanceService.ts, and shaped like
/// PortalAuth on purpose — but this is not a sign-in. The student is already
/// authenticated with Handy; connecting CodeForge links a second, unrelated
/// college system on top of that.
///
/// The class and the endpoints keep the name "hub" — `/api/hub-connect`,
/// `hubAccounts/{uid}` — because those are the server's, and renaming a wire
/// contract to match a label is how the two halves stop agreeing. Everything a
/// student reads says CodeForge.
///
/// ## Where the CodeForge password lives
///
/// Deliberately *not* on the device, which is the opposite of PortalAuth and
/// the difference is worth stating. A college-portal password is the thing
/// Handy signs a student in with, so the phone holds it and re-verifies by
/// itself. A CodeForge password buys one thing only — a Maya token that expires
/// after an hour — and the refresh has to happen somewhere the server can
/// reach. So it is encrypted and stored server-side under `hubAccounts/{uid}`,
/// a collection with no Firestore rule at all (default deny), reachable only
/// by the two endpoints below with the Admin SDK. The phone sends the password
/// once, at connect, and never stores it.
///
/// Every call carries the student's own Firebase ID token, never a shared key:
/// this is the student's own credential, not something a classmate or an admin
/// should be able to set on their behalf.
class Hub {
  Hub({http.Client? client, FirebaseAuth? auth})
      : _client = client ?? http.Client(),
        _auth = auth ?? FirebaseAuth.instance;

  final http.Client _client;
  final FirebaseAuth _auth;

  static const _base = 'https://handy.vijayaapardhu.dev';

  /// Links a CodeForge account. Throws [HubException] with something the student can
  /// act on.
  Future<void> connect({required String rollNumber, required String password}) async {
    await _send(
      'POST',
      '/api/hub-connect',
      body: {
        'rollNumber': rollNumber.trim().toUpperCase(),
        'password': password,
      },
      // The server logs in to Maya and reads the enrolment list inside this
      // call, so the ceiling is generous — but it is a ceiling, because a
      // spinner that never resolves is worse than an error.
      timeout: const Duration(seconds: 45),
      fallback: 'Could not connect to CodeForge.',
    );
  }

  /// Forgets the stored CodeForge credential. The student can reconnect any time.
  Future<void> disconnect() async {
    await _send(
      'DELETE',
      '/api/hub-connect',
      fallback: 'Could not disconnect CodeForge.',
    );
  }

  /// The current snapshot, or `linked: false` for a student who has never
  /// connected one.
  Future<HubAttendanceResult> attendance() async {
    final body = await _send(
      'POST',
      '/api/hub-attendance',
      timeout: const Duration(seconds: 45),
      fallback: 'Could not load CodeForge attendance.',
    );

    final snapshot = body?['snapshot'];
    return HubAttendanceResult(
      linked: body?['linked'] == true,
      snapshot: snapshot is Map
          ? HubAttendanceSnapshot.fromMap(snapshot.cast<String, dynamic>())
          : null,
    );
  }

  Future<Map<String, dynamic>?> _send(
    String method,
    String path, {
    Map<String, Object?>? body,
    Duration timeout = const Duration(seconds: 20),
    required String fallback,
  }) async {
    // Fetched per call rather than held: an ID token expires after an hour,
    // and a screen left open outlives one.
    final user = _auth.currentUser;
    if (user == null) throw const HubException('signed_out', 'Sign in to Handy first.');

    late String idToken;
    try {
      idToken = await user.getIdToken() ?? '';
    } catch (_) {
      throw const HubException('network', 'Could not reach Handy. Check your connection.');
    }

    final request = http.Request(method, Uri.parse('$_base$path'))
      ..headers.addAll({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $idToken',
      });
    if (body != null) request.body = jsonEncode(body);

    late http.Response response;
    try {
      final streamed = await _client.send(request).timeout(timeout);
      response = await http.Response.fromStream(streamed);
    } catch (_) {
      throw const HubException('network', 'Could not reach Handy. Check your connection.');
    }

    final decoded = _decode(response.body);
    if (response.statusCode != 200) {
      final code = (decoded?['error'] as String?) ?? 'unknown';
      throw HubException(
        code,
        _messages[code] ?? (decoded?['message'] as String?) ?? fallback,
      );
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

  /// Kept word for word with the web's MESSAGES map. The same failure should
  /// read the same on both, or a student comparing them concludes one of the
  /// two is broken.
  static const _messages = <String, String>{
    'invalid_credentials':
        "That roll number and password didn't work on CodeForge. This is your Maya/CodeForge login, not your Handy one.",
    'missing_credentials': 'Enter both your CodeForge roll number and password.',
    'rate_limited': 'Too many attempts. Wait a few minutes before trying again.',
    'hub_failed': 'Could not reach CodeForge. Try again shortly.',
  };
}

class HubException implements Exception {
  const HubException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}
