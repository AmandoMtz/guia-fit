# Modo sin conexión para alumnos

La versión web conserva una copia local limitada para que un alumno que ya autenticó su cuenta en ese dispositivo pueda abrir Guía FIT aun cuando no tenga internet.

## Flujo esperado

1. El alumno inicia sesión normalmente mientras tiene internet.
2. Guía FIT guarda una sesión local limitada, la última lista de eventos visible para esa cuenta y una copia estructurada del horario guardado.
3. El Service Worker guarda la interfaz web necesaria para volver a abrir la aplicación sin red.
4. Si después se abre Guía FIT sin internet, la pantalla de acceso muestra **Entrar sin conexión** para la cuenta guardada.
5. En ese modo solo aparecen **Mi horario** y **Eventos guardados**.
6. Cuando vuelve internet, la aplicación valida de nuevo la sesión real y vuelve a sincronizar los datos.

El acceso sin conexión no es un inicio de sesión contra el servidor. Solo abre la copia local que fue creada después de una autenticación válida previa en ese mismo navegador y dispositivo.

## Disponible sin internet

- **Mi horario**, si ya fue cargado y guardado previamente.
- **Eventos guardados**, usando la última lista sincronizada antes de perder la red.
- Navegación entre semanas del horario.

El horario se conserva principalmente en IndexedDB y además se mantiene una copia de respaldo local para poder consultarlo si IndexedDB falla temporalmente al iniciar sin red.

## Requiere conexión

- Registrar o autenticar una cuenta nueva por primera vez.
- Registrar asistencia por QR.
- Actualizar eventos, generar PDFs o validar documentos.
- Comidas, pedidos, chat y notificaciones.
- Directorio dinámico, rutas, administración y cambios de perfil.
- Editar/importar el horario mientras se está en modo offline.

## Seguridad

El modo offline no guarda contraseña, cookie de sesión, token de autenticación ni QR. Solo conserva un identificador de cuenta de alumno, datos mínimos de perfil, el horario estructurado y la lista de eventos necesaria para consulta. La sesión offline vence siete días después de la última sincronización exitosa.

Los datos se aíslan por el identificador de la cuenta. Los eventos guardados fuerzan cualquier estado de QR a inactivo cuando se consultan sin conexión.

Cerrar sesión elimina el acceso offline de esa cuenta. Borrar los datos del sitio o del navegador también elimina la copia local.

## Importante después de desplegar una actualización

Después de publicar una versión nueva, abre Guía FIT al menos una vez con internet para que el navegador instale/actualice el Service Worker y sincronice la copia local. Después ya se puede comprobar el comportamiento desconectando la red y volviendo a abrir la aplicación.
