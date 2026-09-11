# Comidas, cuenta y horario personal · versión 4

## Cuenta de alumno y vendedor

Puedes ser alumno y vender con la misma cuenta. La casilla del registro es opcional: después puedes abrir **Mi cuenta → Mi tipo de cuenta → Alumno vendedor** y guardar. La foto de perfil también se administra desde Mi cuenta: subir, reemplazar o quitar.

Para vender, abre **Comidas → Quiero vender**, completa nombre del puesto, lugar de entrega y horario. El administrador comprueba el vínculo con la facultad y aprueba el puesto con una fuente de evidencia. Marcar la casilla, confirmar el correo o activar Alumno vendedor no concede aprobación institucional.

Un puesto pendiente puede preparar productos. Solo aparecen en el catálogo los puestos aprobados y activos con productos disponibles. Cambiar el nombre o lugar de entrega del puesto requiere una nueva revisión. Cambiar horarios de atención o descripción no la invalida. Editar un puesto pausado no reactiva las ventas.

Puedes volver a **Alumno**: se oculta el puesto y se pausan pedidos nuevos; se conservan productos, aprobación, pedidos y avisos. Puedes terminar los pedidos existentes desde Mi puesto. Reactivar Alumno vendedor permite publicar si el puesto sigue aprobado. Una suspensión administrativa no se evita cambiando de tipo de cuenta.

## Comprar y seguir tu pedido

1. En **Comidas → Explorar**, busca un producto o abre **Ver puestos** para consultar un menú.
2. Pulsa **Consultar / pedir**. Se abre un chat privado con el vendedor para preguntar si sigue ahí, qué más tiene disponible o cualquier detalle antes de confirmar.
3. El chat admite texto e imágenes JPG/PNG/WebP de hasta 5 MiB. No admite PDF, documentos, audio ni video. La conversación completa y sus imágenes expiran 12 horas después de iniciarse y no se escriben en Aiven.
4. Cuando estés listo, pulsa **Hacer pedido** dentro del chat. Elige cuántas unidades o lotes quieres, revisa el total, añade una nota opcional y confirma.
5. Consulta **Mis compras**. Los estados visibles son **Por confirmar**, **En preparación**, **Listo para recoger** y **Entregado**. La fila de seguimiento muestra Enviado → Confirmado → Listo → Entregado. El pedido permanece aunque el chat ya haya expirado.
6. Espera a que esté listo antes de ir al punto de entrega. El pago se acuerda con el vendedor al recoger.

Cancelar solo está disponible antes de la aceptación. Rechazados y cancelados quedan en el historial. El estado En preparación representa que el vendedor aceptó la solicitud; no se inventan tiempos estimados ni una ubicación en tiempo real.

### Chat temporal de 12 horas

**Comidas → Chats** reúne las conversaciones activas de comprador y vendedor. Los mensajes nuevos llegan en tiempo real mientras Comidas está abierta y la campana incluye su contador temporal. Abrir un chat marca como leídos sus mensajes para esa cuenta. Solo comprador y vendedor pueden consultar la conversación y sus imágenes.

El chat usa únicamente memoria temporal del proceso del servidor: no existe una tabla de chats en PostgreSQL ni se reutiliza la tabla persistente de fotografías. Por ello, un reinicio o un nuevo despliegue de Render puede cerrar chats activos antes de las 12 horas. Los pedidos confirmados y sus avisos persistentes no se pierden por ese motivo.

## Vender y atender clientes

**Pedidos recibidos** tiene su propio acceso en Comidas: muestra las solicitudes de tus clientes. **Chats** muestra las conversaciones temporales en las que eres comprador o vendedor. **Mis compras** muestra lo que tú compras, aunque también tengas puesto.

- **Nuevos:** Aceptar pedido o No puedo atenderlo.
- **En preparación:** Avisar: listo para recoger; si no puedes completarlo, Cancelar preparación avisa al comprador.
- **Por entregar:** Confirmar entrega, con una pregunta antes de marcarla.
- **Historial:** entregados, cancelados y rechazados.

**Mi puesto** presenta contadores de nuevos, en preparación y por entregar que abren el filtro correspondiente. **Mi menú** permite editar el producto, pausar/activar su disponibilidad y eliminarlo conservando pedidos anteriores. Preparado no significa publicado: se muestra si el puesto sigue pendiente, pausado o suspendido.

Las revisiones administrativas siguen en **Revisar vendedores**. No se conceden permisos nuevos mediante la interfaz.

## Avisos que llevan al pedido

En la campana, pulsa **Ver pedido** para abrir el pedido concreto. La API indica si corresponde a tus compras o a tus ventas; un usuario ajeno, incluso administrador, no puede consultar el detalle privado de otra persona con ese enlace. **Ver mi puesto** abre el resultado de una revisión administrativa.

Los avisos, contadores y cambios de estado se consultan cada 30 segundos con la aplicación activa. También hay **Actualizar**. Los pedidos se actualizan sin cambiar el filtro. La web conserva abiertos los formularios y las confirmaciones. Los contadores abarcan todos tus pedidos; las listas muestran los últimos 300 más el pedido abierto desde un aviso, aunque sea anterior. Los avisos muestran el estado actual del pedido además del mensaje histórico.

## Productos y pedidos

