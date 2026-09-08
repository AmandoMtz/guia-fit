# Guía FIT · Facultad de Ingeniería Tampico

Web responsiva y aplicación Flutter/Dart para encontrar espacios del campus, con inicio de sesión, registro, confirmación de correo, recuperación de contraseña y revisión institucional de perfiles. Incluye los dos archivos gráficos originales proporcionados.

## Empezar

1. Descomprime el ZIP completo.
2. Abre **LEEME_PRIMERO.html** para ver la guía rápida o `web/dist/index.html` para explorar la demostración.
3. Instala Node.js 22.16 o posterior de la rama 22. Desde la raíz: `npm ci` y `npm start`.
4. Abre **http://localhost:3000**. Sin variables de conexión, puedes explorar la demostración.
5. Para activar cuentas reales, sigue **docs/RENDER_AIVEN_GIT.md**. No se incluyen credenciales ni cuentas de ejemplo que permitan iniciar sesión.

## Arquitectura

| Pieza | Implementación |
|---|---|
| Web | HTML, CSS y JavaScript, adaptable a celular y escritorio |
| API | Node.js / Express, alojada junto a la web en Render |
| Datos y fotos | PostgreSQL en Aiven, conexión TLS con CA verificada |
| App | Flutter y Dart para Android, iOS y web; consume la misma API |
| Correo | Resend por HTTPS; SMTP opcional |
| Código | Git, archivo de exclusiones, workflow de GitHub Actions y Blueprint de Render |

## Funciones incluidas

- Login con pestañas de registro, ver/ocultar contraseña, validación de campos, mensajes de carga y recuperación.
- Confirmación obligatoria de correo; contraseñas con hash scrypt; sesiones web en cookies HttpOnly; almacenamiento seguro del token en móvil.
- Perfil con matrícula opcional. Un administrador contrasta identidad con una fuente institucional; editar nombre o matrícula invalida esa revisión.
- Directorio con búsqueda y filtros, ficha por espacio, fotografía opcional, croquis ampliable con marcadores y navegación por tramos.
- Recorridos con **Anterior**, **Siguiente**, **Llegué** y reinicio. Filtrado por accesibilidad verificada. No incluye GPS interior ni detecta automáticamente la llegada.
- Panel de administración web para agregar/editar salones, fotografías, tramos y revisar perfiles. Flutter ofrece las funciones del estudiante.
- Fotos de entrada en JPG/PNG/WebP, máximo 5 MB, almacenadas en Aiven para conservarlas cuando Render reinicie.

## Información real y demostración

El croquis permite identificar nueve espacios, pero no informa todos los salones, pisos o caminos transitables. Se cargan como **pendientes de comprobar**, sin inventar numeraciones ni conexiones. El recorrido demostrativo usa nombres ficticios y nunca se publica como ruta real. Para habilitar recorridos reales, un administrador debe revisar y registrar puntos y tramos con fuente y fecha. Consulta **docs/DATOS_DEL_CAMPUS.md**.

Confirmar un correo solo acredita el acceso a ese buzón. No se presupone ningún dominio oficial ni integración con registros privados de UAT. La revisión institucional es manual y está restringida a administradores.

## Carpetas

- `web/dist/`: sitio listo para servir, assets originales y cliente de la API.
- `server/`: autenticación, API, acceso PostgreSQL, correos y migraciones.
- `backend/`: esquema SQL, catálogo inicial y datos de referencia.
- `flutter/`: fuentes `.dart`, plataformas nativas, configuración y pruebas.
- `tests/`: pruebas de seguridad de la API y rutas.
- `docs/`: despliegue, Flutter, carga de datos y resultados de verificación.
- `render.yaml`: despliegue del servicio Node en Render desde Git.

## Comprobar

```bash
npm ci
npm test
cd flutter
flutter pub get
flutter analyze
flutter test
```

Las pruebas usan PostgreSQL embebido PGlite y un buzón simulado. No crean servicios ni envían correos reales. Los resultados y límites están en `docs/VERIFICACION.md`.

Los servicios externos se configuran en tus propias cuentas. Este ZIP no publica automáticamente ni incluye un APK/IPA firmado. La app Flutter usa iconos de lanzador de plantilla; los logotipos originales de UAT/FIT están dentro de las pantallas. Antes de distribuirla, configura el identificador y firma propios.
