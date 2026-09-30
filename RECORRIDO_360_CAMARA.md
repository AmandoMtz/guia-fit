# Mapa expandible, recorrido 360° y cámara de referencia

## Uso
- En el mapa pulsa **Pantalla completa**. Arrastra para girar 360°; al acercar, el arrastre desplaza el plano. También puedes usar los botones de giro.
- Selecciona un edificio y pulsa **Expandir recorrido**. Arrastra para mirar alrededor; usa los botones para caminar. En B, C y cafetería puedes mantener pulsado un control. En PC también funcionan WASD y flechas.
- Puedes elegir planta y salón dentro de la vista expandida. **Salir** o Escape devuelve el tamaño normal.
- En navegadores que no permiten pantalla completa nativa, la vista utiliza toda el área disponible del navegador. Sus barras pueden permanecer visibles.
- Para la cámara: selecciona primero el edificio, planta y salón; pulsa **Cámara de referencia** y acepta el permiso. Muestra el entorno y tu destino seleccionado. **Apagar cámara** vuelve al recorrido. Para cambiar destino, apágala y selecciona otro salón.

## Qué hace la cámara
Preferencia por cámara trasera, sin audio, grabación ni envío de video. Se detiene al cerrar, cambiar de destino, ocultar la pestaña o salir de la página. Si niegas permiso o no hay cámara, muestra un aviso y conserva la salida al recorrido.
Requiere HTTPS (o localhost para desarrollo), cámara y navegador compatible. Referencia técnica: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

## Límite de orientación
Es una cámara de referencia, no navegación con realidad aumentada ni detección automática del salón. El archivo recibido no contiene una red de rutas interiores verificada ni coordenadas de puertas. No se inventaron flechas o instrucciones físicas. El modelo virtual conserva sus distancias aproximadas y no se mueve con tus pasos reales. Para navegación real hace falta levantar rutas, plantas y puntos de referencia, por ejemplo QR de ubicación en cada acceso.

## Actualización
Extrae el ZIP completo. Dentro de guia-fit-main ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1

Requiere Git para Windows, identidad Git configurada y acceso al repositorio AmandoMtz/guia-fit. Crea una copia temporal, comprueba que los archivos remotos correspondan a la versión recibida o a esta actualización, copia sólo los archivos enumerados, crea un commit y hace push sin force. Ante cambios distintos se detiene antes de copiar; conserva el clon temporal para revisión. No modifica la base de datos. El despliegue depende de tu configuración en Render.
Después del despliegue recarga el sitio; se cambió la versión de los recursos y de la caché.

## Validación
23 pruebas automatizadas aprobadas: mapa, caché, movimiento, colisiones, plantas, conexión B–C/cafetería y ciclo de permisos/cierre de cámara. Sintaxis JavaScript comprobada.
No se pudo hacer inspección visual con navegador ejecutable: su descarga falló en este entorno. No se ejecutó el script PowerShell ni se publicó a GitHub. Pendiente comprobar en Android/iPhone y PC reales: vertical/horizontal, salida nativa y alternativa, permisos y tamaño de controles.
