import 'package:flutter/material.dart';

import '../main.dart';
import '../models/models.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';
import '../widgets/form_sheet.dart';
import 'leave_planner_screen.dart';

/// Leave requests — the half of taking a day off that involves a person.
///
/// Deliberately next to the Leave Planner and deliberately not the same thing,
/// which is the one confusion worth designing against: the planner answers
/// "what would Thursday cost me", and a Thursday it calls safe is still a
/// Thursday nobody has approved. This is where you ask.
///
/// Read-only after filing, because that is all the security rules allow: a
/// student may create a request with status `pending` and can never touch it
/// again. Showing an edit button for a write Firestore would reject is worse
/// than showing none.
class LeavesScreen extends StatefulWidget {
  const LeavesScreen({super.key});

  @override
  State<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends State<LeavesScreen> {
  late Future<List<LeaveRequest>> _requests = repository.leaveRequests();

  Future<void> _reload() async {
    final next = repository.leaveRequests();
    setState(() => _requests = next);
    await next;
  }

  Future<void> _compose() async {
    final filed = await showFormSheet<bool>(
      context: context,
      builder: (_) => const LeaveRequestForm(),
    );
    if (filed == true) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leaves')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _compose,
        icon: AppIcon(HugeIcons.strokeRoundedAdd01, size: 18),
        label: const Text('Request'),
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<LeaveRequest>>(
          future: _requests,
          builder: (context, snapshot) {
            final requests = snapshot.data;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                const _PlannerCta(),
                const SizedBox(height: 18),

                if (snapshot.connectionState == ConnectionState.waiting)
                  const _Quiet('Loading your requests…')
                else if (snapshot.hasError)
                  _Retry(onRetry: _reload)
                else if (requests == null || requests.isEmpty)
                  const _Quiet(
                    'No leave requests yet. Filing one here sends it to your '
                    'administration for approval.',
                  )
                else ...[
                  const _Label('Your requests'),
                  const SizedBox(height: 10),
                  for (final request in requests) ...[
                    _RequestCard(request: request),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The way across to the planner, because the two questions arrive together:
/// nobody asks for a Thursday off without first wondering what it costs.
class _PlannerCta extends StatelessWidget {
  const _PlannerCta();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const LeavePlannerScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              AppIcon(
                HugeIcons.strokeRoundedCoffee02,
                size: 19,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Leave Planner',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    Text(
                      'Check what a day off costs before you ask for it',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              AppIcon(HugeIcons.strokeRoundedArrowRight01, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});
  final LeaveRequest request;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _range(request),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                _StatusBadge(status: request.status),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              '${request.days} day${request.days == 1 ? '' : 's'} · filed '
              '${_shortDate(request.submittedAt)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (request.reason.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(request.reason, style: Theme.of(context).textTheme.bodyMedium),
            ],
            // Only once someone has actually looked at it. "Reviewed —" with
            // nothing after it reads as a system that lost the answer.
            if (request.reviewedAt case final at?) ...[
              const SizedBox(height: 8),
              Text(
                'Reviewed ${_shortDate(at)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _range(LeaveRequest request) {
    final from = _shortDate(request.startDate);
    final to = _shortDate(request.endDate);
    return from == to ? from : '$from – $to';
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final LeaveStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, colour) = switch (status) {
      LeaveStatus.approved => ('Approved', HandyColors.good),
      LeaveStatus.rejected => ('Rejected', HandyColors.bad),
      LeaveStatus.pending => ('Pending', HandyColors.warn),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: colour),
      ),
    );
  }
}

/// Filing a request. Three fields, because that is all a request is.
class LeaveRequestForm extends StatefulWidget {
  const LeaveRequestForm({super.key, this.startOn});

  /// Prefilled when arriving from a date the student was already looking at,
  /// the way the web's planner hands one over.
  final DateTime? startOn;

  @override
  State<LeaveRequestForm> createState() => _LeaveRequestFormState();
}

class _LeaveRequestFormState extends State<LeaveRequestForm> {
  final _reason = TextEditingController();
  late DateTime _from = widget.startOn ?? _tomorrow();
  late DateTime _to = widget.startOn ?? _tomorrow();
  bool _busy = false;
  String? _error;

  /// The web asks for ten characters. A one-word reason is not a reason
  /// somebody can approve, and the rule is worth keeping identical on both
  /// sides so the same request is acceptable from either.
  static const _minReason = 10;

  static DateTime _tomorrow() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 1, 12, 31),
      initialDateRange: DateTimeRange(start: _from, end: _to),
    );
    if (picked == null) return;
    setState(() {
      _from = picked.start;
      _to = picked.end;
    });
  }

  Future<void> _submit() async {
    final reason = _reason.text.trim();
    if (reason.length < _minReason) {
      setState(() => _error = 'Please give a bit more detail — $_minReason characters or more.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await repository.submitLeaveRequest(startDate: _from, endDate: _to, reason: reason);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Could not file that request. Check your connection and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final days = _to.difference(_from).inDays + 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Request leave', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            'This goes to your administration for approval. It is separate from '
            "the Leave Planner's attendance check.",
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),

          OutlinedButton.icon(
            onPressed: _busy ? null : _pickRange,
            icon: AppIcon(HugeIcons.strokeRoundedCalendar03, size: 17),
            label: Text(
              _from == _to
                  ? _shortDate(_from)
                  : '${_shortDate(_from)} – ${_shortDate(_to)}  ·  $days days',
            ),
          ),
          const SizedBox(height: 14),

          TextField(
            controller: _reason,
            autofocus: true,
            minLines: 3,
            maxLines: 5,
            maxLength: 500,
            enabled: !_busy,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              hintText: 'Why do you need this leave?',
            ),
          ),

          if (_error case final message?) ...[
            const SizedBox(height: 4),
            Text(
              message,
              style: TextStyle(color: HandyColors.bad, fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ],

          const SizedBox(height: 14),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Send request'),
          ),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}

class _Quiet extends StatelessWidget {
  const _Quiet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 4),
        child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
      );
}

class _Retry extends StatelessWidget {
  const _Retry({required this.onRetry});
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Could not load your leave requests.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      );
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String _shortDate(DateTime d) => '${d.day} ${_months[d.month - 1]}';
