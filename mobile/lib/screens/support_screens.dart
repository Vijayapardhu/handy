import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/app_state.dart';
import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/skeleton.dart';

/// Version shown in About and attached to every piece of feedback.
///
/// A single constant rather than package_info_plus: this needs to be the same
/// string in both places and readable from a background isolate, and one line
/// beats a plugin for that.
const handyVersion = '0.1.0';

/// Help, answered from Firestore.
///
/// The entries live in the `faqs` collection (seeded by scripts/seed-faqs.mjs)
/// rather than in this file, because an answer that needs an app release to
/// correct will stay wrong — and the questions students actually ask are not
/// the ones anticipated at build time.
class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  late Future<List<Faq>> _future = repository.faqs();
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & FAQ')),
      body: FutureBuilder<List<Faq>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const ListSkeleton(rows: 6, height: 68);
          }
          if (snapshot.hasError) {
            return _Retry(onRetry: () => setState(() => _future = repository.faqs()));
          }

          final all = snapshot.data ?? const <Faq>[];
          final needle = _query.trim().toLowerCase();
          final faqs = needle.isEmpty
              ? all
              : all
                  .where((f) =>
                      f.question.toLowerCase().contains(needle) ||
                      f.answer.toLowerCase().contains(needle))
                  .toList();

          // Grouped by category, in the order the categories first appear —
          // which is the curated order, not alphabetical.
          final categories = <String, List<Faq>>{};
          for (final faq in faqs) {
            categories.putIfAbsent(faq.category, () => []).add(faq);
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: 'Search help',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => setState(() => _query = ''),
                        ),
                ),
              ),
              const SizedBox(height: 16),

              if (faqs.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Column(
                    children: [
                      Text(
                        needle.isEmpty
                            ? 'No help articles yet.'
                            : 'Nothing matches "$_query".',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 14),
                      FilledButton.tonalIcon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(builder: (_) => const FeedbackScreen()),
                        ),
                        icon: const Icon(Icons.mail_outline, size: 18),
                        label: const Text('Ask us instead'),
                      ),
                    ],
                  ),
                ),

              for (final entry in categories.entries) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
                  child: Text(entry.key.toUpperCase(),
                      style: Theme.of(context).textTheme.labelSmall),
                ),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: entry.value
                        .map((faq) => ExpansionTile(
                              title: Text(faq.question,
                                  style: const TextStyle(
                                      fontSize: 14.5, fontWeight: FontWeight.w600)),
                              childrenPadding:
                                  const EdgeInsets.fromLTRB(16, 0, 16, 16),
                              expandedCrossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(faq.answer,
                                    style: Theme.of(context).textTheme.bodyMedium),
                              ],
                            ))
                        .toList(),
                  ),
                ),
              ],

              if (faqs.isNotEmpty) ...[
                const SizedBox(height: 24),
                Center(
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const FeedbackScreen()),
                    ),
                    icon: const Icon(Icons.mail_outline, size: 18),
                    label: const Text("Didn't find it? Send us a message"),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Feedback, stored in Firestore.
///
/// Write-only by design: firestore.rules refuses reads to every client,
/// including the student who wrote it. That is not an oversight — a readable
/// feedback collection is one rule change away from exposing everyone's
/// complaints, and nothing in the app needs to read them back.
class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  static const _kinds = ['Something is broken', 'An idea', 'A question', 'Anything else'];

  final _message = TextEditingController();
  final _contact = TextEditingController();
  String _kind = _kinds.first;
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    _contact.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_message.text.trim().isEmpty) {
      setState(() => _error = 'Write something first.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await repository.sendFeedback(
        message: _message.text,
        kind: _kind,
        appVersion: handyVersion,
        rollNumber: AppStateScope.of(context).student?.rollNumber,
        contact: _contact.text,
      );
      setState(() => _sent = true);
    } catch (e) {
      setState(() => _error = 'Could not send that. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: _sent
            ? Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle, color: HandyColors.good, size: 22),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Sent — thank you',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 4),
                            Text(
                              'Handy is one student maintaining it in their spare time, '
                              'so a reply may take a while — but it is read.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Found something broken, or something missing? This goes '
                    'straight to whoever maintains Handy.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 18),

                  Text('WHAT IS IT', style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _kinds
                        .map((k) => ChoiceChip(
                              label: Text(k),
                              selected: _kind == k,
                              onSelected: (_) => setState(() => _kind = k),
                            ))
                        .toList(),
                  ),

                  const SizedBox(height: 18),
                  TextField(
                    controller: _message,
                    maxLines: 6,
                    maxLength: 4000,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'What happened, or what would you change?',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _contact,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email or phone (optional)',
                      helperText: 'Only if you want a reply',
                    ),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: HandyColors.bad.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(_error!,
                          style: const TextStyle(color: HandyColors.bad, fontSize: 13)),
                    ),
                  ],

                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _busy ? null : _send,
                    style: FilledButton.styleFrom(padding: const EdgeInsets.all(15)),
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.2, color: Colors.white),
                          )
                        : const Text('Send'),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Your roll number and app version are attached so the '
                    'problem can be traced. Nothing else is.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
      ),
    );
  }
}

