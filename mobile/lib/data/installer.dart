import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Downloads a Handy update and hands it to Android's installer.
///
/// The old flow was a link: tap it, land in a browser, find the file in
/// Downloads, tap that, grant a permission, install. Six steps, four of them
/// outside the app, and every one somewhere to give up — which is why a fix
/// shipped in one release was still missing from half the phones months later.
///
/// Worth being plain about what this does not fix. Play Protect will still say
/// its piece about an app that did not come from the Play Store: that warning
/// depends on whether Google recognises the signing key, not on anything here,
/// and only shipping through Play makes a key recognised. What goes away is
/// everything around it — the browser, the Downloads folder, and re-granting
/// permission on every single update.
class Installer {
  Installer({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const _channel = MethodChannel('dev.vijayaapardhu.handy/installer');

  /// Whether Android will currently let Handy install anything.
  ///
  /// False is the normal first answer, not a failure: the permission is
  /// per-app and granted once, in Settings.
  Future<bool> get canInstall async =>
      await _channel.invokeMethod<bool>('canInstall') ?? false;

  /// Opens the one Settings screen that grants it, for this app specifically.
  Future<void> openInstallSettings() => _channel.invokeMethod('openInstallSettings');

  /// Fetches [url] and installs it, reporting download progress as it goes.
  ///
  /// [onProgress] receives 0..1, or null while the server has not said how
  /// large the file is — a determinate bar that jumps to full because the
  /// length was unknown is worse than an honest spinner.
  ///
  /// Throws [InstallerException] with something a student can act on.
  Future<void> downloadAndInstall(
    String url, {
    required String version,
    void Function(double? progress)? onProgress,
  }) async {
    if (url.isEmpty) {
      throw const InstallerException('No download link was published with this update.');
    }

    // The link is a field in Firestore typed by a person in the admin panel,
    // so it is checked rather than trusted. An http:// URL would put the APK on
    // the wire in the clear, where anyone on the same cafe network could swap
    // it — and the whole point of installing in-app is that nobody has to
    // inspect what they are installing. Android blocks cleartext at this
    // targetSdk anyway; this fails with a reason instead of a socket error.
    final uri = Uri.tryParse(url);
    if (uri == null || uri.scheme.toLowerCase() != 'https') {
      throw const InstallerException(
        'That update link is not secure, so it was not downloaded.',
      );
    }

    final file = await _download(uri, version, onProgress);

    // Checked before anything is installed, and this is the point of doing it
    // here rather than letting Android find out: an update is an APK fetched
    // from a URL held in Firestore, so anyone able to change that field — or
    // to sit between the phone and the file — could otherwise offer something
    // that merely looks like Handy to a device already signed in as this
    // student. Android would refuse a mismatched signature too, but only after
    // the fact and only with "App not installed".
    final trusted = await _channel.invokeMethod<bool>('verify', {'path': file.path});
    if (trusted != true) {
      await file.delete().catchError((_) => file);
      throw const InstallerException(
        'That download was not signed by Handy, so it was not installed. '
        'Get the update from the Handy website instead.',
      );
    }

    try {
      await _channel.invokeMethod('install', {'path': file.path});
    } on PlatformException catch (e) {
      throw InstallerException(e.message ?? 'Android would not start the install.');
    }
  }

  Future<File> _download(
    Uri url,
    String version,
    void Function(double?)? onProgress,
  ) async {
    final directory = await _channel.invokeMethod<String>('cacheDir');
    if (directory == null) {
      throw const InstallerException('Nowhere to save the download.');
    }
    // Named for the version so a half-finished download of an older update is
    // never mistaken for this one.
    final file = File('$directory/handy-$version.apk');
    // Written beside the target and renamed at the end. A download interrupted
    // halfway leaves a .part behind rather than a truncated file with the real
    // name, which the next attempt would happily try to install.
    final part = File('${file.path}.part');

    http.StreamedResponse response;
    try {
      response = await _client
          .send(http.Request('GET', url))
          .timeout(const Duration(minutes: 5));
    } catch (_) {
      throw const InstallerException('Could not reach the download. Check your connection.');
    }

    if (response.statusCode != 200) {
      throw InstallerException(
        'The download link returned ${response.statusCode}. It may have moved.',
      );
    }

    final total = response.contentLength;
    var received = 0;
    var broke = false;
    final sink = part.openWrite();
    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        onProgress?.call(total == null || total == 0 ? null : received / total);
      }
      await sink.flush();
    } catch (_) {
      broke = true;
    } finally {
      // Closed exactly once, and before the file is touched again: deleting a
      // file with a sink still open on it is a no-op on some platforms and an
      // error on others, and either way leaves the half-written download to be
      // found by the next attempt.
      await sink.close();
    }

    // A server that closes early leaves a plausible-looking file rather than
    // an obviously broken one. The signature check would reject it too, but
    // "the download stopped" is a truer answer than "this was not signed by
    // Handy" — the file is not forged, it is incomplete.
    if (broke || (total != null && total > 0 && received != total)) {
      await part.delete().catchError((_) => part);
      throw const InstallerException('The download stopped partway. Try again.');
    }

    if (await file.exists()) await file.delete();
    await part.rename(file.path);
    return file;
  }
}

class InstallerException implements Exception {
  const InstallerException(this.message);

  final String message;

  @override
  String toString() => message;
}
