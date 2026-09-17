# Asistencia, notificaciones y bitácora

## Aplicar esta actualización

1. Respalda PostgreSQL antes de actualizar el servidor.
2. Sustituye los archivos del proyecto por los de este ZIP. Conserva tus variables de entorno y certificados; el ZIP no incluye credenciales.
3. Ejecuta `npm ci` con Node.js 22 o 24.
4. Ejecuta `npm run db:migrate`, o conserva `AUTO_MIGRATE=true` para aplicar las migraciones al iniciar. Se agregan las migraciones 011 y 012; no se modifican las anteriores.
5. Reinicia el servidor con `npm start`. Usa tu dominio HTTPS en `SITE_URL`.
6. Recarga la página para recibir la versión nueva del service worker. Si una ventana antigua conserva la versión anterior, ciérrala y vuelve a abrirla.

Esta entrega actualiza la página/PWA y su API. No publica automáticamente en Render ni sustituye una instalación existente. No incluye un APK nuevo ni integración nativa Flutter con FCM/APNs: el cliente Flutter del ZIP conserva sus funciones anteriores. Las notificaciones descritas aquí son Web Push de la página instalada o del navegador compatible.

## Configurar los eventos

En el formulario de crear/editar evento se solicitan:

- Latitud y longitud del centro del recinto. El botón **Usar mi ubicación como centro** debe utilizarse estando físicamente en el recinto; también puedes escribir las coordenadas verificadas.
- Radio permitido, entre 10 y 1000 metros.
- Precisión máxima admitida, entre 1 y 200 metros, nunca mayor que el radio.
- Inicio y fin del evento: también definen el horario de registro.

El QR sigue siendo el mismo para todos. Solo abre el proceso de registro. El servidor exige ubicación reciente, firma del navegador autorizado, cuenta elegible, QR vigente y horario activo.

Los eventos anteriores no reciben coordenadas inventadas: quedan bloqueados para asistencia hasta editarlos y configurar el área. Editar el evento invalida su QR anterior; genera otro y vuelve a compartirlo.

La ubicación debe tener antigüedad máxima de 30 segundos. La precisión reportada debe caber completamente dentro del radio: se exige `distancia al centro + precisión <= radio`. Por ejemplo, a 90 m del centro con precisión de 20 m se rechaza un radio de 100 m. El margen no amplía el área.

Si no se permite ubicación, no se obtiene una lectura válida o no alcanza la precisión requerida, no se registra la asistencia. No hay un botón para omitir este control, ni siquiera para el administrador. Prueba los parámetros en el recinto con varios teléfonos antes del primer evento; interiores y techos pueden reducir mucho la precisión.

## Autorizar el navegador de cada alumno

1. El alumno abre **Mi cuenta → Dispositivo para asistencia** desde el navegador que utilizará. En iPhone, conviene hacerlo desde la página ya instalada en la pantalla de inicio.
2. Pulsa **Solicitar autorización de este dispositivo**.
3. Presenta su credencial y el código de solicitud a administración.
4. Administración abre **Mi cuenta → Autorizar dispositivos**, compara presencialmente la identidad y el código, y pulsa **Autorizar**, registrando el motivo.
5. El alumno puede escanear el QR y registrar asistencia desde ese navegador si está dentro del área y horario.

Se admite un navegador autorizado por cuenta. La misma clave no puede pertenecer a dos cuentas. Autorizar un reemplazo revoca el anterior. Una revocación bloquea también desafíos de asistencia emitidos previamente. La clave privada se guarda en IndexedDB como CryptoKey no exportable mediante Web Crypto; el servidor solo conserva la pública. Cada registro firma un desafío de un solo uso asociado a cuenta, QR y lectura de ubicación. Las pruebas caducan a los 90 segundos y se consumen dentro de la transacción de asistencia.

**Límites reales:** esta clave identifica una instalación del navegador, no el IMEI, número de serie ni el hardware físico. Otro navegador, modo privado o borrado de datos produce una instalación diferente que necesita aprobación. La aprobación presencial evita que la contraseña prestada baste para autorizar otro navegador. Aun así, una web no certifica que las coordenadas reportadas sean auténticas: ubicación simulada, dispositivo comprometido, préstamo del propio teléfono o colaboración mediante retransmisión siguen siendo riesgos. No se promete una prevención absoluta. Una aplicación nativa puede añadir comprobaciones de integridad y claves protegidas por hardware, pero tampoco prueba por sí sola la presencia de la persona.

## Botón de notificaciones

Disponible al principio de **Mi cuenta** y en **la campana → Mis avisos**:

- **Permitir notificaciones**: solicita permiso explícitamente y registra la suscripción de este navegador para la cuenta actual.
- **Enviar prueba**: aparece al activar los avisos y permite comprobar la entrega real.
- **Desactivar notificaciones**: elimina la suscripción del dispositivo para esta cuenta.
- Si el navegador bloqueó el permiso, aparece **Cómo habilitar los avisos**.
- Si el entorno no soporta Push, aparece **Cómo activar notificaciones**, con instrucciones. El botón no simula que la función esté disponible.

