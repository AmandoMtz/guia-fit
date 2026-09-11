# Modo sin conexión para alumnos

La versión web conserva una copia local limitada para que un alumno que ya inició sesión pueda seguir consultando información básica cuando pierde la red.

## Disponible sin internet

- **Mi horario**, únicamente si ya fue guardado en ese navegador y dispositivo.
- **Eventos guardados**, usando la última lista que la cuenta sincronizó mientras había conexión.
- Navegación entre semanas del horario.

## Requiere conexión

- Iniciar sesión por primera vez o renovar una sesión vencida.
- Registrar asistencia por QR.
- Actualizar eventos, generar PDFs o validar documentos.
- Comidas, pedidos, chat y notificaciones.
- Directorio dinámico, rutas, administración y cambios de perfil.
- Editar/importar el horario mientras se está en modo offline.

## Seguridad

El modo offline no guarda contraseña, cookie de sesión, token de autenticación ni QR. Solo conserva un identificador de cuenta de alumno, datos mínimos de perfil y la lista de eventos necesaria para consulta. La sesión offline vence siete días después de la última sincronización exitosa.

El horario permanece en IndexedDB y sigue aislado por el identificador de la cuenta. Los eventos se guardan por usuario y cualquier estado de QR se fuerza a inactivo cuando se consulta sin conexión.

Al recuperar internet, la app intenta validar de nuevo la sesión real y sincroniza la información actualizada.
