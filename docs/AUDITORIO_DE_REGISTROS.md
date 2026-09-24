# Auditorio de registros

Entra con una cuenta cuyo rol sea `admin` y abre **Auditorio de registros** en el menú. El servidor también verifica el rol: estudiantes y docentes no pueden consultar el historial por la API.

Incluye eventos, invitaciones y respuestas docentes, asistencias, documentos, QR, cuentas, sesiones, verificación, dispositivos, campus, productos, pedidos, monedas, experiencia, inventario, beneficios, notificaciones y chats. Las acciones de base de datos conservan sus valores anteriores y posteriores. Los textos nuevos de chats académicos y de comidas se conservan para administración. De las imágenes de comidas solo se registra el envío y su tamaño, no la imagen. La lista se actualiza con el botón Buscar / actualizar; no transmite cambios en tiempo real.

Busca por nombre, correo, identificador o contenido; filtra por módulo, acción y fechas. Las fechas del filtro corresponden a días UTC; cada registro muestra la hora local del navegador. Hay 50 registros por página. Para seguir una conversación, busca su `chat_id`, disponible en los detalles. Para correlacionar acciones de una misma operación, consulta su identificador de solicitud.

El historial está en PostgreSQL, es de solo consulta y no se elimina en los despliegues que conservan la misma base. Los triggers existentes bloquean su edición, borrado y truncado. No almacena contraseñas, tokens, claves push ni archivos binarios. No registra cada clic o lectura de pantalla; registra cambios de datos y solicitudes de modificación. Los procesos automáticos pueden aparecer como Sistema. Los nombres mostrados del autor proceden de su perfil actual.

Los registros existentes se muestran tal como estaban almacenados. Los textos de chats empiezan a conservarse con esta actualización: no se recuperan textos previos ni conversaciones temporales perdidas. Los chats siguen disponibles para sus participantes por sus plazos actuales (7 días académicos; 12 horas comidas), y se informa dentro del chat de la conservación administrativa de textos.

## Instalación

1. Ejecuta `ACTUALIZAR_AUDITORIO_GITHUB.ps1` desde PowerShell en la carpeta descomprimida. El repositorio predeterminado es `https://github.com/AmandoMtz/guia-fit.git`, rama `main`.
2. El script clona la rama en una carpeta temporal nueva, compara los archivos modificados con la versión base del ZIP y copia únicamente los archivos de esta actualización. Si encuentra un conflicto, se detiene antes de copiar. No fuerza el push.
3. Render aplicará `014_audit_console.sql` al iniciar si `AUTO_MIGRATE` no es `false`. Si lo desactivaste, ejecuta `npm run db:migrate` antes de arrancar la versión nueva. No se modificaron migraciones anteriores.
4. Inicia sesión con admin y abre el módulo. Si conservas la pantalla antigua, recarga la página.

No se ha realizado un despliegue ni se ha conectado a tu base de producción. Las pruebas locales usan PostgreSQL embebido y la API real del proyecto.
