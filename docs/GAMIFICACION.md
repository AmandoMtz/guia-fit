# Progreso, premios y ranking FIT

En la web, abre **Mi progreso y premios**. Disponible para alumnos y docentes por la clasificación institucional del correo que ya usa la aplicación; administradores también pueden utilizarlo. Las cuentas externas no reciben acceso a esta sección. No exige una aprobación institucional distinta de las reglas actuales de acceso.

## Recompensas

| Actividad | EXP | Límite |
| --- | ---: | --- |
| Entrar con sesión iniciada | 10 | Una vez al día, incluidos fines de semana |
| Entrar de lunes a viernes | 50 adicionales | Una vez por semana completa |
| Guardar el primer horario válido | 30 | Una vez por cuenta |
| Asistencia registrada mediante QR | 40 | Una vez por evento |
| Recibir una valoración de un pedido entregado | 10 | Máximo 5 recompensas diarias y una por comprador por semana |

Las fechas se calculan en el servidor con la zona de Tampico (`America/Monterrey`); la semana comienza el lunes. Una sesión abierta y visible se comprueba cada cinco minutos y cuando vuelve al primer plano. Las visitas anteriores a esta actualización no se reconstruyen. Las asistencias que ya estén registradas sí se reconocen una sola vez al sincronizar. Los horarios locales existentes se reconocen al abrir Mi progreso; los nuevos guardados se notifican al servidor.

Nivel inicial: 1. Cada 100 EXP se gana un nivel y 50 monedas. Canjear no reduce la EXP ni el nivel. Los artículos son permanentes, pueden quitarse y volver a equiparse sin pagar otra vez. No existe compra de monedas con dinero real.

## Personalizaciones

- Tres marcos de perfil: Rubí, Honor y Órbita Castor.
- Dos marcos para chats de pedidos y Castor FIT.
- Dos fondos para el chatbot.
- Dos animaciones de entrada de mensajes.
- Interruptor para desactivar las animaciones de estos artículos. También se respeta movimiento reducido del dispositivo.

Los estilos se guardan en la cuenta, se aplican a la vista del propietario y se limpian al cerrar sesión. No alteran imágenes de terceros ni la duración de doce horas de los chats de pedidos. Esta actualización integra la experiencia en la **web**; no añade pantallas nuevas a Flutter.

## Valoraciones y ranking

En Mis valoraciones aparecen hasta los 100 pedidos entregados más recientes. Solo su comprador puede calificarlos, de 1 a 5 estrellas, una vez por pedido. No se permite calificar el puesto propio ni modificar una opinión enviada. La experiencia recibida no depende de que la nota sea positiva: así no se incentiva premiar únicamente las reseñas de cinco estrellas.

El vendedor configura sus categorías en Mis valoraciones: comida, postres, botanas, bebidas y otros. Los puestos existentes comienzan en comida. Cada opinión pertenece a una categoría elegida entre las del puesto; el ranking por categoría usa esas opiniones. Cambiar las categorías no cambia las opiniones históricas.

Solo aparecen puestos aprobados y activos. Orden: puestos con valoraciones primero, puntuación ajustada, cantidad de opiniones, nombre e identificador. La puntuación usa `(suma de estrellas + 15) / (número de opiniones + 5)`, equivalente a cinco opiniones de referencia de 3 estrellas. Se muestra también el promedio real. No es una garantía contra acuerdos entre cuentas: los límites reducen el incentivo a generar EXP artificial, pero no sustituyen revisión administrativa de actividad sospechosa.

## Integridad

El servidor controla cantidades, precios, propiedad, sesión y pedidos. Recompensas con claves únicas; canjes y valoraciones dentro de transacciones, con bloqueos de filas. No se aceptan puntos o saldos indicados por el navegador. El horario sigue almacenado en el dispositivo; para su recompensa el servidor valida la estructura de materias y horas, no puede certificar que sea un horario oficial.

## Instalar

1. Descomprime el ZIP y abre PowerShell dentro de `guia-fit-main`.
2. Ejecuta `powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_GAMIFICACION.ps1`.
3. El script clona `main`, copia únicamente los archivos de la actualización, instala dependencias, ejecuta las pruebas y sube un commit. No copia `.env` ni claves.
4. Espera el despliegue en Render. Al arrancar se aplica la nueva migración `007_gamification.sql` si `AUTO_MIGRATE` no está en `false` (comportamiento predeterminado). Si lo desactivaste, ejecuta `npm run db:migrate` con las variables de tu servidor antes de iniciar esta versión.
5. Recarga con Ctrl+F5 y entra con una cuenta institucional. Abre Mi progreso y premios.

No requiere nuevas claves ni dependencias de producción. No se modificaron las migraciones anteriores.

## Verificación

99 pruebas del proyecto aprobadas, incluidas las nuevas de idempotencia, límites de EXP, compras concurrentes, propiedad, categorías y valoraciones. Comprobación del DOM: navegación de progreso, tienda, canje, equipamiento, ranking, valoraciones y limpieza al cerrar sesión.

Revisión en Chromium con datos de prueba: pantallas de progreso y tienda en escritorio y móvil, navegación al ranking sin errores de JavaScript y sin desbordamiento horizontal a 390 px.
