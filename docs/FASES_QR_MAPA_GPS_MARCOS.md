# Entregas, mapa, ubicación y marcos

## Entregas QR
El vendedor abre «Mostrar QR de entrega» cuando el pedido está listo. El comprador abre «Escanear entrega», escanea o pega el código y confirma que recibió su compra. El QR dura cinco minutos y solo puede usarlo el comprador del pedido una vez. El vendedor puede renovarlo. Se conserva la finalización manual anterior. En navegadores sin lector BarcodeDetector se ofrece el código manual. La cámara requiere HTTPS y permiso.

## Edificios B y C
| Edificio | Planta baja | Planta alta |
| --- | --- | --- |
| B | 101–115 | 401–412 |
| C | 201–213 | 301–315 |

El mapa abre un recorrido en primera persona al seleccionar un edificio. Se puede avanzar, retroceder, mirar arrastrando y usar flechas o WASD. Las plantas son seleccionables; pulsar un salón sitúa la cámara frente a su puerta. Los edificios sin salones registrados muestran un interior genérico sin inventar numeración. La distribución física, puertas y escaleras son ilustrativas: necesitan validación en sitio. Los rangos son los facilitados por el administrador.

## Ubicación exterior
En «Cómo llegar» se activa voluntariamente la ubicación. Se muestra la posición, precisión y destino sobre cartografía OpenStreetMap, con enlace de indicaciones a pie en Google Maps. La referencia general 22.277055, -97.864674 procede del enlace de mapa de https://fiuat.mx/contacto/; no representa una entrada verificada.

Para registrar un acceso real, un administrador debe situarse allí, seleccionar el edificio y guardar una lectura reciente (hasta 30 segundos) con precisión de 25 metros o mejor. Sin acceso registrado, las indicaciones llevan a la facultad. El GPS no identifica salón ni planta; el modelo interior sirve como referencia. La ubicación personal no se guarda. No se ha realizado una prueba física dentro del campus.

## Marcos
Se completaron los diseños festivos del catálogo y se añadieron celebraciones mexicanas. Cada marco animado utiliza seis partículas. Se mantiene el editor administrativo y la vista previa. Los efectos quedan contenidos en el avatar para evitar partículas sueltas durante el desplazamiento.

## Actualización
Extraer el ZIP y ejecutar desde la carpeta con package.json:

```powershell
powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_FASES_GITHUB.ps1
```

El script clona el repositorio, copia esta versión y sube un commit. Requiere Git y acceso de escritura a AmandoMtz/guia-fit. Si hubo cambios posteriores a esta copia del proyecto, revisar antes de ejecutarlo para evitar reemplazarlos. No elimina archivos remotos ausentes del ZIP.

Las migraciones 019 y 020 agregan la caducidad del QR y los accesos geográficos. Se ejecutan al arrancar el servidor salvo AUTO_MIGRATE=false; en ese caso ejecutar npm run db:migrate. Los recursos nuevos incluyen actualización de caché del service worker.

## Verificación
169 pruebas automáticas correctas. Chromium: vista previa/editor a 390 y 1280 px, mapa B superior con 12 salones y selección del 412 en ambos tamaños; juego disponible en contexto sin conexión. La ubicación se verificó con datos simulados. Queda pendiente comprobar cámara y GPS con dispositivos físicos en el campus. Los cambios no se han publicado desde este entorno.

Actualización del recorrido: verificados desplazamiento, giro por teclado, selección de salón y presentación a 390 y 1280 px. Las 12 pruebas de mapa y fases pasan tras adaptar la prueba de Posgrado a la nueva interfaz.
