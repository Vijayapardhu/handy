import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../logic/campus.dart';

/// Signing in by proving you can sign in to your own college portal.
///
/// AEC and ACET have no captcha, so Handy's server logs in as the student,
/// reads their attendance, and hands back a Firebase custom token. That portal
/// login *is* the identity check — there is no separate Handy password to
/// remember, and the account is created the first time it succeeds.
///
/// ## Where the password lives
///
/// On the device, encrypted by flutter_secure_storage with a key held in the
/// Android Keystore — not on Handy's server, and not in Firestore.
///
/// That distinction is the whole design. Keeping it on the device means a
/// breach of Handy's database exposes nobody's college account, because Handy
/// does not hold one. It is stored at all so the app can re-verify and re-sync
/// by itself — otherwise a student would retype their portal password every
/// time they wanted fresh attendance, and would simply stop.
///
/// Worth being honest about the limit: this protects the credential at rest
/// against another app and against someone reading the filesystem. It does not
/// protect it from a rooted device or from someone holding an unlocked phone.
///
/// It is deleted on sign-out, and cleared when the portal rejects it, so a
/// changed college password does not leave a stale one sitting in the keystore
/// being retried.
class PortalAuth {
  PortalAuth({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        // Defaults are what we want on Android now: the plugin moved off
        // Jetpack Security (deprecated by Google) to its own ciphers, and the
        // old encryptedSharedPreferences flag is ignored.
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;

  static const _base = 'https://handy.vijayaapardhu.dev';
  static const _rollKey = 'handy.portal.roll';
  static const _passwordKey = 'handy.portal.password';
  static const _campusKey = 'handy.portal.campus';

  /// Verifies against the college and signs in. Throws [PortalAuthException].
  Future<void> signIn({
    required String rollNumber,
    required String password,
    required Campus campus,
    bool remember = true,
  }) async {
    final token = await _verify(rollNumber: rollNumber, password: password, campus: campus);
    await FirebaseAuth.instance.signInWithCustomToken(token);
    if (remember) {
      await _storage.write(key: _rollKey, value: rollNumber);
      await _storage.write(key: _passwordKey, value: password);
      await _storage.write(key: _campusKey, value: campus.wire);
    }
  }

  /// Whether there is a saved portal credential to sync with.
  Future<bool> get hasSavedCredential async =>
      (await _storage.read(key: _passwordKey))?.isNotEmpty ?? false;

  /// Re-runs the scrape with the saved credential, so attendance is current
  /// without the student doing anything.
  ///
  /// Silent by design: this runs on app open, and a student who opened Handy to
  /// look at their timetable did not ask to be told the network was slow. The
  /// one failure worth acting on is a rejected password, which clears the saved
  /// credential so the next sign-in asks for it properly rather than looping.
  Future<bool> resync() async {
    final roll = await _storage.read(key: _rollKey);
    final password = await _storage.read(key: _passwordKey);
    final campusWire = await _storage.read(key: _campusKey);
    if (roll == null || password == null || campusWire == null) return false;

    final campus = Campus.values.where((c) => c.wire == campusWire).firstOrNull;
    if (campus == null) return false;

    try {
      await _verify(rollNumber: roll, password: password, campus: campus);
      return true;
    } on PortalAuthException catch (error) {
      if (error.code == 'invalid_credentials') await forget();
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Drops the saved credential. Called on sign-out, and when the college
  /// rejects it.
  Future<void> forget() async {
    await _storage.delete(key: _rollKey);
    await _storage.delete(key: _passwordKey);
    await _storage.delete(key: _campusKey);
  }

  /// POSTs to /api/verify and returns the Firebase custom token.
  Future<String> _verify({
    required String rollNumber,
    required String password,
    required Campus campus,
  }) async {
    late http.Response response;
    try {
      response = await _client
          .post(
            Uri.parse('$_base/api/verify'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'rollNumber': rollNumber,
              'password': password,
              'campus': campus.wire,
            }),
          )
          // The server signs in to the college portal and scrapes three pages
          // within this call, so the ceiling is generous — but it is a ceiling,
          // because a spinner that never resolves is worse than an error.
          .timeout(const Duration(seconds: 45));
    } catch (_) {
      throw PortalAuthException('network', 'Could not reach Handy. Check your connection.');
    }

    if (response.statusCode != 200) {
      final body = _decode(response.body);
      final code = (body?['error'] as String?) ?? _codeForStatus(response.statusCode);
      throw PortalAuthException(code, _messages[code] ?? _fallback);
    }

    final body = _decode(response.body);
    final token = body?['token'] as String?;
    if (token == null || token.isEmpty) {
      throw PortalAuthException('no_token', _fallback);
    }
    return token;
  }

  Map<String, dynamic>? _decode(String body) {
    try {
      return jsonDecode(body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static String _codeForStatus(int status) => switch (status) {
        401 => 'invalid_credentials',
        403 => 'campus_locked',
        409 => 'use_extension',
        429 => 'rate_limited',
        502 => 'portal_returned_nothing',
        _ => 'portal_failed',
      };

  static const _fallback = 'Something went wrong reaching the college portal. Try again shortly.';

  static const _messages = <String, String>{
    'invalid_credentials':
        'That roll number and portal password did not work. This is your college portal password, not a Handy one.',
    'campus_locked': 'Your campus is switched off for maintenance. Try again shortly.',
    'use_extension':
        'Aditya University accounts sync through the Handy browser extension on a laptop, which never needs your college password.',
    'portal_returned_nothing':
        'Signed in, but the college portal sent nothing back. That is usually temporary — try again in a minute.',
    'rate_limited': 'Too many attempts. Wait a few minutes before trying again.',
    'unsupported_campus': 'Handy does not recognise that roll number\'s campus yet.',
  };
}

class PortalAuthException implements Exception {
  const PortalAuthException(this.code, this.message);
  final String code;
  final String message;

  @override
  String toString() => message;
}