Se amplían los mensajes de Comidas ya existentes con avisos de pedidos y revisión de vendedores; nuevos eventos, cambios y cancelaciones para sus destinatarios; asistencia confirmada; autorización/revocación de dispositivo; verificación institucional; monedas y recompensas. Los eventos cerrados se notifican según carrera o invitación. No se envía un aviso de cada lectura de la API ni de las acciones privadas de otros alumnos. El historial **Mis avisos** en el panel conserva hasta los últimos 100 avisos generales para consulta; los mensajes de chat conservan su funcionamiento temporal anterior.

Los avisos pueden llegar aunque la página no esté abierta. Requieren permiso, conexión y una sesión vigente. Las sesiones existentes vencen a los siete días; al vencer, cerrar sesión o restablecer la contraseña, dejan de enviarse a esa sesión. Al volver a entrar se restablece la suscripción si el permiso sigue concedido y el usuario no la desactivó.

En **iPhone/iPad con iOS/iPadOS 16.4 o posterior**: abre la página en Safari, pulsa **Compartir → Agregar a pantalla de inicio**, ábrela desde su ícono, inicia sesión y pulsa **Permitir notificaciones**. El modo de concentración, permisos y configuración del sistema pueden silenciar o demorar avisos. No se puede forzar sonido o entrega idéntica a WhatsApp.

El servidor usa las claves VAPID persistentes ya existentes; no hay que copiarlas al cliente. Debe permanecer ejecutándose para procesar la cola cada 15 segundos: un servicio que se suspende, como un alojamiento gratuito inactivo, no puede entregar nuevos avisos mientras está dormido. Los errores transitorios se reintentan hasta cinco intentos. Las suscripciones inválidas (404/410) se eliminan. Los avisos generales vencen en un día; los chats conservan su vencimiento previo.

Fuentes oficiales: [Web Push en iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) y [Geolocation API](https://w3c.github.io/geolocation/).

## Bitácora

Administración accede desde **Mi cuenta → Bitácora de operaciones**. Permite filtrar por proceso, consultar bloques de 100 registros, cargar registros anteriores y descargar los registros cargados como JSON.

La bitácora registra los cambios en las tablas de negocio, cuentas, sesiones, perfiles, verificaciones, lugares, rutas, metadatos de imágenes, pedidos, productos, vendedores, eventos, asistencias, documentos generados, recompensas, dispositivos, suscripciones y metadatos del chatbot. Guarda identificador, fecha del servidor, proceso, acción, registro afectado, valores anteriores/nuevos y actor e identificador de solicitud cuando proceden de la API. Las acciones del sistema o externas a la API pueden tener actor nulo.

- Los cambios de datos y su auditoría se confirman juntos. Si una transacción se revierte, sus cambios tampoco aparecen como confirmados en la bitácora.
- Las solicitudes de escritura a la API registran recepción y, al finalizar normalmente la respuesta, resultado HTTP y código de error. Los intentos rechazados también dejan rastro. Una interrupción abrupta puede dejar una solicitud sin registro de respuesta; no significa éxito ni fracaso confirmado. La conexión entre solicitud y cambios se hace mediante `request_id`, también devuelto en `X-Request-Id`.
- La cola deja constancia de aceptación por el proveedor, ausencia de suscripción, rechazo o agotamiento/vencimiento. **Aceptación por el proveedor no acredita que el usuario haya recibido o leído el aviso**. Reintentos pueden generar más de una entrega; la etiqueta permite agruparlas en el dispositivo.
- No se guardan contraseñas, tokens, claves privadas, firmas, bytes de imágenes ni el texto de chats en esta bitácora. Para asistencia se guarda distancia, precisión y dispositivo, no las coordenadas crudas del alumno. Las coordenadas configuradas del evento sí forman parte de sus datos administrativos.
- Los registros comienzan al instalar estas migraciones. No se reconstruye el pasado ni se centralizan cambios locales/offline de horarios guardados exclusivamente en el navegador. Las nuevas tablas de negocio futuras requerirán incorporar su trigger de auditoría.
- La aplicación no ofrece edición/borrado de auditoría; un trigger rechaza UPDATE, DELETE y TRUNCATE. El propietario de PostgreSQL puede alterar triggers/esquema: para evidencia resistente a manipulación administrativa se necesita además un rol de ejecución restringido y copias externas con retención. Esta bitácora es trazabilidad operativa, no una firma digital de un tercero.

Planifica respaldo y retención: la bitácora no se purga automáticamente, por lo que aumenta con el uso. Los filtros y exportación están restringidos a administradores porque contienen datos administrativos.

## Comprobaciones incluidas y prueba en el recinto

Ejecuta `npm test`. Incluye el flujo de firma del navegador con clave no exportable, autorizaciones, ubicación, horario, rechazo de firma alterada y reutilización concurrente, permisos administrativos, rollback de auditoría, privacidad por destinatario, cola push y botones con permiso concedido, bloqueado, entorno no compatible y error temporal.

Antes de utilizarlo con alumnos, prueba en el dominio HTTPS real con dos cuentas y dos teléfonos: autorización de cada uno, registro dentro/fuera, cierre del evento, reemplazo de dispositivo, botón Enviar prueba y recepción con la PWA cerrada. Las pruebas automatizadas no sustituyen verificar GPS y entrega del proveedor en equipos físicos. No se ha verificado una entrega real a Apple/Google desde este entorno de desarrollo.