Cada producto admite nombre, descripción, fotografía JPG/PNG/WebP y precio en pesos mexicanos. Indica **unitario** o **lote**, con cuántas piezas incluye el lote. El vendedor administra disponibilidad y puede quitar productos del catálogo sin borrar el historial.

El comprador necesita iniciar sesión. El flujo web abre primero el chat y permite confirmar el pedido desde esa conversación. El servidor vuelve a comprobar disponibilidad y precio, calcula el total y evita pedidos duplicados al reintentar la misma solicitud.

Estados: solicitado → aceptado → listo → entregado. El vendedor puede rechazar pedidos solicitados o aceptados; el comprador puede cancelar mientras está solicitado. El vendedor recibe un aviso persistente y el comprador recibe avisos de cambios. Se consultan dentro de la app, con actualización periódica; no son notificaciones push con la app cerrada ni mensajes por WhatsApp/correo. No se cobran pagos en línea.

Límites: 80 productos activos por puesto; imagen de producto de hasta 5 MiB; hasta 50 unidades o lotes por solicitud; chat de 12 h con mensajes de hasta 1200 caracteres y hasta 24 imágenes temporales; los listados muestran los últimos 300 pedidos y 80 avisos. Los registros persistentes anteriores permanecen en la base.

## Importar el horario de 11 columnas

1. Inicia sesión y abre **Mi horario → Subir imagen o PDF**.
2. Selecciona PDF, JPG, PNG o WebP, de hasta 8 MiB. Los PDF admiten hasta 20 páginas.
3. El dispositivo extrae el texto o usa OCR local. La app descarta el archivo al terminar la lectura; no ofrece guardarlo ni lo sube a Aiven.
4. Revisa nombre, matrícula, carrera y las clases extraídas. La tabla usa este orden:

| GPO | MATERIA       | AULA  | LUNES | MARTES      | MIÉRCOLES   | JUEVES | VIERNES | SÁBADO | DOMINGO | PROFESOR |
| --- | ------------- | ----- | ----- | ----------- | ----------- | ------ | ------- | ------ | ------- | -------- |
| 2A  | Humanismo     | A-101 | —     | 11:00–12:00 | —           | —      | —       | —      | —       | Ibarra   |
| 2A  | Investigación | A-102 | —     | —           | 11:00–12:00 | —      | —       | —      | —       | Ibarra   |

Estos son datos ficticios de ejemplo, no salones o clases verificados. La hora de salida del ejemplo se usa solo para ilustrar la tabla; el lector necesita la salida real del documento o que el alumno la capture.

5. Agrega, edita o quita cada bloque de clase. Puedes corregir materia, profesor, GPO, aula, día, entrada y salida, y vincular el aula con el directorio si corresponde.
6. Confirma que revisaste los datos y guarda. Solo se conserva la información estructurada, separada por cuenta. El texto OCR auxiliar se descarta.

La lectura mantiene posiciones de las columnas y celdas vacías. No reúne materias solo porque tienen el mismo profesor u hora. Los cruces se señalan cuando las horas se superponen **en el mismo día**; martes y miércoles a las 11 no son un cruce. Una celda con varios intervalos genera varios bloques. Los registros exactamente repetidos se eliminan; grupos o aulas diferentes no se fusionan.

Si no se reconocen las 11 celdas, una hora es incompleta o una línea queda fuera de una fila clara, se muestra un aviso para revisión. No se asigna una duración inventada. La extracción no garantiza reconocer cualquier diseño o fotografía borrosa: puedes consultar el texto detectado mientras revisas o capturar las clases manualmente. No se proporcionó un PDF real de horario para comprobar su diseño concreto.

## Consultar y editar

El resultado incluye **tabla de materias de 11 columnas** y **vista semanal por horas**. En celular puedes deslizar horizontalmente. La tabla funciona sin PDF ni imagen. La semana es recurrente y no incorpora automáticamente vacaciones, nuevas inscripciones ni cambios oficiales. La revisión del alumno no acredita una inscripción institucional.

**Editar horario** permite cambiar datos del alumno y las clases. **Eliminar horario** quita únicamente el registro de la cuenta activa en ese dispositivo. No modifica su perfil en Aiven ni el horario de otra cuenta.

La actualización limpia originales guardados por versiones anteriores conservando las clases. Los detalles de privacidad, sincronización, fotos y espacio están en [ALMACENAMIENTO.md](ALMACENAMIENTO.md).

## Horario de docentes (V5)

Cuando la sesión se identifica como docente por `@uat.edu.mx` o `@docentes.uat.edu.mx`, la **web** cambia Mi horario a un formulario simplificado. Cada bloque conserva únicamente **Materia, Salón, Día, Hora de inicio y Hora de fin**; el nombre del docente se toma del perfil y no se le pide grupo, carrera ni matrícula.

El lector web acepta la tabla estudiantil ya soportada y además intenta reconocer formatos docentes con encabezados **Materia**, **Lunes–Domingo** y **Aula**, incluso si contienen columnas como **G, Clave, Sit, F.F., Hrs. Semana, Hrs. Mat. o Hrs. Nom.**. Esas columnas se ignoran. Como con cualquier OCR, el docente revisa el resultado antes de guardarlo.

El horario docente sigue siendo local al dispositivo: el PDF o imagen se procesa y se descarta, y Aiven no recibe el horario estructurado.
