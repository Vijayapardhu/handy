import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../data/settings.dart';
import '../main.dart';
import '../theme.dart';
import 'widget_settings_screen.dart';

/// Appearance and account. The two things a student can actually change —
/// everything else in Handy comes from the college's record.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            Text('YOUR NAME', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            const Card(child: Padding(padding: EdgeInsets.all(16), child: _PreferredNameField())),
            const SizedBox(height: 22),

            Text('APPEARANCE', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Column(
                  children: ThemeMode.values.map((mode) {
                    return RadioListTile<ThemeMode>(
                      value: mode,
                      groupValue: settings.themeMode,
                      onChanged: (v) => settings.setThemeMode(v!),
                      title: Text(switch (mode) {
                        ThemeMode.system => 'Match my phone',
                        ThemeMode.light => 'Light',
                        ThemeMode.dark => 'Dark',
                      }),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 22),
            Text('ACCENT', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: AccentChoice.values.map((choice) {
                    final selected = choice == settings.accent;
                    return GestureDetector(
                      onTap: () => settings.setAccent(choice),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: choice.colour,
                              shape: BoxShape.circle,
                              border: Border.all(
                                // The ring, not a tick inside the swatch: the
                                // colour is the thing being chosen and
                                // shouldn't have a mark painted over it.
                                color: selected
                                    ? Theme.of(context).colorScheme.onSurface
                                    : Colors.transparent,
                                width: 2.5,
                              ),
                            ),
                            child: selected
                                ? const Icon(Icons.check, color: Colors.white, size: 20)
                                : null,
                          ),
                          const SizedBox(height: 6),
                          Text(choice.label, style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 22),
            Text('WIDGETS', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const WidgetSettingsScreen()),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(18),
                  child: Row(
                    children: [
                      Icon(Icons.widgets_outlined, size: 19),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text('Home-screen widgets',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Icon(Icons.chevron_right, size: 20),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 22),
            Text('ACCOUNT', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 10),
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen()),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(18),
                  child: Row(
                    children: [
                      Icon(Icons.lock_outline, size: 20),
                      SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Change password',
                                style: TextStyle(fontWeight: FontWeight.w600)),
                            SizedBox(height: 2),
                            Text('Move off the shared default',
                                style: TextStyle(fontSize: 12.5)),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right, size: 20),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Changing the password of the account you're already signed into.
///
/// The only way a Handy password ever changes: accounts use synthetic
/// `<roll>@handy.local` addresses, which cannot receive a reset email, so
/// there is no "forgot password" flow to fall back on. The copy says so
/// rather than letting a student find out the hard way.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final password = _password.text;
    if (_current.text.isEmpty) {
      setState(() => _error = 'Enter your current password.');
      return;
    }
    if (password.length < 6) {
      setState(() => _error = 'Use at least 6 characters.');
      return;
    }
    if (password != _confirm.text) {
      setState(() => _error = 'The two passwords do not match.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user?.email == null) {
        setState(() => _error = 'You are not signed in. Sign in and try again.');
        return;
      }

      // The step this screen was missing. Firebase refuses updatePassword on
      // a session older than a few minutes with 'requires-recent-login', and
      // a student who signed in this morning is always past that — so the
      // change failed every time in normal use. Proving the current password
      // refreshes the session, which is exactly what Firebase is asking for,
      // and it is the check a password change should make anyway: without it
      // an unattended phone is enough to lock the owner out of their own
      // account.
      await user!.reauthenticateWithCredential(
        EmailAuthProvider.credential(email: user.email!, password: _current.text),
      );
      await user.updatePassword(password);
      setState(() => _done = true);
    } on FirebaseAuthException catch (e) {
      setState(() {
        _error = switch (e.code) {
          'wrong-password' ||
          'invalid-credential' ||
          'invalid-login-credentials' =>
            'That current password is not right.',
          'weak-password' => 'That password is too easy to guess. Try a longer one.',
          'network-request-failed' => 'No connection. Try again when you are back online.',
          'too-many-requests' => 'Too many attempts. Wait a minute and try again.',
          _ => 'Could not change the password. ${e.message ?? ''}'.trim(),
        };
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change password')),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: _done
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
                            Text('Password changed',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 4),
                            Text(
                              'Use it next time you sign in, here and on the website. '
                              'Syncing from your laptop carries on either way — it goes '
                              'through the server and never uses your password.',
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
                    'Accounts start on the shared default (${Repository.defaultPassword}). '
                    'Pick something only you know — roll numbers are public, so the '
                    'default is not a secret.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'There is no reset email — Handy accounts have no real inbox — so choose '
                    'something you will remember.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 22),
                  TextField(
                    controller: _current,
                    obscureText: _obscure,
                    autofocus: true,
                    decoration: const InputDecoration(labelText: 'Current password'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'New password',
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          size: 20,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _confirm,
                    obscureText: _obscure,
                    decoration: const InputDecoration(labelText: 'Confirm new password'),
                    onSubmitted: (_) => _save(),
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
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: _busy ? null : _save,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                          )
                        : const Text('Change password'),
                  ),
                ],
              ),
      ),
    );
  }
}

/// What the home screen calls you.
///
/// The portal supplies a full legal name in block capitals, which is nobody's
/// name for themselves. Saved on change rather than behind a button — a
/// settings field with a Save button people forget to press is worse than one
/// that just works.
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _controller,
          textCapitalization: TextCapitalization.words,
          maxLength: 20,
          decoration: const InputDecoration(
            labelText: 'Preferred name',
            hintText: 'Pardhu',
            counterText: '',
          ),
          onChanged: settings.setPreferredName,
        ),
        const SizedBox(height: 8),
        Text(
          'Used to greet you on the home screen. Leave it empty to use the name '
          'the college has on file.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}
