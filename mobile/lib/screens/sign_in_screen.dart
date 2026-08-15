import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/portal_auth.dart';
import '../data/repository.dart';
import '../logic/campus.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets/app_icon.dart';

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

  /// Set only when the roll number did not say which college it is and the
  /// student answered. Nobody with a recognisable roll number sees that ask.
  Campus? _chosenCampus;

  Campus? get _campus => _chosenCampus ?? detectCampus(_roll.text);

  /// AEC and ACET sign in against their own portal, so they type that password
  /// rather than a Handy one.
  bool get _portalMode => _campus?.usesPortalLogin ?? false;

  bool get _askForCampus =>
      _chosenCampus == null && detectCampus(_roll.text) == null && _roll.text.trim().length >= 8;

  @override
  void initState() {
    super.initState();
    // The campus is read off the roll number as it is typed, so the password
    // field appears without anyone choosing a campus from a list.
    _roll.addListener(() => setState(() {}));
  }

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

    // AEC/ACET: the college portal is the authority. Nothing here touches the
    // Handy account password, and a successful check creates the account.
    if (_portalMode) {
      try {
        await portalAuth.signIn(
          rollNumber: roll,
          password: _password.text,
          campus: _campus!,
        );
      } on PortalAuthException catch (error) {
        setState(() => _error = error.message);
      } catch (_) {
        setState(() => _error = 'Something went wrong. Check your connection and try again.');
      } finally {
        if (mounted) setState(() => _busy = false);
      }
      return;
    }

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

                  // Only when the roll number did not say which college it is.
                  // Not a picker — this is the fallback, not the default.
                  if (_askForCampus) ...[
                    const SizedBox(height: 14),
                    Text('Which college?', style: Theme.of(context).textTheme.labelSmall),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: Campus.values
                          .map((c) => OutlinedButton(
                                onPressed: () => setState(() => _chosenCampus = c),
                                child: Text(c.label),
                              ))
                          .toList(),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'We could not tell from that roll number, and guessing would send your '
                      'password to the wrong college.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],

                  if (_portalMode) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'College portal password',
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: AppIcon(
                            _obscure ? HugeIcons.strokeRoundedView : HugeIcons.strokeRoundedViewOff,
                            size: 20,
                          ),
                          tooltip: _obscure ? 'Show password' : 'Hide password',
                        ),
                      ),
                      onSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 8),
                    // Said plainly: this is the one screen in Handy that asks
                    // for a credential belonging to someone else's system.
                    Text(
                      'The same password you use on Campus Connect. It is sent to the college to '
                      'check it is you, and kept only on this phone so Handy can refresh your '
                      'attendance — never on our servers.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],

                  if (_showPasswordField && !_portalMode) ...[
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
                          icon: AppIcon(
                            _obscure ? HugeIcons.strokeRoundedView : HugeIcons.strokeRoundedViewOff,
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
                  // Meaningless on the portal path: there is no Handy password
                  // to have set, because the college's is what signs you in.
                  if (!_showPasswordField && !_portalMode)
                    TextButton(
                      onPressed: () => setState(() => _showPasswordField = true),
                      child: Text(
                        'I set my own password',
                        style: TextStyle(color: muted, fontSize: 13),
                      ),
                    ),

                  const SizedBox(height: 24),
                  Text(
                    _portalMode
                        // The extension is a laptop step these students do not
                        // need, so telling them to go and do it would be wrong.
                        ? 'Signing in checks your roll number and password against the college portal. If they are right, your Handy account is created there and then.'
                        : 'No account yet? Install Handy College Sync on your laptop and open your Campus Connect profile — the account creates itself.',
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
