# Comidas y Mi horario

## Una cuenta, varias funciones

Una misma persona puede comprar comida, organizar sus clases y solicitar ser vendedora. Al registrarse puede marcar **Quiero vender comida**. Después de confirmar su correo, completa la solicitud en Comidas. No se conceden roles administrativos desde formularios.

## Comidas

**Productos** muestra lo disponible de puestos aprobados, con fotografía, descripción, punto de entrega y precio en MXN. Puedes buscar comida o filtrar por puesto. **Vendedores** incluye todos los puestos aprobados, aunque aún no tengan productos disponibles.

El vendedor puede publicar hasta 80 productos activos. Cada producto puede venderse por unidad o lote; un lote contiene de 2 a 1,000 piezas. El precio corresponde a una unidad o a un lote completo. Las fotografías admiten JPG, PNG y WebP, hasta 5 MB, y se almacenan en PostgreSQL para conservarlas cuando Render reinicie. Usa fotografías propias del producto. La fotografía que acompaña a la demostración es ilustrativa y está acreditada en `FOOD_IMAGE_LICENSE.txt`.

El comprador solicita de 1 a 50 unidades o lotes y puede agregar una nota. Se muestra el total antes de enviar. El servidor comprueba disponibilidad y precio; un precio cambiado obliga a revisar el catálogo. Reintentar la misma solicitud no crea dos pedidos. El vendedor no puede comprar sus propios productos.

| Estado                           | Siguiente acción                                    |
| -------------------------------- | --------------------------------------------------- |
| Solicitado                       | Vendedor acepta o rechaza; comprador puede cancelar |
| Aceptado                         | Vendedor marca listo o rechaza si no puede cumplir  |
| Listo para recoger               | Vendedor marca entregado                            |
| Entregado, rechazado o cancelado | Se conserva en el historial                         |

Los avisos se guardan en la cuenta y se consultan al abrir la app y aproximadamente cada 30 segundos mientras está visible. La campana muestra los pendientes. **No se envían notificaciones push, correos de pedido ni WhatsApp**, y no se incluye pasarela de pago. El pago y la recogida se acuerdan con el vendedor. Los listados muestran los últimos 300 pedidos y 80 avisos; marcar todos leídos actualiza también los avisos anteriores.

La revisión del puesto es manual. El administrador debe contrastar identidad, vínculo con la facultad y autorización para vender mediante información confiable. El correo confirmado por sí solo no acredita estos datos. Cambiar el nombre o punto de entrega de un puesto aprobado requiere nueva revisión; una suspensión retira el puesto del catálogo. El historial de pedidos se conserva al cambiar o eliminar un producto.

## Importar y editar tu horario

1. Inicia sesión y abre **Mi horario → Subir imagen o PDF**.
2. Selecciona PDF, JPG, PNG o WebP, hasta 8 MB. Los PDF admiten hasta 20 páginas.
3. El lector toma el texto del PDF o aplica OCR local a imágenes y páginas escaneadas. Intenta reconocer nombre del alumno, matrícula, carrera y filas de clases.
4. Revisa los datos. Cada clase contiene materia, maestro, grupo, salón, día y horas de entrada/salida. Puedes agregar, editar o quitar clases. Si una materia se imparte varios días, se guarda un bloque por día.
5. Si corresponde, vincula cada salón con el directorio. No se asigna una ubicación supuesta a partir del número del aula.
6. Elige si quieres conservar el original en el dispositivo, confirma la revisión y guarda.

El resultado principal es una **tabla semanal generada a partir de datos**. No necesitas mantener visible ni conservar la imagen/PDF. En celular, desliza horizontalmente para ver todos los días; en escritorio, la tabla ocupa el panel de contenido. Usa **Editar** dentro de una clase o **Editar horario** para cambiar datos. Los cruces de horas se señalan para que puedas corregirlos. La semana es recurrente y no incorpora automáticamente vacaciones, inscripciones ni cambios oficiales.

El reconocimiento admite filas con materia, maestro, salón, grupo, día y horas, y tablas con columnas de días de la semana. Hay formatos con celdas combinadas, texto rotado o columnas que no pueden recuperarse automáticamente. Una imagen borrosa o recortada también puede producir errores. Siempre puedes revisar el texto detectado y capturar las clases faltantes. Esta extracción y tu revisión **no son una validación institucional**.

## Dónde se guarda

| Datos                                              | Ubicación                                                |
| -------------------------------------------------- | -------------------------------------------------------- |
| Cuenta, puesto, productos, fotos, pedidos y avisos | Aiven, mediante API autenticada de Render                |
| Tabla y original opcional en la web principal      | IndexedDB de ese navegador, bajo el ID de tu cuenta      |
| Tabla y original opcional en Flutter Android/iOS   | Carpeta local de la app, bajo el ID de tu cuenta         |
| Tabla y original opcional en Flutter Web           | IndexedDB propio de Flutter Web, bajo el ID de tu cuenta |

El nombre y la matrícula son campos del horario; no se utilizan para abrir los horarios de otras personas. La aplicación consulta el registro del usuario autenticado. Cambiar a otra cuenta muestra el registro de esa cuenta. Cerrar sesión conserva el horario local para cuando vuelvas a entrar.

La información no se guarda “en el correo” ni viaja al servidor: queda asociada a tu cuenta **en ese dispositivo**. No se sincroniza con otro celular, navegador, dominio ni entre la web principal y Flutter. Borrar los datos del navegador/app o reinstalarla puede eliminarla. Si cambias a un dominio comprado, deberás importar el horario de nuevo en ese dominio.

El almacenamiento local está protegido por el acceso al dispositivo y la separación de cuentas en la aplicación; no es una bóveda cifrada para un equipo compartido con acceso técnico a sus archivos. Android tiene desactivado el respaldo automático; los respaldos del sistema en iOS dependen de la configuración del dispositivo.

**Eliminar horario** borra la tabla y el original guardado de esa cuenta en ese dispositivo. Las tablas de otras cuentas no se borran.

Motores utilizados: [PDF.js](https://mozilla.github.io/pdf.js/), [pdfrx](https://pub.dev/packages/pdfrx/versions/1.3.5), [Tesseract local](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) y [ML Kit con modelo incluido](https://developers.google.com/ml-kit/vision/text-recognition/v2/android). El documento del alumno se procesa localmente; el navegador solo descarga los archivos del motor desde tu sitio.