/// What Handy is, where it came from, and who to blame.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const _website = 'https://handy.vijayaapardhu.dev';
  static const _github = 'https://github.com/Vijayapardhu';
  static const _portfolio = 'https://vijayaapardhu.dev';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('About Handy')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: scheme.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Text(
                  'H',
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    color: scheme.onPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Handy', style: Theme.of(context).textTheme.headlineMedium),
                    Text('Version $handyVersion',
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 26),
          const _Heading('How it started'),
          const _Body(
            'Every student at Aditya University has the same routine: open the '
            'portal, sign in, find the attendance page, read a table, and do the '
            'arithmetic in your head. How many can I miss? How many do I need? '
            'The answer matters — below 75% and you are in trouble — and the one '
            'place that knows it makes you work for it every single time.',
          ),
          const _Body(
            'Handy started as a way to stop doing that. Not a better portal — a '
            'straight answer. Open the app and the number is there, already '
            'translated into what it actually means: you can miss three more, or '
            'you need to attend the next thirteen in a row.',
          ),
          const _Body(
            'It grew from there, because once your attendance and timetable are '
            'in one place the rest follows: what class is next and where, which '
            'periods are free, what is due this week, a reminder before it is. '
            'All of it built around the same idea — the app should have done the '
            'thinking before you opened it.',
          ),

          const SizedBox(height: 22),
          const _Heading('What Handy will not do'),
          const _Body(
            'It will not invent a number. Every attendance figure comes from the '
            'college record exactly as the college holds it, and cannot be edited '
            'in the app — an app that let you tidy up your own attendance would '
            'only be lying to you more comfortably.',
          ),
          const _Body(
            'It will not show your attendance to other students, rank you against '
            'them, sell anything to advertisers, or charge you. There is no paid '
            'tier and there are no adverts.',
          ),

          const SizedBox(height: 22),
          const _Heading('Who built it'),
          const _Body(
            'Handy is built and maintained by Vijaya Pardhu Magapu — a student at '
            'Aditya University, writing it alongside the same coursework it is '
            'meant to help with. It is an independent project: not affiliated '
            'with, endorsed by, or operated by the university, which remains the '
            'authority on your attendance.',
          ),

          const SizedBox(height: 14),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _LinkRow(
                  icon: Icons.language,
                  label: 'handy.vijayaapardhu.dev',
                  detail: 'Handy on the web',
                  url: _website,
                ),
                Divider(height: 1, color: Theme.of(context).dividerColor),
                _LinkRow(
                  icon: Icons.public,
                  label: 'vijayaapardhu.dev',
                  detail: 'Portfolio',
                  url: _portfolio,
                ),
                Divider(height: 1, color: Theme.of(context).dividerColor),
                _LinkRow(
                  icon: Icons.code,
                  label: 'github.com/Vijayapardhu',
                  detail: 'GitHub',
                  url: _github,
                ),
              ],
            ),
          ),

          const SizedBox(height: 26),
          Center(
            child: Text(
              'Made in Surampalem, between lectures.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({
    required this.icon,
    required this.label,
    required this.detail,
    required this.url,
  });

  final IconData icon;
  final String label;
  final String detail;
  final String url;

  /// Opens the link, and says so when it can't.
  ///
  /// This used to be gated on `canLaunchUrl` and do nothing when it returned
  /// false, which is the worst of both: on Android 11+ that call answers false
  /// unless the manifest declares an https `intent` in `queries`, so the links
  /// were dead *and* silent about it. The manifest is fixed; this no longer
  /// asks permission before trying, and a genuine failure now reports itself
  /// with the address, so the link can at least be copied out.
  Future<void> _open(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final launched = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
      if (!launched) throw Exception('no handler');
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Could not open $url'),
          action: SnackBarAction(
            label: 'Copy',
            onPressed: () => Clipboard.setData(ClipboardData(text: url)),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _open(context),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, size: 19, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(detail, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const Icon(Icons.open_in_new, size: 16),
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
      );
}

class _Body extends StatelessWidget {
  const _Body(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
        ),
      );
}

class _Retry extends StatelessWidget {
  const _Retry({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Could not load help right now.',
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            FilledButton.tonal(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      );
}
