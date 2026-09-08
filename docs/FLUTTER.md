# Ejecutar Guía FIT en Flutter

Proyecto de referencia: Flutter 3.35.3 / Dart 3.9.2. Incluye código `.dart` y plataformas Android, iOS y web. Consume la API Node de Render; PostgreSQL se conecta únicamente desde el servidor.

## Inicio rápido

1. Instala Flutter y las herramientas de tu plataforma. Ejecuta `flutter doctor`.
2. Abre la carpeta `flutter/` en VS Code o Android Studio.
3. Copia `config.example.json` como `config.local.json` y cambia la URL:

```json
{"API_BASE_URL":"https://TU-SERVICIO.onrender.com"}
```

4. Ejecuta desde `flutter/`:

```bash
flutter pub get
flutter run --dart-define-from-file=config.local.json
```

Sin configuración, puedes explorar la demostración usando `flutter run`. Para un dispositivo físico, utiliza la URL HTTPS de Render; `localhost` en el teléfono apunta al propio teléfono.

## Qué comparte con la web

Login, registro con correo confirmado, reenvío, recuperación, perfil, matrícula opcional, búsqueda de espacios, croquis, fotografías y recorridos paso a paso. Los cambios que haga el administrador en la web se consultan desde la app. La administración se realiza en la web.

Las sesiones móviles se guardan mediante `flutter_secure_storage`; el token no está en el código ni en un archivo de configuración. Android utiliza almacenamiento cifrado; iOS utiliza Keychain. El servidor guarda únicamente el hash del token y lo invalida al cerrar sesión o restablecer la contraseña. Las sesiones duran siete días y requieren volver a iniciar sesión cuando vencen.

## Confirmación y recuperación

Los correos abren la web en Render. Confirmar allí activa la misma cuenta para Flutter. En recuperación puedes cambiar la contraseña en la web, o pulsar **Abrir en la aplicación Flutter** si ya está instalada. El esquema `guiafit://auth-callback/` está registrado en Android e iOS y es gestionado por `app_links`.

La llegada a un salón se confirma manualmente con los controles del recorrido. No incluye posicionamiento interior automático ni requiere permiso de ubicación.

## Comprobar y compilar

```bash
flutter analyze
flutter test
flutter build apk --release --dart-define-from-file=config.local.json
```

Para distribuir Android, configura antes un identificador propio y firma de publicación: la plantilla usa la firma de depuración en la compilación release mientras no la sustituyas. El mínimo Android del proyecto es API 23. Configura el lanzador definitivo antes de publicar.

En macOS con Xcode, tu equipo de firma y certificados configurados:

```bash
flutter build ipa --release --dart-define-from-file=config.local.json
```

El ZIP contiene fuentes y proyectos nativos, no un APK/IPA firmado. Las compilaciones nativas requieren los SDK de plataforma.

## Flutter Web opcional

La web principal diseñada para Render está en `web/dist/`. Puedes compilar además la versión Flutter Web:

```bash
flutter build web --release --dart-define-from-file=config.local.json
```

Para publicarla compartiendo cookies con la API, sirve esa compilación desde el **mismo origen** que Render, reemplazando el contenido web servido. Conserva una copia de la web principal si necesitas su panel de administración. Flutter Web utiliza cookies HttpOnly con SameSite=Lax; un dominio distinto puede impedir sesiones por las políticas del navegador. Para desarrollar web en otro puerto de localhost, agrega ese origen exacto a `CORS_ORIGINS` y usa ambos servidores en localhost. Las apps nativas no tienen esta limitación.

## Plataformas

Los proyectos Android/iOS ya incluyen permiso de internet, enlaces y nombre visible. `scripts/configure_mobile.py` permite reaplicar los ajustes de enlaces si regeneras las plataformas. Cambia el esquema en el script, proyectos nativos y enlace web si eliges otro. Android desactiva el respaldo automático de datos para evitar restaurar tokens cifrados sin su clave original.

Los logotipos y croquis son los archivos originales. Los iconos de lanzador de las plataformas conservan la plantilla Flutter; reemplázalos al preparar una publicación definitiva. La versión de referencia y paquetes resueltos están fijados en `pubspec.lock`.

Consulta `VERIFICACION.md` para las comprobaciones ejecutadas. El correo real, conexión a tus servicios y enlaces desde dispositivos físicos requieren tu configuración de Render/Aiven y el proveedor de correo.
