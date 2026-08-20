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

    final uri = Uri.tryParse(url);
    if (uri == null || uri.scheme.toLowerCase() != 'https') {
      throw const InstallerException(
        'That update link is not secure, so it was not downloaded.',
      );
    }

    try {
      await _channel.invokeMethod('showDownloadProgress', {'version': version, 'progress': -1});
      final file = await _download(uri, version, onProgress);

      final trusted = await _channel.invokeMethod<bool>('verify', {'path': file.path});
      if (trusted != true) {
        await file.delete().catchError((_) => file);
        await _channel.invokeMethod('cancelDownloadProgress');
        throw const InstallerException(
          'That download was not signed by Handy, so it was not installed. '
          'Get the update from the Handy website instead.',
        );
      }

      await _channel.invokeMethod('showDownloadProgress', {'version': version, 'progress': 100});
      await _channel.invokeMethod('install', {'path': file.path});
    } on PlatformException catch (e) {
      await _channel.invokeMethod('cancelDownloadProgress');
      throw InstallerException(e.message ?? 'Android would not start the install.');
    } catch (e) {
      await _channel.invokeMethod('cancelDownloadProgress');
      rethrow;
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
    final file = File('$directory/handy-$version.apk');
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
    var lastPct = -1;
    final sink = part.openWrite();
    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        final progress = (total == null || total == 0) ? null : received / total;
        onProgress?.call(progress);
        if (progress != null) {
          final pct = (progress * 100).round();
          if (pct != lastPct) {
            lastPct = pct;
            _channel.invokeMethod('showDownloadProgress', {'version': version, 'progress': pct});
          }
        }
      }
      await sink.flush();
    } catch (_) {
      broke = true;
    } finally {
      await sink.close();
    }

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
