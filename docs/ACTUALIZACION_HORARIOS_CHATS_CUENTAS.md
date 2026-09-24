# Horarios, conversaciones y cuentas

## Instalar

Extrae el ZIP completo y abre PowerShell en `guia-fit-main`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ACTUALIZAR_MEJORAS_GITHUB.ps1
```

El script clona `https://github.com/AmandoMtz/guia-fit.git`, rama `main`, comprueba los archivos y sube únicamente esta actualización. Usa `core.autocrlf=false` y compara textos normalizando saltos de línea para evitar el falso conflicto de Windows. Conserva los archivos ajenos a esta actualización y se detiene ante diferencias reales. No usa push forzado.

El servidor aplica `015_persistent_schedules_food.sql` al iniciar con AUTO_MIGRATE habilitado (valor predeterminado). Si tienes `AUTO_MIGRATE=false`, ejecuta `npm run db:migrate` antes de iniciar la versión nueva. La migración es aditiva; las anteriores conservan sus sumas de verificación.

## Horarios y acceso sin internet

El horario se respalda en la cuenta y conserva una copia por usuario en IndexedDB y una copia local auxiliar. Abre **Mi horario** con conexión después de actualizar: un horario previo de ese navegador se respalda automáticamente si la cuenta aún no tiene respaldo. Los cambios se guardan en la cuenta y en el dispositivo; las revisiones evitan sobrescribir cambios de otro dispositivo sin aviso. La eliminación se sincroniza y no resucita copias antiguas.

Sin internet, la pantalla de inicio ofrece **Entrar sin conexión** para el alumno previamente guardado en ese navegador. Solo permite consultar el horario y los eventos descargados: no verifica una contraseña en línea ni permite escribir, chatear o usar administración. Cerrar sesión ya no elimina esta copia de consulta. Se conserva una cuenta de alumno de acceso local a la vez; los horarios permanecen separados por identificador de usuario.

Se necesita una primera visita con conexión y abrir el horario en el dispositivo. Usa el mismo dominio, navegador y perfil. Si borras los datos del navegador, cambias de dispositivo o usas navegación privada, necesitarás conectarte nuevamente para descargarlo. Un deploy sobre el mismo dominio no borra el horario ni cambia el nombre de la base local.

## Chats de comidas

Texto, imágenes, lecturas y vínculo con pedidos se guardan en PostgreSQL. Sobreviven a reinicios y despliegues mientras se utilice la misma base. El vencimiento se mantiene en **12 horas desde la creación de la conversación**; enviar mensajes o desplegar no renueva ese plazo. La API impide consultar mensajes e imágenes vencidos, y el servidor elimina los datos vencidos al iniciar y cada minuto. La auditoría sigue conservando los textos según el funcionamiento administrativo anterior; no duplica las imágenes.

Los chats que ya estaban solo en memoria antes de instalar esta actualización no pueden recuperarse tras ese primer reinicio. Los nuevos ya usan almacenamiento persistente. La cola de notificaciones se confirma junto con el mensaje; la recepción push depende de los permisos del dispositivo y de su suscripción vigente.

No se muestran nombres del proveedor de base de datos en las pantallas de la aplicación. Los mensajes se presentan en términos de su duración y disponibilidad.

## Puestos y cuentas

En **Revisar vendedores**, admin puede elegir **Eliminar puesto** y confirmar. Se retiran el puesto y sus productos del catálogo, se bloquea su reactivación y se conservan los pedidos y la bitácora. Otros roles no tienen acceso a esta operación.

El registro solicita **Nombres** y **Apellidos** por separado y almacena el nombre completo. Se retiraron el bloque “¿Eres docente?” y la casilla de venta del formulario inicial. La solicitud para vender sigue disponible desde la cuenta.

Los contactos, conversaciones y encabezados muestran el nombre completo guardado sin recortarlo. Abajo se muestra la matrícula derivada de `aNNNN@alumnos.uat.edu.mx`, o el correo del docente. Se puede buscar por nombre, correo o matrícula. Si una cuenta anterior guardó solo un nombre, la persona debe completar sus datos en **Mi cuenta**.

Se verificó registro, confirmación de token e inicio de sesión para `@docentes.uat.edu.mx`, incluso con mayúsculas. El dominio también conserva la clasificación Docente. Esta validación se realizó con un servicio de correo simulado; no confirma la entrega real en Microsoft 365. Ante falta de recepción, revisa spam y usa Reenviar correo de verificación; los errores reales de entrega se notifican desde el servidor.

## Auditorio de registros

Nuevo diseño con pestañas por categoría, filtros compactos, resumen de la página y movimientos con nombre, acción y fecha. Los cambios se presentan en una tabla **Dato / Antes / Después**. Los mensajes se leen directamente. Los identificadores y JSON quedan dentro de un apartado técnico; la actividad técnica y automática se oculta por defecto y puede activarse con su casilla. El historial sigue siendo exclusivo de admin.

No se ha desplegado esta actualización ni se ha accedido a tu base de producción.
