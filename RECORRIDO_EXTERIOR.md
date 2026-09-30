# POV basado en los videos de la Facultad

## Numeraciones conservadas
- Edificio B: planta baja 101–115; planta alta 401–412.
- Edificio C: planta baja 201–213; planta alta 301–315.

El plano general y sus identificadores se conservan. El POV representa B y C como bloques paralelos. Las referencias muestran arquitectura y acabados, pero no permiten medir con exactitud el conjunto: distancias, ubicación del mobiliario, conexiones y acceso de biblioteca son aproximados. Se respetan los rangos solicitados aunque el letrero de la foto tenga diferencias.

## Cambios
- Muros rojizos con juntas de ladrillo, columnas claras, ventanas altas con marcos, loseta, luminarias y barandales.
- Patio con palmeras, árboles, arbustos, bordes de piedra, jardineras, bancas, luminarias, señalética y contenedores.
- Cafetería con franja naranja/gris, ventanillas, entrada y mostrador; mesas redondas y velarias en el exterior. El interior es ilustrativo porque no se muestra completo en los videos.
- Detalle del acceso de biblioteca y bebedero inspirado en las fotos, sin quitar ni renumerar salones.
- Recorrido continuo entre B, C, patio y cafetería; conexiones en ambas plantas y escaleras en dos tramos con descanso.
- Sin personas ni fotografías de personas incorporadas al sitio.

## Uso
Selecciona B, C o Cafetería para iniciar el POV. Arrastra para mirar. W/S o Avanzar/Retroceder para caminar; A/D para movimiento lateral. Las flechas izquierda/derecha giran. Dar la vuelta cambia el sentido: de menor a mayor los salones están a la izquierda; al regresar quedan a la derecha.

En los extremos se encuentran las conexiones y las escaleras. En planta baja puedes salir entre columnas al patio. Para ir a la cafetería desde B, continúa hasta el extremo de los números mayores, rodea la escalera por el lado de B y sigue hacia las mesas. Su acceso está centrado en la fachada. Los accesos rápidos de salón corresponden al edificio/planta seleccionados y vuelven a esa planta.

## Visión, movimiento y límites
WebGL con profundidad, rótulos dentro de la escena, mipmaps, juntas suavizadas a distancia y superficies separadas. Pisos y techos ocultan las otras plantas. El movimiento se divide en pasos pequeños para evitar atravesar obstáculos. Hay límites de zona, barreras de muros, columnas, jardineras, bancas, árboles, fachada y mostrador. Los barandales superiores bloquean salir al patio. La animación se pausa al perder foco y los recursos gráficos se liberan al cambiar de vista.

Requiere WebGL/aceleración gráfica. Si no está disponible se muestra un aviso.

## Comprobación
18 pruebas automatizadas aprobadas: mapa, caché, rangos originales, dirección, plantas, cruce B–C, subida/bajada, cafetería, obstáculos, bordes y camino continuo B–cafetería.

Se compilaron y renderizaron los shaders y la geometría final mediante OpenGL ES/EGL sin errores gráficos. Se inspeccionaron seis vistas (carpeta PREVIAS_POV). Estas vistas son renders de la escena, no capturas del sitio en un navegador. No estuvo disponible un navegador ejecutable en el entorno: queda pendiente la comprobación completa del sitio en PC y móvil. No se garantiza ausencia de fallos en todos los dispositivos.

## Aplicar cambios
1. Extrae el ZIP.
2. Abre PowerShell dentro de guia-fit-main.
3. Ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1

Requiere Git y acceso a AmandoMtz/guia-fit. El script crea una copia temporal del repositorio, copia solamente los archivos del mapa indicados, crea un commit y lo sube. No sube los videos de referencia ni modifica la base de datos. Al terminar el despliegue, recarga la página con Ctrl+F5.
