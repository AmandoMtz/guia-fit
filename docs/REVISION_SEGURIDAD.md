# Revisión de seguridad de Guía FIT

Fecha: 13 de septiembre de 2026. Base: `guia-fit-main(1).zip`, la última versión adjunta.

Se revisó el servidor Node/Express, las consultas PostgreSQL, autenticación y sesiones, perfiles, eventos, Comidas, gamificación, chatbot, subida de imágenes, puntos de inserción HTML del cliente web y dependencias npm. Se aplicaron correcciones y se probaron en una base local PostgreSQL mediante PGlite. No se enviaron ataques, correos ni modificaciones al sitio de producción ni a los datos de Aiven.

## Resultado sobre inyección SQL

No se reprodujo una inyección SQL en las rutas revisadas. Los valores del usuario ya se transmitían como parámetros `$1`, `$2`, etc.; se conservó este mecanismo. Se endureció la lista de tablas de administración para aceptar solo propiedades propias de la lista permitida, excluyendo nombres heredados como `constructor` y `__proto__`. Los nombres de columnas también se validan antes de construir la consulta.

Las pruebas introducen comillas, `OR 1=1`, `DROP TABLE`, nombres de tablas y columnas manipulados: no permiten iniciar sesión, borrar otras filas, cambiar roles ni consultar otros perfiles. Las comillas legítimas se pueden guardar como texto; no se usa un filtro que borre caracteres y dé una falsa sensación de protección.

## Deficiencias corregidas

| Área | Antes | Ahora |
| --- | --- | --- |
| Fotografías de productos y directorio | Cualquier persona con la URL podía recuperar una foto, incluso sin publicarse. | Se comprueba publicación o sesión del propietario/administrador en la consulta que recupera los bytes. Productos pendientes, suspendidos, retirados o no disponibles no publican la imagen. Una referencia de directorio o de otro producto publicado sí puede mantenerla pública. |
| Caché de fotos | Respuesta pública con caché de un día. | Respuesta `private, no-store` para que nuevas respuestas no sigan accesibles en cachés compartidas al retirarlas. No revoca copias que alguien haya descargado previamente. |
| Invitaciones de eventos | Un docente invitado recibía la lista completa de invitados de ese evento. | La lista de invitados solo se entrega a quien organiza el evento o a administración. El directorio para invitar docentes sigue disponible para docentes; excluye cuentas sin correo confirmado. |
| Carga de imágenes | Algunas rutas comprobaban únicamente el MIME y la firma inicial del archivo. | Directorio, productos, chat y perfil decodifican imágenes estáticas reales y las convierten a WebP. Se descartan metadatos EXIF/GPS y datos anexados. Límite de entrada: 5 MB y 25 megapíxeles; salida: 1280 px por lado y 1,5 MiB, o 512 px/512 KiB para perfil. |
| Recursos de imágenes | Las cargas y transformaciones simultáneas no tenían un límite común. | Máximo de 4 cargas en curso y 2 transformaciones simultáneas por proceso. Si se ocupa la capacidad, se responde con un error temporal y se puede reintentar. Los límites multipart evitan campos/archivos extra. |
| Chat de Comidas | Conversaciones y conexiones SSE globales sin tope; lectores lentos podían acumular buffers. | 250 conversaciones temporales, 128 conexiones de notificaciones y 3 por usuario como máximo por proceso. Se cierran lectores saturados y se evita superponer las comprobaciones de sesión. |
| Imágenes simultáneas del chat | Varias cargas podían superar el límite de imágenes comprobado antes de decodificarse, o terminar después de expirar el chat. | Se vuelve a comprobar existencia, vigencia y capacidad justo antes de guardar el resultado; máximo de 24 imágenes por chat. Se mantiene el límite global de 64 MiB de imágenes temporales. |
| Historial del chatbot | Los mapas podían crecer indefinidamente; los registros caducados solo se quitaban al volver a consultar su clave. | Capacidad de 250 conversaciones por router, límite existente de mensajes y borrado automático al vencer el plazo. El historial autenticado permanece separado por usuario y sesión. |
| CSRF | Una cabecera Authorization cualquiera evitaba la comprobación adicional de Origin para cookies. | Esa excepción se limita al mecanismo Bearer que realmente usa el autenticador. Se conservan CORS de orígenes exactos y cookies SameSite. Es un refuerzo: CORS ya bloqueaba solicitudes de orígenes externos. |
| Sesiones | Se validaba vencimiento, pero no se volvía a comprobar la confirmación del correo. | Una sesión no da acceso privado si su usuario no tiene el correo confirmado. También se comprueba en fotos privadas y en la renovación de conexiones de chat. |
| QR de asistencia | Una petición GET podía crear o renovar el código. | GET solo consulta un código activo, o responde 409 si no existe. Generar/extender/regenerar se hace por POST, sujeto a permisos y protección CSRF. El panel web ya utilizaba POST. |
| Exportaciones | Las descargas PDF no tenían un límite específico. | Máximo de 15 solicitudes PDF por cuenta y ventana del limitador de 15 minutos. |
| Errores | Algunos errores registraban objetos completos o devolvían detalles del JSON mal formado. | Errores de entrada con mensajes genéricos y registros técnicos sin SQL, cuerpos, cookies o mensajes de error completos del proveedor. |
| Mantenimiento | CI ejecutaba pruebas, pero no auditoría de dependencias. | GitHub Actions también ejecuta `npm audit --omit=dev --audit-level=high`; falla si detecta vulnerabilidades altas o críticas de producción. |

