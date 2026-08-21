import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/installer.dart';
import '../data/updates.dart';
import '../main.dart';
import '../theme.dart';
import 'app_icon.dart';

/// Tells a student there is a newer Handy, and installs it.
///
/// Deliberately a sheet and not a full screen: for an optional update the app
/// behind it still works, and hiding a working app behind an advert for a
/// slightly better one is a bad trade. A required update is a different case —
/// that one cannot be dismissed, because the build underneath is known to
/// misbehave. The gradient hero below is how that difference is felt before a
/// word is read — orange for "here if you want it", red for "this needs you" —
/// the same distinction FocusHero draws on the web Tasks page.
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
    final update = widget.update;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Hero(update: update),

          if (update.changelog.isNotEmpty && _stage == _Stage.idle) ...[
            const SizedBox(height: 20),
            Text(
              "WHAT'S NEW",
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
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
            const _Callout(
              icon: HugeIcons.strokeRoundedAlert02,
              tone: HandyColors.bad,
              text:
                  'This version is too old to keep working correctly, so Handy '
                  'will not continue until it is updated.',
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
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: _progress,
                      minHeight: 8,
                      backgroundColor: Theme.of(context).dividerColor,
                    ),
                  ),
                ),
                if (_progress != null) ...[
                  const SizedBox(width: 10),
                  Text(
                    '${(_progress! * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: HandyColors.orange,
                          fontSize: 12.5,
                        ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            _Note(_progress == null ? 'Downloading…' : 'Downloading the update…'),
          ],

        _Stage.handingOver => [
            const _Callout(
              icon: HugeIcons.strokeRoundedInformationCircle,
              tone: HandyColors.info,
              text:
                  'Android is asking you to confirm the install. If a warning about '
                  'an unknown app appears, that is Android noticing Handy did not '
                  'come from the Play Store — choose to install anyway.',
            ),
          ],

        _Stage.blocked => [
            const _Callout(
              icon: HugeIcons.strokeRoundedShield02,
              tone: HandyColors.warn,
              text:
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
            _Callout(
              icon: HugeIcons.strokeRoundedAlert02,
              tone: HandyColors.bad,
              text: _error ?? 'The update could not be installed.',
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

/// The gradient band that opens the sheet — orange for an optional update,
/// red for one that blocks the app until it is done. Mirrors FocusHero.tsx's
/// urgent/default split on the web Tasks page, translated into the app's own
/// gradient-card language (see the running-class card on Today).
class _Hero extends StatelessWidget {
  const _Hero({required this.update});

  final AppUpdate update;

  @override
  Widget build(BuildContext context) {
    final urgent = update.required;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: urgent
              ? const [HandyColors.bad, Color(0xFFA51515)]
              : const [HandyColors.orange, HandyColors.orangeDeep],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: AppIcon(
                urgent ? HugeIcons.strokeRoundedAlert02 : HugeIcons.strokeRoundedArrowRight01,
                size: 22,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  urgent ? 'UPDATE REQUIRED' : 'UPDATE AVAILABLE',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.7,
                    color: Colors.white70,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Version ${update.version}',
                  style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A tinted callout for the one line that matters at each stage — a
/// permission ask, a required-update warning, a failure. Colour carries the
/// tone so the sentence does not have to open with "Warning:" to read as one.
class _Callout extends StatelessWidget {
  const _Callout({required this.icon, required this.tone, required this.text});

  final AppIconData icon;
  final Color tone;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tone.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIcon(icon, size: 16, color: tone),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.45)),
          ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: Theme.of(context).textTheme.bodySmall);
}
