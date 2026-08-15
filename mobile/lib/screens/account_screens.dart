import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../main.dart';
import '../widgets/detail_row.dart';
import '../widgets/student_photo.dart';

/// Who you are, as the college holds it — plus the one field that is yours.
///
/// Everything here except the preferred name is read-only, and the screen says
/// so rather than presenting editable-looking fields that silently refuse. The
/// portal is the record; Handy is a reader of it.
class PersonalInformationScreen extends StatelessWidget {
  const PersonalInformationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final student = AppStateScope.of(context).student;

    return Scaffold(
      appBar: AppBar(title: const Text('Personal information')),
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
          children: [
            Center(
              child: StudentPhoto(
                rollNumber: student?.rollNumber,
                name: student?.name,
                size: 108,
                circle: true,
                ring: true,
              ),
            ),
            const SizedBox(height: 24),

            Text('WHAT HANDY CALLS YOU', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _PreferredNameField(),
                    const SizedBox(height: 10),
                    Text(
                      'The college records a full legal name in block capitals, '
                      'which is nobody’s name for themselves. This is used on '
                      'the home screen. Leave it empty to use your first name.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 22),
            Text('COLLEGE RECORD', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  children: [
                    DetailRow(label: 'Name', value: student?.name),
                    DetailRow(label: 'Roll number', value: student?.rollNumber),
                    DetailRow(label: 'Sign-in', value: student?.rollNumber),
                    DetailRow(
                      label: 'Photo',
                      value: student?.rollNumber == null ? null : 'From the college',
                      last: true,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'None of this can be changed in Handy. If something here is wrong '
              'it is wrong in the college record too, and your department is the '
              'place to fix it.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// Course, year, department — and what the semester adds up to.
class AcademicInformationScreen extends StatelessWidget {
  const AcademicInformationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppStateScope.of(context);
    final student = state.student;
    final weekly = state.entries.where((e) => e.active).length;

    return Scaffold(
      appBar: AppBar(title: const Text('Academic information')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          Text('COURSE', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                children: [
                  DetailRow(label: 'Course', value: student?.course),
                  DetailRow(label: 'Branch', value: student?.department),
                  DetailRow(
                    label: 'Year',
                    value: student?.year == null ? null : 'Year ${student!.year}',
                  ),
                  DetailRow(label: 'Section', value: student?.section, last: true),
                ],
              ),
            ),
          ),

          const SizedBox(height: 22),
          Text('THIS SEMESTER', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                children: [
                  DetailRow(label: 'Subjects', value: '${state.subjects.length}'),
                  DetailRow(label: 'Periods a week', value: '$weekly'),
                  DetailRow(
                    label: 'Classes held',
                    value: '${state.summaries.fold<int>(0, (t, s) => t + s.held)}',
                  ),
                  DetailRow(
                    label: 'Attended',
                    value: '${state.summaries.fold<int>(0, (t, s) => t + s.attended)}',
                    last: true,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// What Handy is allowed to interrupt you for.
///
/// The distinction that matters and is worth stating: class and deadline
/// reminders are scheduled on the phone, so they work with no signal and
/// nothing is sent anywhere to produce them. Only the "new data" alert
/// involves a server.
class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 36),
          children: [
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    value: settings.remindDeadlines,
                    onChanged: (v) => settings.setRemindDeadlines(v),
                    title: const Text('Deadline reminders'),
                    subtitle: Text(
                      'Two days before, and again the evening before',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  SwitchListTile(
                    value: settings.remindClasses,
                    onChanged: (v) => settings.setRemindClasses(v),
                    title: const Text('Class reminders'),
                    subtitle: Text(
                      'Shortly before a class starts',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  SwitchListTile(
                    value: settings.notifyNewData,
                    onChanged: (v) async {
                      await settings.setNotifyNewData(v);
                      // The server decides whether to send, so the preference
                      // has to reach it — a switch that only changed a value
                      // on this phone would have gone on being ignored.
                      await repository.setNotifyNewData(v);
                    },
                    title: const Text('New data'),
                    subtitle: Text(
                      'When your attendance or timetable updates',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Class and deadline reminders are scheduled on this phone, so they '
              'arrive with no signal and nothing leaves the device to produce '
              'them. Only "new data" comes from a server.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Turning "new data" off silences the notification but still lets '
              'your home-screen widgets update in the background.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 14),
            Text(
              'Android also has its own switch for Handy in system Settings. If '
              'nothing arrives at all, that is the one to check.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// Saved on change rather than behind a button — a settings field with a Save
/// button people forget to press is worse than one that just works.
class _PreferredNameField extends StatefulWidget {
  const _PreferredNameField();

  @override
  State<_PreferredNameField> createState() => _PreferredNameFieldState();
}

class _PreferredNameFieldState extends State<_PreferredNameField> {
  late final TextEditingController _controller =
      TextEditingController(text: settings.preferredName);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      textCapitalization: TextCapitalization.words,
      decoration: const InputDecoration(
        labelText: 'Preferred name',
        hintText: 'Pardhu',
      ),
      onChanged: settings.setPreferredName,
    );
  }
}
