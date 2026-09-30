# Recorrido conectado B–C

Una fila por planta. B: 101–115 abajo y 401–412 arriba. C: 201–213 abajo y 301–315 arriba. De menor a mayor quedan a la izquierda; Dar la vuelta permite regresar con ellos a la derecha.

Camina hasta cualquiera de los extremos para encontrar las conexiones entre edificios. Hay un camino abajo y una pasarela arriba. Las escaleras adyacentes ascienden de izquierda a derecha; recórrelas al revés para bajar. La cámara cambia de altura al caminar. Los botones de salón siguen siendo accesos rápidos del edificio/planta seleccionados.

Se añadieron bancas, luminarias, palmeras, jardineras, andadores y un edificio de fondo. La distribución de las conexiones y sus medidas es ilustrativa y no un levantamiento arquitectónico.

Se sustituyó el dibujo por orden de polígonos por WebGL con buffer de profundidad: pisos, techos y muros ocultan correctamente lo que está detrás. Se requiere WebGL/aceleración gráfica. Si no está disponible se muestra un aviso.

Validación: 14 pruebas automatizadas del mapa y navegación aprobadas, incluyendo cruce B–C en ambas plantas y subida/bajada. La instalación del navegador no estuvo disponible; queda pendiente verificar visualmente WebGL en PC y móvil.

Extrae este ZIP y desde PowerShell dentro de guia-fit-main ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1
