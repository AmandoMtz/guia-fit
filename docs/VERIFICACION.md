# Comprobaciones de la actualización 4

Revisión de la entrega 4: 10 de septiembre de 2026.

| Comprobación                                               | Resultado                                                                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pruebas Node de API, almacenamiento, PDF/OCR y horarios    | 55 aprobadas                                                                                                                                                                        |
| Dependencias                                               | Versiones y resolución idénticas a la entrega 3; auditoría previa de esa entrega: 0 vulnerabilidades reportadas. No se repitió la consulta de avisos de seguridad en esta revisión. |
| Pruebas Flutter de modelos, almacenamiento y widgets       | 29 aprobadas: las 24 previas y 5 de Comidas                                                                                                                                         |
| `flutter analyze --no-pub`                                 | Sin incidencias en la revisión                                                                                                                                                      |
| Flutter Web                                                | Compilación JavaScript de producción comprobada                                                                                                                                     |
| JavaScript propio de web y servidor                        | Sintaxis comprobada con Node                                                                                                                                                        |
| Migraciones 001, 002 y 003, `render.yaml`, logos y croquis | Idénticos a la entrega 3                                                                                                                                                            |

## Comidas: comprobaciones de esta entrega

- API: el detalle de un pedido solo puede consultarse por su comprador o su vendedor. Se rechazan usuarios ajenos, otro vendedor y un administrador ajeno. Los avisos indican el rol y el estado actual sin deducir permisos del texto.
- Los contadores distinguen compras y ventas; los pedidos cancelados y entregados salen de los contadores activos. Marcar avisos como leídos no cambia los pedidos.
- Dos lotes de tres piezas muestran seis piezas y conservan el precio del lote completo. Se mantienen cálculo de importes e idempotencia en el servidor.
- Flutter: el botón Pedidos recibidos consulta ventas directamente; Mis compras consulta compras. Ver pedido marca el aviso como leído y abre el pedido correcto.
- Flutter: mientras se envía una solicitud, el botón no vuelve a enviar. Al terminar muestra la confirmación y Ver seguimiento devuelve el ID recibido del servidor.
- Flutter: tarjeta de pedido a 360 px y texto al 150 %, incluyendo confirmación de entrega solo en la vista del vendedor. No se detectaron desbordamientos en esa prueba.
- JavaScript propio: comprobación de sintaxis, reglas de filtrado y ordenación por prioridad, navegación de avisos y acciones por estado. No se realizó inspección visual con navegador.

## Comprobaciones generales conservadas

**Formato FIT:** los clientes web y Flutter comparten ejemplos sintéticos con las 11 columnas. Las pruebas cubren celdas vacías, encabezados repetidos, GPO, profesor repetido en distintas materias/días, texto de varias líneas, varios intervalos por día, domingo, tabuladores con huecos y filas incompletas. Humanismo con Ibarra el martes a las 11 e Investigación con Ibarra el miércoles a las 11 quedan separados y no se marcan como cruce.

**Lectura:** se ejecutó PDF.js sobre PDF reales generados en memoria, incluido el formato de 11 columnas. Tesseract y el modelo español se ejecutaron sobre una imagen sintética. La lectura no envía el horario a una API. No se recibió un PDF real de horario del alumno: el diseño concreto de ese documento queda sujeto a revisión al importarlo.

**Almacenamiento local:** IndexedDB simulado y archivos JSON temporales verificaron persistencia de clases, edición, eliminación por cuenta y limpieza de originales antiguos. El registro nuevo no admite PDF, imagen, nombre de archivo ni texto OCR. La tabla Flutter se probó a 360 y 1280 px; se comprobó que los días y acciones de edición identifican la clase correcta.

**API:** se usaron Express, Supertest y PostgreSQL embebido PGlite. Las fotos se decodificaron con Sharp, comprobando WebP de 512 × 512, ausencia de EXIF, reemplazo de una única fila, eliminación, aislamiento y rechazo de imágenes inválidas o demasiado grandes. El modo vendedor se probó en una cuenta creada sin esa opción: no eleva privilegios, mantiene la revisión administrativa, pausa nuevos pedidos y permite terminar los pendientes. Una suspensión sigue vigente después de cambiar de modo.

También se comprobó que una respuesta tardía de perfil o fotografía de la cuenta anterior no reemplace los datos de la cuenta nueva después de cerrar/iniciar sesión.

Las pruebas originales de acceso, verificación, pedidos, avisos y directorio se mantienen. Se actualizaron dos contraseñas ficticias de pruebas para cumplir la política de letra, número y carácter especial que ya tenía tu repositorio; no se modificó esa política.

## Límites de la comprobación

No se desplegó en tu Render, no se accedió a tu base real de Aiven, no se publicó un commit en GitHub y no se enviaron correos reales. El ZIP incluye las fuentes y las migraciones existentes; esta entrega no cambia el esquema. La guía de actualización explica cómo publicarlo.

No se realizó inspección visual de la web con navegador. No se compiló ni firmó APK/IPA ni se ejecutó ML Kit en un teléfono físico. Los cambios de almacenamiento y parser nativo se comprobaron mediante pruebas Flutter; el OCR nativo conserva su implementación local.

Las horas y campos incompletos requieren corrección. La revisión del alumno no equivale a una verificación institucional. Los avisos de pedidos son internos a la app, no push con la aplicación cerrada.

El ZIP contiene web, servidor, Flutter, plataformas, librerías estáticas, modelos de OCR, configuración de ejemplo, pruebas y documentación. Excluye credenciales, certificados, node_modules, SDK, compilaciones y datos reales de alumnos.
