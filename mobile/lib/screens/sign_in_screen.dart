import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/repository.dart';
import '../main.dart';
import '../theme.dart';

/// Roll number only.
///
/// Accounts are created by the desktop extension with a known default
/// password, so asking every student for one would be friction with no
/// purpose. The password field is opt-in — behind a link — rather than
/// appearing on the first failure, because the commonest cause of a failure is
/// a typo'd roll number or an account that was never synced, not a changed
/// password.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _roll = TextEditingController();
  final _password = TextEditingController();
  final _scroll = ScrollController();
  bool _showPasswordField = false;
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _roll.dispose();
    _password.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final roll = _roll.text.trim().toUpperCase();
    if (roll.isEmpty) {
      setState(() => _error = 'Enter your roll number.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });

    final password = _password.text.isEmpty ? Repository.defaultPassword : _password.text;

    try {
      await repository.signIn(roll, password);
    } catch (e) {
      final text = e.toString();
      final badCredential = text.contains('invalid-credential') ||
          text.contains('wrong-password') ||
          text.contains('user-not-found');
      setState(() {
        // Firebase collapses "no such account" and "wrong password" into one
        // code, so this can't claim to know which — it names both.
        _error = badCredential
            ? 'Could not sign in. Check the roll number — and if you have never synced from your laptop, there is no account yet.'
            : 'Something went wrong. Check your connection and try again.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;

    return Scaffold(
      // The form scrolls above the keyboard rather than being pushed under it.
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            controller: _scroll,
            padding: EdgeInsets.fromLTRB(
              24,
              24,
              24,
              // Keyboard height, so the button is always reachable.
              24 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight - 48),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Brand(),
                  const SizedBox(height: 40),

                  TextField(
                    controller: _roll,
                    autofocus: true,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    inputFormatters: [
                      // Roll numbers are alphanumeric; blocking the rest stops
                      // a whole class of "why won't it sign in" typos.
                      FilteringTextInputFormatter.allow(RegExp('[a-zA-Z0-9]')),
                      TextInputFormatter.withFunction(
                        (_, next) => next.copyWith(text: next.text.toUpperCase()),
                      ),
                    ],
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Roll number',
                      hintText: '26B21CS058',
                    ),
                    onSubmitted: (_) => _submit(),
                  ),

                  if (_showPasswordField) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      autofocus: true,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            size: 20,
                          ),
                          tooltip: _obscure ? 'Show password' : 'Hide password',
                        ),
                      ),
                      onSubmitted: (_) => _submit(),
                    ),
                  ],

                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: HandyColors.bad.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: HandyColors.bad,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Sign in'),
                  ),

                  const SizedBox(height: 8),
                  if (!_showPasswordField)
                    TextButton(
                      onPressed: () => setState(() => _showPasswordField = true),
                      child: Text(
                        'I set my own password',
                        style: TextStyle(color: muted, fontSize: 13),
                      ),
                    ),

                  const SizedBox(height: 24),
                  Text(
                    'No account yet? Install Handy College Sync on your laptop and open your Campus Connect profile — the account creates itself.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, height: 1.5, color: muted),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [HandyColors.orange, HandyColors.orangeDeep],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: HandyColors.orange.withValues(alpha: 0.32),
                blurRadius: 22,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: const Text(
            'H',
            style: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: Colors.white),
          ),
        ),
        const SizedBox(height: 20),
        Text('Handy', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        Text(
          'Your attendance, straight from\nthe college portal',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}
