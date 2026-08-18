import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/installer.dart';
import '../data/updates.dart';
import '../main.dart';
import 'app_icon.dart';

/// Tells a student there is a newer Handy, and installs it.
///
/// Deliberately a sheet and not a full screen: for an optional update the app
/// behind it still works, and hiding a working app behind an advert for a
/// slightly better one is a bad trade. A required update is a different case —
/// that one cannot be dismissed, because the build underneath is known to
/// misbehave.
///
/// The button used to open a browser. It now downloads and installs in place
/// (see installer.dart), because the browser round-trip was where most updates
/// were abandoned: a file in the Downloads folder is a chore, and a chore is
/// something a student does later, meaning never.
Future<void> showUpdateSheet(BuildContext context, AppUpdate update) {
  return showModalBottomSheet<void>(
    context: context,
    isDismissible: !update.required,
    enableDrag: !update.required,
    isScrollControlled: true,
    showDragHandle: !update.required,
    builder: (sheetContext) => PopScope(
      // Blocks the back gesture too, or "cannot be dismissed" means "cannot be
      // dismissed by the one route the user did not think to try".
      canPop: !update.required,
      child: _UpdateSheet(update: update),
    ),
  );
}

class _UpdateSheet extends StatefulWidget {
  const _UpdateSheet({required this.update});

  final AppUpdate update;

  @override
  State<_UpdateSheet> createState() => _UpdateSheetState();
}

enum _Stage { idle, downloading, handingOver, blocked, failed }

class _UpdateSheetState extends State<_UpdateSheet> {
  final _installer = Installer();

  _Stage _stage = _Stage.idle;
  double? _progress;
  String? _error;

  Future<void> _start() async {
    // Asked for only when there is actually something to install. A permission
    // prompt at launch, before anyone has agreed to anything, is the kind a
    // student refuses on principle and then cannot find again.
    if (!await _installer.canInstall) {
      if (mounted) setState(() => _stage = _Stage.blocked);
      return;
    }
    await _install();
  }

  Future<void> _install() async {
    setState(() {
      _stage = _Stage.downloading;
      _progress = null;
      _error = null;
    });

    try {
      await _installer.downloadAndInstall(
        widget.update.downloadUrl,
        version: widget.update.version,
        onProgress: (value) {
          if (mounted) setState(() => _progress = value);
        },
      );
      // The system's own confirmation is now on screen, on top of this sheet.
      // Staying on "downloading" behind it would be a lie about what is
      // happening, and the app cannot know how it ends — Android does not tell
      // an app that it is about to be replaced.
      if (mounted) setState(() => _stage = _Stage.handingOver);
    } on InstallerException catch (e) {
      if (mounted) {
        setState(() {
          _stage = _Stage.failed;
          _error = e.message;
        });
      }
    }
  }

  /// The way out when the phone will not let Handy install anything, and the
  /// last resort when the install fails for a reason we cannot name.
  Future<void> _openInBrowser() async {
    final url = widget.update.downloadUrl;
    if (url.isEmpty) return;
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not open $url')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final update = widget.update;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        8,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: AppIcon(
                    HugeIcons.strokeRoundedArrowRight01,
                    size: 20,
                    color: scheme.primary,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      update.required ? 'Update required' : 'Update available',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      'Version ${update.version}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (update.changelog.isNotEmpty && _stage == _Stage.idle) ...[
            const SizedBox(height: 18),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: SingleChildScrollView(
                child: Text(
                  update.changelog,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
                ),
              ),
            ),
          ],

          if (update.required && _stage == _Stage.idle) ...[
            const SizedBox(height: 16),
            Text(
              'This version is too old to keep working correctly, so Handy will '
              'not continue until it is updated.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],

          const SizedBox(height: 22),
          ..._body(context),
        ],
      ),
    );
  }

  List<Widget> _body(BuildContext context) => switch (_stage) {
        _Stage.idle => [
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _start,
                child: const Text('Update now'),
              ),
            ),
            if (!widget.update.required)
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    updates.dismiss(widget.update.version);
                    Navigator.of(context).pop();
                  },
                  child: const Text('Not now'),
                ),
              ),
            const SizedBox(height: 4),
            _Note(
              // "Will I lose my data" is the question that stops people
              // updating, so it is answered before it is asked.
              'Downloads and installs inside Handy. Everything you have stays.',
            ),
          ],

        _Stage.downloading => [
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: _progress,
                minHeight: 8,
                backgroundColor: Theme.of(context).dividerColor,
              ),
            ),
            const SizedBox(height: 12),
            _Note(
              _progress == null
                  ? 'Downloading…'
                  : 'Downloading… ${(_progress! * 100).toStringAsFixed(0)}%',
            ),
          ],

        _Stage.handingOver => [
            _Note(
              'Android is asking you to confirm the install. If a warning about '
              'an unknown app appears, that is Android noticing Handy did not '
              'come from the Play Store — choose to install anyway.',
            ),
          ],

        _Stage.blocked => [
            _Note(
              'Android needs your permission to let Handy install updates. It is '
              'asked once, and you will not see this again.',
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  await _installer.openInstallSettings();
                  // Back on this sheet afterwards, where the button now works.
                  if (mounted) setState(() => _stage = _Stage.idle);
                },
                child: const Text('Open settings'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: _openInBrowser,
                child: const Text('Download in a browser instead'),
              ),
            ),
          ],

        _Stage.failed => [
            Text(
              _error ?? 'The update could not be installed.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _install, child: const Text('Try again')),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: _openInBrowser,
                child: const Text('Download in a browser instead'),
              ),
            ),
          ],
      };
}

class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: Theme.of(context).textTheme.bodySmall);
}
