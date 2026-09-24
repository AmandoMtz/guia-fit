# Actualización de verificaciones administrativas

Esta entrega no agrega migraciones ni cambia la estructura de la base de datos. Al desplegarla se conservan las cuentas, mensajes, puestos, productos, pedidos, horarios y demás registros existentes.

## Cambios visibles

- Los chats académicos muestran únicamente que los mensajes están disponibles durante siete días.
- Los chats de Comidas muestran únicamente su duración de doce horas.
- La cuenta administradora dispone de **Verificar cuentas**, con búsqueda, conteo de pendientes y aprobación directa junto a cada cuenta.
- La verificación de una cuenta exige correo confirmado, una fuente institucional y la confirmación de que se revisaron sus datos.
- **Verificar comidas** muestra cuántos puestos esperan revisión y permite aprobarlos, solicitar correcciones o suspenderlos.
- Los espacios y recorridos se verifican desde **Administrar**; los dispositivos de asistencia se autorizan desde el panel administrativo de **Mi cuenta**.

## Publicación

Desde la raíz del proyecto extraído, abre PowerShell y ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\ACTUALIZAR_GITHUB.ps1
```

El script clona la rama `main`, copia esta versión sin incluir `.env` ni dependencias locales, crea el commit y lo envía a GitHub. Si Render está conectado al repositorio, el despliegue comenzará automáticamente.