Las imágenes ya guardadas antes de esta actualización no se convierten de nuevo ni se borran. Sus permisos de lectura sí se comprueban desde que se despliega el cambio. El redimensionamiento y eliminación de metadatos se aplican a nuevas cargas y reemplazos.

## Protecciones existentes comprobadas

- Contraseñas con scrypt y sal aleatoria; tokens aleatorios guardados mediante hash; cookies web HttpOnly, Secure en producción y SameSite=Lax.
- Enlaces de confirmación y recuperación de un solo uso, con vencimiento. Restablecer contraseña revoca sesiones anteriores.
- Perfiles, pedidos, chats, fotos de perfil y personalizaciones sujetos a identidad y permisos comprobados en el servidor.
- Precios y totales de pedidos calculados en el servidor; canjes y calificaciones con transacciones y protección frente a duplicados. El cliente no decide su rol, EXP o saldo.
- Helmet, CSP, bloqueo de incrustación en marcos, `nosniff`, política de referencia y HTTPS en producción. El texto de mensajes se escapa antes de insertarlo en HTML.
- Conexión Aiven con certificado CA y `rejectUnauthorized: true`; el navegador no recibe credenciales PostgreSQL.
- Límites de intentos en autenticación, mensajes y escrituras; JSON limitado a 32 KiB; solo `web/dist` se publica como archivos estáticos.
- El chatbot no ejecuta SQL generado por el modelo ni comandos del usuario. Su contexto se prepara en el servidor según la cuenta.

## Validación realizada

- `npm ci --ignore-scripts --no-fund`: instalación desde el lockfile.
- `npm test`: **107 pruebas aprobadas, 0 fallos**. Incluye autenticación, recuperación, permisos, SQL adversario, archivos, chat, eventos, gamificación, horario y almacenamiento local.
- Tras los ajustes finales en logs y comprobaciones de fotos publicadas/retiradas: **38 pruebas afectadas aprobadas, 0 fallos** (`security`, `food`, `chatbot`).
- `npm audit --json`: **0 vulnerabilidades conocidas reportadas** en las dependencias npm instaladas en la fecha de revisión. Esto no certifica ausencia de vulnerabilidades futuras ni evalúa los binarios desplegados en Render.
- Búsqueda de patrones comunes de credenciales en los archivos del proyecto: no se encontraron claves reales de esos formatos; el candidato detectado era el nombre de un paquete de Flutter. No sustituye revisar el historial de Git ni las variables del proveedor.
- Se ajustaron las vistas de vendedor de Flutter para enviar sesión a las fotos privadas de este servidor y nunca a otras URL. Se incluyó `flutter/test/image_headers_test.dart`. **Flutter no está instalado en este entorno: no se ejecutaron sus pruebas ni se compiló la aplicación móvil**; el workflow existente ejecutará `flutter analyze` y `flutter test` en GitHub.

