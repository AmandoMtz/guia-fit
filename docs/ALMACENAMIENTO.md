# Qué se guarda en Aiven y qué queda local

La separación se revisó en las migraciones y llamadas de la API de este proyecto. No se accedió a tu base real de Aiven. En el código recibido, el horario ya era local; esta actualización elimina la conservación opcional de su archivo original.

| Datos                                                                                                | Ubicación                                                            | Motivo y acceso                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuenta, correo, nombre y matrícula del perfil                                                        | PostgreSQL en Aiven                                                  | La misma identidad se usa en distintos dispositivos. Solo la cuenta consulta su perfil; el administrador tiene el flujo de verificación autorizado.                        |
| Contraseña y sesiones                                                                                | Aiven; contraseña con hash scrypt y tokens del servidor con hash     | La web usa una cookie HttpOnly; Flutter móvil conserva el token en almacenamiento seguro del sistema. Nunca se incluye la contraseña en la tabla del horario.              |
| Tipo Alumno/Alumno vendedor, puesto y aprobación                                                     | Aiven                                                                | Deben ser consistentes entre dispositivos. Cambiar el tipo de cuenta no concede permisos de administrador ni verificación institucional.                                   |
| Productos, precios, pedidos y avisos                                                                 | Aiven                                                                | Comprador y vendedor necesitan consultar el mismo pedido. El servidor valida propietario, estado y precio.                                                                 |
| Chat de Comidas: mensajes e imágenes                                                                 | Memoria temporal del proceso de Render                               | No se escriben en PostgreSQL. Cada conversación expira 12 h después de abrirse; las imágenes también. Un reinicio o despliegue puede descartarla antes porque no existe copia persistente. |
| Foto de perfil                                                                                       | Aiven, una fila por cuenta                                           | Imagen WebP optimizada, hasta 512 × 512 y 512 KiB. La API exige la sesión de su propietario para leer, cambiar o borrar. No existe directorio público de fotos de alumnos. |
| Fotografías de productos y espacios                                                                  | Tabla `photos` de Aiven                                              | Conserva la arquitectura actual; los compradores necesitan ver las fotos. Límite actual de 5 MiB por archivo.                                                              |
| Nombre, matrícula y carrera extraídos del horario; materias, grupos, aulas, profesores, días y horas | Solo el dispositivo, con la clave de la cuenta                       | Se guardan como datos editables. No se envían a Aiven ni sustituyen automáticamente los datos del perfil.                                                                  |
| PDF o imagen del horario                                                                             | Memoria durante la lectura; copia temporal necesaria para OCR nativo | La app descarta el original tras extraer texto. No se guarda en la base ni en el registro local del horario. Las copias temporales nativas se limpian al terminar.         |
| Texto OCR sin estructurar y avisos de importación                                                    | Memoria durante la revisión                                          | Se muestran para corregir la extracción y no se guardan con la tabla.                                                                                                      |
| Motores PDF/OCR y logos                                                                              | Archivos estáticos de la aplicación                                  | Son compartidos y no contienen información de alumnos.                                                                                                                     |

## Chat temporal de Comidas

El chat se mantiene en memoria del servidor y se elimina automáticamente al vencer su temporizador de 12 horas. Las imágenes recibidas se validan, se optimizan a WebP y permanecen en la misma memoria temporal; no se crea una tabla de chat ni una fila de imagen en Aiven. Solo los participantes de la conversación pueden leer sus mensajes o imágenes.

Esta decisión evita conservar conversaciones, pero tiene una consecuencia intencional: si Render reinicia el proceso o haces un nuevo deploy, los chats activos se pierden antes de vencer. Los pedidos ya confirmados no se afectan porque esos sí están en `food_orders`.

## Horarios locales por cuenta

La web usa IndexedDB; Flutter Android/iOS usa un JSON en la carpeta privada de la app; Flutter Web usa su propio IndexedDB. La clave es el ID estable de la cuenta autenticada, no un correo escrito en un formulario.

Las pantallas solo abren el horario de la cuenta activa. Un usuario que cierre sesión y entre con otra cuenta no verá la tabla anterior. Esto no convierte el navegador en una bóveda cifrada: alguien con acceso técnico al dispositivo o a sus datos puede inspeccionar almacenamiento local. Evita usar un dispositivo compartido sin protección del sistema.

No existe sincronización del horario por correo ni entre equipos. Cambiar de navegador, dominio, perfil del navegador o app requiere importar el horario en ese entorno. Borrar datos del sitio o desinstalar puede eliminarlo; las copias de seguridad del sistema dependen de su configuración. No se elimina tu PDF original guardado fuera de la app.

La versión del registro local pasa a 2. En los dos clientes web, la actualización del almacén elimina campos del original en registros antiguos y conserva clases. En Flutter móvil, la lectura de cada cuenta reescribe su JSON antiguo sin archivo; no decodifica ni vuelve a guardar el PDF/imagen.

## Fotografías y espacio de Aiven

Guardar una foto pequeña por cuenta en `bytea` funciona con PostgreSQL y evita depender del disco temporal de Render. Se limita a una imagen por alumno; reemplazarla actualiza la misma fila y quitarla borra esa fila. Sharp decodifica, limita dimensiones, ajusta orientación y vuelve a codificar, sin conservar metadatos EXIF del archivo de entrada. Véanse [opciones de entrada](https://sharp.pixelplumbing.com/api-constructor/) y [salida sin metadatos](https://sharp.pixelplumbing.com/api-output/).

Las fotos grandes de productos y espacios consumen más espacio que perfiles y pedidos. Para crecer, conviene trasladar esas imágenes a almacenamiento de objetos y dejar en PostgreSQL las referencias, dueño y metadatos. Esa migración requeriría escoger y configurar ese servicio; esta entrega conserva Aiven y no añade una cuenta externa.

No se guardan cargas persistentes en el sistema de archivos del Web Service: los archivos de Render son efímeros salvo que se configure un disco persistente. [Documentación de Render](https://render.com/docs/disks).

Puedes consultar consumo agregado en el editor SQL de Aiven, sin mostrar datos personales:

```sql
select pg_size_pretty(pg_database_size(current_database())) as base_total;
select count(*) as fotos_perfil,
       pg_size_pretty(coalesce(sum(octet_length(bytes)),0)::bigint) as bytes_fotos_perfil
from profile_photos;
select count(*) as fotos_productos_y_espacios,
       pg_size_pretty(coalesce(sum(octet_length(bytes)),0)::bigint) as bytes_fotos_catalogo
from photos;
```

Las cifras de bytes de fotos no incluyen índices, versiones anteriores de filas pendientes de mantenimiento ni otros datos de la base. Estos SELECT no borran ni modifican registros.
