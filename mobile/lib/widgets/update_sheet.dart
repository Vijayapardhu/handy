import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/updates.dart';
import '../main.dart';
import 'app_icon.dart';

/// Tells a student there is a newer Handy, and how to get it.
///
/// Deliberately a sheet and not a full screen: for an optional update the app
/// behind it still works, and hiding a working app behind an advert for a
/// slightly better one is a bad trade. A required update is a different case —
/// that one cannot be dismissed, because the build underneath is known to
/// misbehave.
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

class _UpdateSheet extends StatelessWidget {
  const _UpdateSheet({required this.update});

  final AppUpdate update;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

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

          if (update.changelog.isNotEmpty) ...[
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

          if (update.required) ...[
            const SizedBox(height: 16),
            Text(
              'This version is too old to keep working correctly, so Handy will '
              'not continue until it is updated.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],

          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _download(context, update.downloadUrl),
              child: const Text('Download the update'),
            ),
          ),
          if (!update.required)
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () {
                  updates.dismiss(update.version);
                  Navigator.of(context).pop();
                },
                child: const Text('Not now'),
              ),
            ),
          const SizedBox(height: 4),
          Text(
            // The APK installs over the existing app, so this is worth saying:
            // "will I lose my data" is the question that stops people updating.
            'Downloads the app file. Installing it keeps everything you have.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

Future<void> _download(BuildContext context, String url) async {
  final messenger = ScaffoldMessenger.of(context);
  if (url.isEmpty) {
    messenger.showSnackBar(
      const SnackBar(content: Text('No download link was published with this update.')),
    );
    return;
  }
  try {
    final launched = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!launched) throw Exception('no handler');
  } catch (_) {
    messenger.showSnackBar(SnackBar(content: Text('Could not open $url')));
  }
}
