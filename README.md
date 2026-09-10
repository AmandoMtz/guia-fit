# Guía FIT 4 · Comidas más claras

Web responsiva y aplicación Flutter/Dart para encontrar espacios, comprar comida en la facultad y organizar el horario personal. Conserva acceso, registro, confirmación de correo, recuperación, perfiles, mapa y logotipos originales de UAT/FIT.

**¿Ya lo tienes en GitHub y Render? Empieza por `docs/ACTUALIZAR_V4.md`.** Esta entrega mejora Comidas sin cambiar el esquema de la base de datos.

## Empezar

1. Descomprime el ZIP completo.
2. Abre **LEEME_PRIMERO.html** para ver la guía rápida y luego ejecuta el servidor local. El lector de imágenes/PDF necesita HTTP o HTTPS, no abrir archivos con doble clic.
3. Instala Node.js 22.16 o posterior de la rama 22. Desde la raíz: `npm ci` y `npm start`.
4. Abre **http://localhost:3000**. Sin variables de conexión, puedes explorar la demostración.
5. Para activar cuentas reales, sigue **docs/RENDER_AIVEN_GIT.md**. No se incluyen credenciales ni cuentas de ejemplo que permitan iniciar sesión.

## Arquitectura

| Pieza            | Implementación                                                                          |
| ---------------- | --------------------------------------------------------------------------------------- |
| Web              | HTML, CSS y JavaScript, adaptable a celular y escritorio                                |
| API              | Node.js / Express, alojada junto a la web en Render                                     |
| Datos y fotos    | PostgreSQL en Aiven, conexión TLS con CA verificada                                     |
| Horario personal | Tabla editable guardada en el dispositivo por ID de cuenta; el PDF o imagen se descarta |
| App              | Flutter y Dart para Android, iOS y web; consume la misma API                            |
| Correo           | Resend por HTTPS; SMTP opcional                                                         |
| Código           | Git, archivo de exclusiones, workflow de GitHub Actions y Blueprint de Render           |

## Funciones incluidas

- Login con pestañas de registro, ver/ocultar contraseña, validación de campos, mensajes de carga y recuperación.
- Confirmación obligatoria de correo; contraseñas con hash scrypt; sesiones web en cookies HttpOnly; almacenamiento seguro del token en móvil.
- Perfil con matrícula opcional. Un administrador contrasta identidad con una fuente institucional; editar nombre o matrícula invalida esa revisión.
- Directorio con búsqueda y filtros, ficha por espacio, fotografía opcional, croquis ampliable con marcadores y navegación por tramos.
- Recorridos con **Anterior**, **Siguiente**, **Llegué** y reinicio. Filtrado por accesibilidad verificada. No incluye GPS interior ni detecta automáticamente la llegada.
- Panel web para agregar/editar salones, fotografías, tramos y revisar perfiles. Web y Flutter incluyen revisión de vendedores para administradores.
- Fotos de entrada en JPG/PNG/WebP, máximo 5 MB, almacenadas en Aiven para conservarlas cuando Render reinicie.

## Comidas: del antojo a la entrega

- **Explorar**: productos con foto, precio por unidad o lote, búsqueda y menús por puesto.
- **Mis compras**: seguimiento de lo que tú pediste, con instrucciones según su estado.
- **Pedidos recibidos**: acceso directo a las ventas, filtros Nuevos / En preparación / Por entregar / Historial y contadores por cuenta.
- **Mi puesto**: menú, fotos y precios; activa o pausa productos y consulta el estado real de publicación.
- **Solicitar pedido**: cantidad con botones +/−, total y piezas por lote antes de enviar. Después aparece la confirmación y el botón Ver seguimiento.
- **Avisos**: Ver pedido abre el pedido exacto, tanto de compra como de venta. Los contadores y cambios se consultan cada 30 segundos con la app activa; las confirmaciones y formularios no se cierran al actualizar.

## Módulos conservados