## Aplicación de la actualización

El ZIP contiene el proyecto completo, un script PowerShell y una lista de los archivos cambiados con sus hashes. No incluye claves, dependencias instaladas ni una base con usuarios.

**No hay migraciones nuevas ni cambios de tablas para esta actualización.** No borres la base de datos ni ejecutes de nuevo manualmente los scripts iniciales. Se conservan las migraciones existentes con su contenido original.

`Actualizar-GitHub.ps1` clona la rama `main` en una carpeta nueva, comprueba que los archivos a actualizar coincidan con la base revisada o con el resultado, copia solamente los archivos de esta actualización, instala dependencias, ejecuta pruebas y auditoría, crea un commit y hace push normal a `main`. Si detecta que uno de esos archivos cambió en GitHub desde el ZIP, se detiene antes de sobrescribirlo para que se integre la versión nueva. No usa force push ni toca otras copias locales.

Cuando Render termine de desplegar, revisa con dos cuentas que puedas iniciar sesión, guardar el perfil, ver productos publicados, editar tus productos pendientes, abrir un chat, cargar una foto y generar el QR desde el panel del evento.

## Lo que requiere comprobar tu configuración de producción

El ZIP no da acceso a la configuración privada de Render, Aiven, Resend ni GitHub. Los siguientes controles no pueden darse por verificados:

1. En Render: `NODE_ENV=production`, `SITE_URL=https://castoresfit.com`, certificado CA correcto y secretos solo en las variables del servidor. Mantén `CORS_ORIGINS` vacío si no hay otro cliente web, o con orígenes exactos de tu propiedad. `trust proxy=1` presupone el proxy frontal del despliegue; revisarlo si se cambia esa arquitectura.
2. En Aiven: respaldos activos y una restauración de prueba; acceso de red limitado cuando sea posible; credenciales de ejecución con los mínimos permisos. Este proyecto migra automáticamente por defecto: para separar el usuario de ejecución del que modifica tablas, primero prepara un paso de migraciones con credenciales independientes y configura `AUTO_MIGRATE=false` en el proceso web. No retires permisos al usuario actual sin preparar ese cambio.
3. En GitHub/Render/Aiven/Resend: autenticación de dos factores, acceso administrativo limitado y rotación de cualquier clave que se haya publicado anteriormente. Revisar el historial de Git; retirar un secreto de un ZIP no invalida una clave ya filtrada.
4. Un ataque volumétrico requiere controles del proveedor o un proxy/WAF; los límites de la aplicación reducen consumo pero no garantizan resistir cualquier DDoS. Los límites en memoria son por proceso y no se comparten entre varias instancias.
5. La carrera del alumno sigue siendo declarada en su perfil y determina qué eventos de carrera aparecen. Es segmentación del producto, no una acreditación institucional de la carrera. No uses ese filtro para publicar información confidencial que exija una acreditación externa.
6. El log administrativo del chatbot conserva conversaciones hasta la limpieza existente de 90 días. No cambió su política de conservación; el contexto/historial temporal y el log administrativo son distintos. Si requiere otra política, debe ajustarse expresamente.

Esta revisión no es una certificación de invulnerabilidad ni confirma que la versión desplegada ya incluya los cambios. Cubre el código adjunto y las pruebas indicadas.

## Referencias técnicas

Los criterios de consultas parametrizadas y listas permitidas se contrastaron con [OWASP: SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html). La validación real, restricciones y conversión de imágenes siguen los criterios pertinentes de [OWASP: File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
