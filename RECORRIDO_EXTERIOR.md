# Recorrido exterior de salones

Selecciona Edificio B o C. Arrastra la vista para mirar. Mantén Avanzar/Retroceder o W/S; A/D mueve de lado. Las flechas izquierda/derecha giran. Rodea los extremos de las hileras para pasar a otra. El minimapa señala tu posición virtual. Los botones de salón te colocan frente a su puerta.

Se representan cuatro hileras por planta seleccionada, con corredores abiertos, barandales blancos, puertas color guinda y vegetación. La distribución entre hileras es provisional: la fotografía no establece el orden real de todos los salones. Cambiar de planta carga sus números; no se simulan escaleras. No incluye realidad aumentada, seguimiento GPS interior ni compatibilidad con visores VR.

Validación: 12 pruebas automatizadas aprobadas. No se realizó verificación visual en navegador por falta del ejecutable de Chromium en el entorno.

Para actualizar GitHub desde PowerShell, extrae el ZIP, entra a guia-fit-main y ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1

El script copia únicamente los archivos del mapa modificados sobre una copia nueva del repositorio y los sube a GitHub. Requiere Git instalado y acceso al repositorio.
