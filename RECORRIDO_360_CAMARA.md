# Recorrido rojo: joystick, giro del celular y AR

## Recorrido virtual
1. Selecciona edificio, planta y salón.
2. Pulsa Expandir recorrido. Se intenta activar el giro del celular: acepta el permiso de movimiento si aparece. También puedes activarlo con el botón.
3. Mueve el celular para mirar alrededor. El joystick mueve la posición hacia adelante, atrás o a los lados, con velocidad proporcional. Al soltar se detiene.
4. Recentrar mirada alinea el sensor con la vista actual. Arrastrar sobre la escena cambia a mirada manual. Puedes reactivar el giro después.
5. En PC se conservan WASD y flechas, y puedes arrastrar el joystick con el mouse. Salir o Escape restaura la página.

La pantalla completa tiene alternativa dentro del navegador cuando la nativa no está disponible. En ese caso las barras del navegador pueden seguir visibles. La interfaz inmersiva utiliza rojo y blanco; se oculta el chatbot mientras está abierta para no tapar controles.

## Caminar físicamente con el teléfono
El nuevo modo usa WebXR para seguir el desplazamiento REAL relativo del teléfono. No cuenta pasos artificiales ni mueve el mapa por el mero hecho de abrir la cámara.

1. Estando en la facultad, elige en el modelo tu ubicación ACTUAL, no el salón al que quieres llegar. Ajusta la posición con joystick si hace falta. Selecciona manualmente la planta.
2. Orienta la vista virtual y el teléfono en la misma dirección. Es una alineación manual necesaria: el mapa no está georreferenciado y las dimensiones son aproximadas.
3. Abre Cámara / caminar con AR. El esquema muestra la posición del recorrido.
4. Confirma la casilla del origen y pulsa Seguir mis pasos con AR. Acepta el permiso.
5. En el origen y mirando en la dirección acordada, pulsa Confirmar origen. Al caminar, AR actualiza tu posición relativa y la flecha del esquema. Al volver al recorrido se conserva esa posición.
6. Si pierde seguimiento o detecta un salto, deja de mover la posición y pide volver al origen y recalibrar. No recalibres desde un lugar distinto del origen inicial. Para cambiar origen, cierra la cámara y selecciona otra posición.

El video ordinario se detiene antes de entregar la cámara a WebXR. Durante AR se usa la vista del mundo real que ofrece el sistema; no se graba ni se envía video desde la aplicación. Al cerrar, cambiar de vista u ocultar la pestaña se detienen los controles y la sesión AR.

## Compatibilidad y límites
- HTTPS y permisos son necesarios para cámara/sensores/AR.
- El giro requiere sensores de orientación disponibles. Si no hay datos o se deniega permiso, conserva arrastre y joystick.
- Caminar físicamente requiere WebXR immersive-ar, referencia local y dom-overlay en un dispositivo con seguimiento espacial. La disponibilidad depende del teléfono, navegador y sistema; no se garantiza en iPhone ni en todos los Android. Si no está disponible se indica expresamente y NO se simula que tu posición se está siguiendo.
- La ubicación es RELATIVA a tu origen y orientación manuales. No detecta automáticamente edificio, salón ni planta; no calcula rutas, no tiene GPS interior ni ofrece navegación exacta. La escala del modelo es ilustrativa, por lo que puede desviarse al recorrer distancias. El modo AR mantiene la planta seleccionada.
- No hay flechas de ruta sobre el suelo. El indicador aparece en el esquema de B/C/cafetería o del pasillo ilustrativo correspondiente.

Referencias técnicas:
https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Spatial_tracking
https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession

## Actualizar GitHub
Extrae el ZIP, entra en guia-fit-main y ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1

El script admite como base la entrega anterior de pantalla completa o el ZIP original recibido. Compara hashes de los archivos indicados y se detiene ante cambios diferentes para no sobrescribirlos. Necesita Git, identidad Git y acceso al repositorio AmandoMtz/guia-fit. No usa push --force ni cambia la base de datos. El despliegue depende de tu configuración en Render. Se actualizan los identificadores de caché.

## Validación
33 pruebas automatizadas aprobadas: mapa, caché, movimiento, colisiones, plantas, permisos, cancelación, joystick, transformación de orientación, conversión de coordenadas AR y cierre de sesiones pendientes.
La prueba de navegador del proyecto se actualizó para usar joystick y capturar la vista expandida, pero no se pudo ejecutar aquí porque no hay navegador instalado y la descarga falló. No se probó en hardware con sensores/cámara/AR ni se ejecutó PowerShell ni se publicó. El seguimiento AR debe validarse en un teléfono compatible en el campus antes de presentarlo como navegación operativa.
