# Guía FIT · Aplicación móvil y notificaciones

## Qué incluye esta actualización

- Aplicación web instalable (PWA): se abre desde un ícono y aprovecha el sistema de notificaciones del celular. Esta entrega no genera un APK ni una aplicación nueva de App Store; la carpeta Flutter se conserva.
- Mi cuenta: nombre real y @usuario separados. Los usuarios existentes conservan su nombre y reciben un identificador aleatorio editable. No se usa su matrícula, correo ni ID privado para generar el usuario. El usuario admite 3–40 letras, números o guiones bajos y es único, sin distinguir mayúsculas.
- Perfil y listas de personas: nombre real y @usuario, incluyendo conversaciones académicas, compras, rankings, cuentas y asistencias. Los nombres de los negocios se conservan. Los documentos de asistencia mantienen el nombre real.
- Ficha: la extracción PDF/OCR existente obtiene el nombre; revisarlo y guardar sincroniza el nombre real del perfil. También puedes escribirlo en Mi cuenta. Cambiar solamente una clase no revierte una corrección manual del nombre. Una importación de un nombre diferente sí lo actualiza. El @usuario no se modifica.
- Recordatorios de clases para cuentas de alumno con horario sincronizado: aviso al comenzar, con materia, hora y salón, y acceso a Mi horario. Se revisan cada 15 segundos mientras el servicio está activo. Zona del campus: America/Mexico_City. Se admite recuperar un inicio durante sus primeros 5 minutos, siempre que la clase no haya terminado. No se recuperan avisos de horas anteriores.
- Un aviso por clase/fecha en la base, incluso al reiniciar o al ejecutar dos procesos. No se interpreta el recordatorio como asistencia, ni como evidencia de presencia del alumno.
- Mensajes académicos y de comidas: se conserva la entrega push a la cuenta destinataria, también con la página cerrada. Al tocar el aviso se abre la conversación; si otra cuenta tiene la sesión abierta, se solicita entrar a la destinataria.
- Administración → Pruebas de notificaciones: envío general, dispositivos registrados, cuentas, pendientes y resultados de las últimas 24 horas. También está disponible dentro de Mi cuenta del administrador. Máximo dos pruebas generales por administrador cada 15 minutos.
- Retirada del seguimiento AR/WebXR. Permanecen mapa 2D/3D, recorridos, plantas, conexiones, joystick, giro del celular, cámara normal opcional, GPS y lectores QR.

## Actualizar el proyecto

1. Extrae el ZIP completo en una carpeta nueva. No mezcles sus archivos con una entrega anterior.
2. En PowerShell, dentro de `guia-fit-main`, ejecuta tu comando habitual:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1
   ```

   El actualizador ahora incluye todos los archivos de esta entrega. Clona el estado actual de GitHub y aplica solo los cambios incluidos. Si encuentra cambios posteriores en un archivo, intenta una integración de tres versiones. Si no puede integrarlos sin conflicto, no hace commit ni push y muestra dónde revisar. Nunca usa force push. La opción `-SoloPreparar` permite revisar los cambios sin publicarlos.
3. Render debe reconstruir con `npm ci --omit=dev` e iniciar con `npm start`. La migración nueva es `021_mobile_identity.sql`; no se modificaron las anteriores. Con `AUTO_MIGRATE=true` se aplica al iniciar; si administras las migraciones manualmente, ejecuta `npm run db:migrate` antes de servir la nueva versión.
4. Cierra y vuelve a abrir la app para cargar la nueva caché. No borres la base ni las claves push; las suscripciones y claves actuales se reutilizan.
5. En Mi cuenta, cambia el identificador automático por tu usuario, por ejemplo `Windsumi`, y comprueba tu nombre real.

## Activar en los celulares

### Android

Abre la dirección HTTPS de Guía FIT en un navegador compatible. En Mi cuenta, pulsa Instalar aplicación si está disponible, o usa el menú del navegador → Instalar aplicación / Agregar a pantalla de inicio. Abre el ícono, inicia sesión, ve a Mi cuenta y pulsa Permitir notificaciones. Envía primero la prueba de ese dispositivo.

### iPhone y iPad

Se requiere iOS/iPadOS 16.4 o posterior para Web Push. En Safari, Compartir → Agregar a pantalla de inicio. Abre Guía FIT desde su ícono, inicia sesión y activa notificaciones en Mi cuenta. No basta con abrirla en una pestaña de Safari.

Cada dispositivo debe conceder permiso y conservar su sesión vigente. Al cerrar sesión deja de recibir avisos de esa cuenta. No molestar, permisos, ahorro de batería y preferencias del sistema pueden silenciar o retrasar la notificación. La aplicación no puede imponer el sonido de WhatsApp ni garantizar entrega exactamente al segundo. El cuerpo de las notificaciones de clase puede aparecer en la pantalla bloqueada según los ajustes del teléfono.

## El proceso de recordatorios debe estar activo

El `render.yaml` recibido usa `plan: free`. Render puede suspender ese servicio tras 15 minutos sin tráfico entrante; durante la suspensión no corren temporizadores ni recordatorios. Mantuvimos el plan tal como estaba: esta actualización no contrata ni despliega servicios de pago.

Para avisos aunque nadie esté usando la web, usa una de estas opciones:

1. Ejecutar la web en un servicio que permanezca activo. `npm start` ya procesa clases y push.
2. Ejecutar el proceso independiente incluido en un servidor que permanezca encendido:

   ```bash
   npm ci --omit=dev
   npm run notifications:worker
   ```

   Configura la misma `DATABASE_URL`, el mismo certificado TLS de la base si corresponde y `SITE_URL=https://tu-direccion-publica` (la dirección real de la web). `AUTO_MIGRATE=true` aplica las migraciones. No usa un puerto HTTP; puede ejecutarse como un worker administrado. En Render, crear un Background Worker implica elegir y contratar su servicio por separado: no está activado en este ZIP.

