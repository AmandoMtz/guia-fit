# Castor Runner sin conexión

Esta actualización agrega un minijuego local para entretener a alumnos y docentes cuando se interrumpe la conexión. No necesita cambios en la base de datos ni servicios externos.

## Funcionamiento

- Al perder internet aparece un acceso flotante a **Castor Runner**.
- Los alumnos que entran al modo de consulta offline también encuentran el juego en el menú y en el aviso superior.
- En cuentas docentes el acceso aparece sobre la página que ya estaba abierta, sin depender del horario offline del alumno.
- El jugador salta con la barra espaciadora, flecha arriba, tecla `W` o tocando la pantalla.
- Incluye doble salto, velocidad progresiva, conos, libros, mochilas, charcos y estrellas coleccionables.
- El récord se conserva en el navegador mediante almacenamiento local y no se envía al servidor.
- El sonido puede silenciarse. El botón **Revisar conexión** regresa a Guía FIT cuando vuelve el internet.
- No entrega monedas, experiencia ni premios oficiales, evitando puntuaciones manipuladas fuera de línea.

## Prueba directa

Después de iniciar el proyecto, abre:

```text
http://localhost:3000/juego-castor.html
```

En el sitio desplegado puede usarse la misma ruta `/juego-castor.html`. Para comprobar la activación automática, abre Guía FIT con una cuenta y desactiva temporalmente el Wi-Fi o activa el modo sin conexión de las herramientas del navegador.

## Publicación

Desde la raíz del proyecto extraído, ejecuta en PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\ACTUALIZAR_GITHUB.ps1
```

La versión del caché offline fue incrementada para que los dispositivos descarguen los archivos del juego después del despliegue.
