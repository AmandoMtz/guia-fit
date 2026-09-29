# Recorrido POV: una fila por planta

Edificio B: planta baja 101–115; planta alta 401–412.
Edificio C: planta baja 201–213; planta alta 301–315.

Cada edificio tiene un bloque con dos plantas y una fila consecutiva de salones en cada una. Al avanzar de menor a mayor los salones quedan a la izquierda. Pulsa Dar la vuelta y avanza para volver del mayor al menor, con los salones a la derecha. Retroceder camina hacia atrás sin girar la vista.

Arrastra para mirar; mantén W/S o los botones para caminar, A/D para desplazarte lateralmente. Las flechas izquierda/derecha giran. Seleccionar un salón te sitúa un poco antes de su puerta, mirando hacia los números mayores. El selector de planta cambia la altura de la cámara y los números disponibles. El corredor superior tiene barandal y la vista al patio está abierta. Las columnas, jardineras y palmeras se inspiran en la foto; las medidas son aproximadas. No se simulan escaleras ni seguimiento GPS.

Validación: 13 pruebas aprobadas, incluidas las cuatro series de números, su orden, el retorno y los límites. Sin comprobación visual en navegador en este entorno.

Para subir los cambios, extrae este ZIP, abre PowerShell dentro de guia-fit-main y ejecuta:

    powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_RECORRIDO_GITHUB.ps1