Ambos procesos pueden coexistir: las claves de recordatorios y los bloqueos de cola evitan que reclamen el mismo trabajo simultáneamente. Como cualquier push con reintentos, un fallo después de la aceptación del proveedor puede producir una reentrega; los avisos usan etiquetas para agruparlos. Una caída del servidor o de Internet puede impedir un aviso puntual.

## Prueba real después del despliegue

1. Abre dos dispositivos, concede permiso y deja su sesión iniciada.
2. Desde una cuenta administradora, abre Pruebas de notificaciones. Revisa que aparezcan dispositivos.
3. Envía la prueba general y comprueba visualmente cada teléfono. Actualiza el estado: “aceptado por proveedor” no confirma que se haya mostrado en pantalla. Los conteos de resultados son por cuenta, no por dispositivo, e incluyen todos los avisos de 24 horas.
4. Envía un mensaje desde otra cuenta; comprueba el aviso con la app destinataria cerrada y el destino al tocarlo.
5. En una cuenta de alumno, guarda una clase para unos minutos después en hora del campus. Con el servicio activo y los recordatorios habilitados, comprueba el aviso y que abra Mi horario.
6. Comprueba que No molestar y desactivar recordatorios funcionen. En vacaciones desactiva los recordatorios: la ficha es semanal y no incluye el calendario oficial de días inhábiles.

## Validación de esta entrega

Pruebas automáticas de API, migraciones, permisos, identidad, duplicados por clase, preferencias, envío a dos dispositivos con transporte simulado, mensajes, caché, mapas y controles. No se enviaron pruebas a usuarios reales ni se desplegó en GitHub/Render desde esta sesión. No se pudo ejecutar la prueba visual con Chromium: el entorno no disponía del navegador y falló su descarga. Las pruebas de comportamiento del mapa y del DOM sí se ejecutaron.

Fuentes operativas consultadas el 13 de octubre de 2026:
- Apple/WebKit: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Render: https://render.com/docs/free
- Render: https://render.com/docs/background-workers

## Ajuste de acceso: login del tamaño del mapa

En escritorio, el formulario y el mapa ocupan columnas del mismo ancho y comparten una fila: sus bordes superior e inferior quedan alineados. El cuadro crece si cambia el contenido del mapa, sin alturas fijas ni recortes. Se ampliaron campos, botones y título. En pantallas de 760 px o menos se conserva el formulario adaptable de una columna. El actualizador muestra el resumen sin visor interactivo: ya no requiere pulsar Q.
