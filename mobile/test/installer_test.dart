import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handy/data/installer.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// The updater's refusals.
///
/// The happy path ends in a system dialog and cannot be reached from a test,
/// so what is pinned here is everything the updater declines to install —
/// which is the half that matters. Downloading an APK from a URL held in a
/// Firestore field and handing it to the package installer is, described
/// plainly, remote code execution; these checks are the whole of what stands
/// between that and "Handy installs whatever that field says".
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('dev.vijayaapardhu.handy/installer');
  late Directory cache;
  late List<String> calls;
  late bool signed;

  setUp(() {
    cache = Directory.systemTemp.createTempSync('handy-installer-test');
    calls = [];
    signed = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      return switch (call.method) {
        'cacheDir' => cache.path,
        'canInstall' => true,
        'verify' => signed,
        _ => null,
      };
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    if (cache.existsSync()) cache.deleteSync(recursive: true);
  });

  Installer serving(List<int> body, {int status = 200}) => Installer(
        client: MockClient((_) async => http.Response.bytes(body, status)),
      );

  Future<Object?> failureFrom(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (e) {
      return e;
    }
  }

  const url = 'https://handy.vijayaapardhu.dev/handy.apk';

  test('an empty link is refused before anything is fetched', () async {
    final error = await failureFrom(
      () => Installer().downloadAndInstall('', version: '1.0.4'),
    );
    expect(error, isA<InstallerException>());
    expect('$error', contains('No download link'));
    expect(calls, isEmpty);
  });

  test('anything but https is refused before anything is fetched', () async {
    // The link is typed by a person in the admin panel. Over http, anyone on
    // the same network can swap the file — and the premise of installing
    // in-app is precisely that nobody inspects what they are installing.
    for (final bad in [
      'http://handy.vijayaapardhu.dev/handy.apk',
      'HTTP://handy.vijayaapardhu.dev/handy.apk',
      'ftp://handy.vijayaapardhu.dev/handy.apk',
      'file:///sdcard/handy.apk',
      'not a url at all',
    ]) {
      final error = await failureFrom(
        () => Installer().downloadAndInstall(bad, version: '1.0.4'),
      );
      expect(error, isA<InstallerException>(), reason: bad);
      expect('$error', contains('not secure'), reason: bad);
    }
    expect(calls, isEmpty, reason: 'nothing should have been downloaded');
  });

  test('an https link is fetched and installed', () async {
    final error = await failureFrom(
      () => serving([1, 2, 3, 4]).downloadAndInstall(url, version: '1.0.4'),
    );
    expect(error, isNull);
    expect(calls, containsAllInOrder(['cacheDir', 'verify', 'install']));
    // The finished file keeps the real name; no .part is left behind.
    expect(File('${cache.path}/handy-1.0.4.apk').existsSync(), isTrue);
    expect(File('${cache.path}/handy-1.0.4.apk.part').existsSync(), isFalse);
  });

  test('a download not signed by Handy is deleted, not installed', () async {
    // The one that matters. Android would refuse a mismatched signature too,
    // but only after the fact and only with "App not installed" — by which
    // point a student has been shown an install prompt for a file that is not
    // Handy.
    signed = false;
    final error = await failureFrom(
      () => serving([1, 2, 3, 4]).downloadAndInstall(url, version: '1.0.4'),
    );
    expect(error, isA<InstallerException>());
    expect('$error', contains('not signed by Handy'));
    expect(calls, isNot(contains('install')));
    expect(File('${cache.path}/handy-1.0.4.apk').existsSync(), isFalse);
  });

  test('a link that has moved says so rather than installing the error page', () async {
    final error = await failureFrom(
      () => serving([], status: 404).downloadAndInstall(url, version: '1.0.4'),
    );
    expect(error, isA<InstallerException>());
    expect('$error', contains('404'));
    expect(calls, isNot(contains('install')));
  });

  test('an unreachable server is reported, not swallowed', () async {
    final installer = Installer(
      client: MockClient((_) async => throw const SocketException('down')),
    );
    final error = await failureFrom(
      () => installer.downloadAndInstall(url, version: '1.0.4'),
    );
    expect(error, isA<InstallerException>());
    expect('$error', contains('Could not reach'));
  });

  test('progress is reported and ends at one', () async {
    final seen = <double?>[];
    await failureFrom(
      () => serving(List.filled(2048, 7)).downloadAndInstall(
        url,
        version: '1.0.4',
        onProgress: seen.add,
      ),
    );
    expect(seen, isNotEmpty);
    expect(seen.last, 1.0);
  });
}
