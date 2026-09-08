import 'package:flutter/material.dart';
import '../models/campus.dart';
import '../services/app_controller.dart';
import '../widgets/common.dart';

enum AuthMode { login, register, recover, verify, reset }

class AuthScreen extends StatefulWidget {
  final AppController controller;
  final AuthMode initialMode;
  const AuthScreen({
    super.key,
    required this.controller,
    this.initialMode = AuthMode.login,
  });
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _email = TextEditingController(),
      _password = TextEditingController(),
      _confirm = TextEditingController();
  late AuthMode _mode;
  bool _busy = false, _obscure = true, _obscureConfirm = true, _error = false;
  String? _notice;
  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _switch(AuthMode value) {
    setState(() {
      _mode = value;
      _notice = null;
      _password.clear();
      _confirm.clear();
    });
    _form.currentState?.reset();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    if (!widget.controller.configured) {
      setState(() {
        _notice =
            'El acceso todavía no está habilitado. Puedes explorar la demostración.';
        _error = true;
      });
      return;
    }
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      final c = widget.controller;
      switch (_mode) {
        case AuthMode.login:
          await c.signIn(_email.text, _password.text);
          break;
        case AuthMode.register:
          await c.register(_name.text, _email.text, _password.text);
          if (mounted) {
            setState(() {
              _mode = AuthMode.verify;
              _notice =
                  'Si el correo puede registrarse, recibirás un enlace de confirmación.';
              _error = false;
            });
          }
          break;
        case AuthMode.recover:
          await c.recover(_email.text);
          _notice =
              'Si corresponde a una cuenta válida, recibirás un enlace para recuperar tu acceso.';
          _error = false;
          break;
        case AuthMode.verify:
          await c.resend(_email.text);
          _notice =
              'Si corresponde, recibirás un correo de confirmación. Revisa también correo no deseado.';
          _error = false;
          break;
        case AuthMode.reset:
          await c.changePassword(_password.text);
          if (mounted) {
            message(context, 'Contraseña actualizada. Inicia sesión de nuevo.');
          }
          break;
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _notice = authError(error);
          _error = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _input(
    String label,
    TextEditingController controller, {
    bool password = false,
    bool confirm = false,
    TextInputType? keyboard,
    String? Function(String?)? validator,
    List<String>? autofill,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: TextFormField(
      controller: controller,
      enabled: !_busy,
      keyboardType: keyboard,
      autofillHints: autofill,
      validator: validator,
      obscureText: password && (confirm ? _obscureConfirm : _obscure),
      maxLength: password
          ? 128
          : label == 'Nombre completo'
          ? 100
          : null,
      decoration: InputDecoration(
        labelText: label,
        counterText: '',
        suffixIcon: password
            ? IconButton(
                tooltip: (confirm ? _obscureConfirm : _obscure)
                    ? 'Mostrar contraseña'
                    : 'Ocultar contraseña',
                onPressed: () => setState(() {
                  if (confirm) {
                    _obscureConfirm = !_obscureConfirm;
                  } else {
                    _obscure = !_obscure;
                  }
                }),
                icon: Icon(
                  (confirm ? _obscureConfirm : _obscure)
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              )
            : null,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final titles = {
      AuthMode.login: [
        'Bienvenido a Guía FIT',
        'Tu próximo salón, más cerca.',
        'Iniciar sesión',
      ],
      AuthMode.register: [
        'Crea tu cuenta',
        'Regístrate para comenzar a explorar.',
        'Crear cuenta',
      ],
      AuthMode.recover: [
        'Recupera tu acceso',
        'Te enviaremos un enlace para cambiar tu contraseña.',
        'Enviar enlace',
      ],
      AuthMode.verify: [
        'Revisa tu correo',
        'Confirma tu dirección con el enlace que recibiste.',
        'Reenviar verificación',
      ],
      AuthMode.reset: [
        'Nueva contraseña',
        'Usa una frase de al menos 12 caracteres.',
        'Guardar contraseña',
      ],
    }[_mode]!;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final form = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 470),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 36,
                offset: Offset(0, 16),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
          child: AutofillGroup(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF0E8),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.lock_outline, color: fitOrange),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    titles[0],
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(titles[1], style: const TextStyle(color: fitMuted)),
                  const SizedBox(height: 24),
                  if (_mode == AuthMode.login ||
                      _mode == AuthMode.register) ...[
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: _busy
                                ? null
                                : () => _switch(AuthMode.login),
                            child: Text(
                              'Iniciar sesión',
                              style: TextStyle(
                                fontWeight: _mode == AuthMode.login
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: TextButton(
                            onPressed: _busy
                                ? null
                                : () => _switch(AuthMode.register),
                            child: Text(
                              'Crear cuenta',
                              style: TextStyle(
                                fontWeight: _mode == AuthMode.register
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(),
                    const SizedBox(height: 20),
                  ],
                  if (!widget.controller.configured)
                    const InfoBanner(
                      'El registro todavía no está habilitado. Puedes explorar la demostración.',
                    ),
                  if (widget.controller.dataError != null)
                    InfoBanner(widget.controller.dataError!, error: true),
                  if (widget.controller.authNotice != null)
                    InfoBanner(widget.controller.authNotice!),
                  if (_notice != null)
                    Semantics(
                      liveRegion: true,
                      child: InfoBanner(_notice!, error: _error),
                    ),
                  if (_mode == AuthMode.register)
                    _input(
                      'Nombre completo',
                      _name,
                      validator: validateName,
                      autofill: [AutofillHints.name],
                    ),
                  if (_mode != AuthMode.reset)
                    _input(
                      'Correo electrónico',
                      _email,
                      keyboard: TextInputType.emailAddress,
                      validator: validateEmail,
                      autofill: [AutofillHints.email],
                    ),
                  if ([
                    AuthMode.login,
                    AuthMode.register,
                    AuthMode.reset,
                  ].contains(_mode))
                    _input(
                      'Contraseña',
                      _password,
                      password: true,
                      validator: _mode == AuthMode.login
                          ? (v) => v == null || v.isEmpty
                                ? 'Escribe tu contraseña.'
                                : null
                          : validatePassword,
                      autofill: [
                        _mode == AuthMode.login
                            ? AutofillHints.password
                            : AutofillHints.newPassword,
                      ],
                    ),
                  if (_mode == AuthMode.register || _mode == AuthMode.reset)
                    _input(
                      'Confirmar contraseña',
                      _confirm,
                      password: true,
                      confirm: true,
                      validator: (v) => v != _password.text
                          ? 'Las contraseñas no coinciden.'
                          : null,
                      autofill: [AutofillHints.newPassword],
                    ),
                  if (_mode == AuthMode.login)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _busy
                            ? null
                            : () => _switch(AuthMode.recover),
                        child: const Text('Olvidé mi contraseña'),
                      ),
                    ),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(titles[2]),
                  ),
                  if (_mode == AuthMode.login)
                    TextButton(
                      onPressed: _busy ? null : () => _switch(AuthMode.verify),
                      child: const Text('Reenviar correo de verificación'),
                    ),
                  if (![
                    AuthMode.login,
                    AuthMode.register,
                    AuthMode.reset,
                  ].contains(_mode))
                    TextButton(
                      onPressed: _busy ? null : () => _switch(AuthMode.login),
                      child: const Text('Volver al inicio de sesión'),
                    ),
                  const SizedBox(height: 18),
                  const Row(
                    children: [
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'Explora el proyecto',
                          style: TextStyle(fontSize: 12, color: fitMuted),
                        ),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : widget.controller.exploreDemo,
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Explorar demostración'),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'La verificación del correo y la validación institucional se realizan por separado.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: fitMuted,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    return Scaffold(
      backgroundColor: const Color(0xFF102735),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFE3E8EB))),
              ),
              child: Align(
                alignment: wide ? Alignment.centerLeft : Alignment.center,
                child: BrandHeader(compact: !wide),
              ),
            ),
            Expanded(
              child: Row(
                children: [
                  if (wide)
                    Expanded(
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF173F53), Color(0xFF102735)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        padding: const EdgeInsets.all(45),
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'FACULTAD DE INGENIERÍA TAMPICO',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  letterSpacing: 1.8,
                                ),
                              ),
                              const SizedBox(height: 28),
                              const Text(
                                'Tu campus.\nTu camino.',
                                style: TextStyle(
                                  fontSize: 58,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  height: 1.1,
                                  letterSpacing: -1.4,
                                ),
                              ),
                              const Text(
                                'A un paso.',
                                style: TextStyle(
                                  fontSize: 58,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFFFFB278),
                                  height: 1.1,
                                  letterSpacing: -1.4,
                                ),
                              ),
                              const SizedBox(height: 22),
                              const Text(
                                'Salones, salas y espacios de la facultad en una sola guía.',
                                style: TextStyle(
                                  color: Color(0xFFD5E2E9),
                                  fontSize: 17,
                                  height: 1.6,
                                ),
                              ),
                              const SizedBox(height: 28),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  color: Colors.white,
                                  height: 240,
                                  width: double.infinity,
                                  child: Image.asset(
                                    'assets/croquis.png',
                                    fit: BoxFit.contain,
                                    semanticLabel:
                                        'Croquis de referencia del campus',
                                  ),
                                ),
                              ),
                              const SizedBox(height: 28),
                              const Text(
                                'Universidad Autónoma de Tamaulipas · Tampico',
                                style: TextStyle(
                                  color: Color(0xFFC1D0D8),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  Expanded(child: SingleChildScrollView(child: form)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
