# Comprobaciones de esta entrega

Fecha: 8 de septiembre de 2026.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm test` | 18 pruebas contabilizadas por Node; todas aprobadas |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas en dependencias de producción en esta revisión |
| `flutter analyze --no-pub` | Sin incidencias |
| `flutter test --no-pub` | 6 pruebas aprobadas |
| `flutter build web --release --no-pub` | Compilación JavaScript generada correctamente |
| Blueprint de Render | Validado con el esquema JSON oficial de Render |
| JavaScript de la web | Sintaxis comprobada con Node |
| Logotipos y croquis | SHA-256 idéntico a los dos archivos originales, en ambos clientes |

La API se comprobó con Express real, solicitudes HTTP de Supertest y PostgreSQL embebido PGlite. El transporte de correo fue simulado: las pruebas no enviaron mensajes. Se verificaron correo obligatorio y token de un uso, hashing de contraseñas y sesiones, cookie HttpOnly/Secure, protección del origen, separación de perfiles, permisos de administrador, invalidación de revisión institucional al editar identidad, recuperación que revoca sesiones y almacenamiento/lectura de fotografías en PostgreSQL.

Las pruebas de rutas rechazan puntos y tramos sin verificar, respetan sentido y accesibilidad y mantienen el recorrido ficticio dentro de la demostración. Las pruebas de widgets Flutter revisan acceso y directorio en 360 × 800 y 1280 × 900, además de rechazar formularios vacíos.

Entorno de comprobación: Node 24.19 y Flutter 3.35.3 / Dart 3.9.2. El servicio admite Node desde 22.16 y el Blueprint selecciona la rama 22. Los archivos lock fijan las dependencias de la aplicación.

## Alcance pendiente de tus servicios

No se desplegó en una cuenta de Render, no se creó una base externa de Aiven ni se envió correo real: faltan tus variables y servicios. La conexión TLS real con Aiven, la entrega de correo y los enlaces móviles desde un dispositivo físico deben comprobarse después de configurar tus cuentas, siguiendo `RENDER_AIVEN_GIT.md`.

No se realizó inspección visual de la web en navegador ni compilación Android/iOS firmada. Flutter Web se compiló para JavaScript; el análisis previo de WebAssembly advierte incompatibilidades del paquete de almacenamiento y esta entrega no usa Wasm. El compilador también informó sobre una fuente Cupertino no incluida; las pantallas del proyecto utilizan iconos Material.

La compilación de comprobación y las dependencias descargadas no se incluyen en el ZIP; se regeneran con los comandos documentados. Se incluyen fuentes Dart, plataformas nativas y archivos de configuración. No se certifica que el croquis refleje todos los salones, rutas, pisos o condiciones actuales del campus: la información inicial conserva el estado pendiente y requiere revisión institucional.