- **Comidas**: catálogo de vendedores aprobados, productos con foto y precios en MXN por unidad o lote, búsqueda por puesto y solicitudes de compradores con sesión iniciada.
- **Mi puesto**: solicitud de alta, edición de datos, alta/edición/eliminación de productos, disponibilidad y pedidos recibidos. La opción de vendedor en el registro indica interés; no otorga aprobación ni privilegios.
- **Pedidos y avisos**: solicitado → aceptado → listo → entregado; cancelación antes de aceptar y rechazo por el vendedor. Avisos persistentes en la cuenta, consultados cada 30 segundos con la app abierta y al entrar en Avisos. No incluye cobros, reparto, mensajes externos ni notificaciones push con la app cerrada.
- **Mi horario**: importa PDF, JPG, PNG o WebP. Extrae texto localmente; imágenes y páginas escaneadas usan OCR en el dispositivo. Revisa nombre, matrícula, carrera, materia, maestro, grupo, salón, día y horas antes de guardar.
- **Tabla de 11 columnas y vista semanal**: genera la tabla a partir de los datos, sin necesidad de mostrar o conservar el original. Permite editar clases, vincular salones con el directorio y detectar cruces. La app descarta el PDF o imagen después de leerlo; solo persisten los datos estructurados.
- **Privacidad del horario**: cada ID de cuenta tiene su propio registro local. No se sube a Aiven ni se sincroniza a otros dispositivos, dominios o navegadores. Al iniciar otra cuenta, la aplicación abre el horario de esa cuenta. Borrar datos del navegador/app elimina el horario local.

Consulta `docs/COMIDAS_HORARIO.md` para el uso y los límites de la importación.

## Información real y demostración

El croquis permite identificar nueve espacios, pero no informa todos los salones, pisos o caminos transitables. Se cargan como **pendientes de comprobar**, sin inventar numeraciones ni conexiones. El recorrido demostrativo usa nombres ficticios y nunca se publica como ruta real. Para habilitar recorridos reales, un administrador debe revisar y registrar puntos y tramos con fuente y fecha. Consulta **docs/DATOS_DEL_CAMPUS.md**.

Confirmar un correo solo acredita el acceso a ese buzón. No se presupone ningún dominio oficial ni integración con registros privados de UAT. La revisión institucional es manual y está restringida a administradores.

## Carpetas

- `web/dist/`: sitio listo para servir, assets originales y cliente de la API.
- `server/`: autenticación, API, acceso PostgreSQL, correos y migraciones.
- `backend/`: esquema SQL, catálogo inicial y datos de referencia.
- `flutter/`: fuentes `.dart`, plataformas nativas, configuración y pruebas.
- `tests/`: pruebas de API, rutas, lector PDF, OCR y almacenamiento local.
- `docs/`: actualización, uso de módulos, despliegue, Flutter y resultados de verificación.
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

## Motores locales y licencias

PDF.js, Tesseract.js y el modelo de español se incluyen en `web/dist/vendor/`; Flutter Web lleva su copia del OCR en `flutter/web/vendor/`. No se envía el documento a un servicio de OCR. El navegador descarga los motores desde tu propio sitio antes de procesar. En Android/iOS, Flutter usa ML Kit con el modelo latino incluido en el paquete nativo. La importación funciona con documentos legibles; OCR y extracción no sustituyen la revisión del alumno ni una validación institucional.

Para actualizar las copias estáticas tras cambiar sus dependencias fijadas: `npm run assets:pdf` y `npm run assets:ocr`, y añade los archivos generados a Git. Las dependencias de desarrollo y compilaciones no se incluyen en el ZIP. Las licencias acompañan a los motores; `FOOD_IMAGE_LICENSE.txt` acredita la fotografía ilustrativa de Comidas.

## Funciones de la entrega anterior que se conservan

- Importación del formato **GPO, MATERIA, AULA, LUNES, MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO, DOMINGO, PROFESOR**. Conserva celdas vacías por coordenadas y reúne textos que ocupan varias líneas. No agrupa las clases únicamente por docente u hora.
- **Mi cuenta → Mi tipo de cuenta** permite cambiar entre Alumno y Alumno vendedor, incluso en cuentas antiguas. La aprobación del puesto sigue a cargo del administrador. Volver a Alumno pausa las ventas nuevas y conserva el historial.
- **Foto de perfil**: subir, reemplazar o quitar en web y Flutter. El servidor valida y convierte a WebP de hasta 512 × 512; guarda una sola imagen por cuenta. La foto personal solo se consulta desde la sesión de esa cuenta.
- **Sin PDF guardado**: se eliminó la opción de conservar originales. La actualización local retira originales anteriores sin borrar las clases.
- La migración aditiva `003_profiles.sql` incorpora fotos y pausa de puestos. Las migraciones 001 y 002 permanecen intactas.

Consulta [ACTUALIZAR_V4.md](docs/ACTUALIZAR_V4.md) y [ALMACENAMIENTO.md](docs/ALMACENAMIENTO.md). No se cambia la configuración de Render/Aiven ni se necesitan claves nuevas.
