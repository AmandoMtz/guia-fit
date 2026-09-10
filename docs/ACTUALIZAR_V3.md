# Actualizar Guía FIT en GitHub y Render

Este ZIP parte del archivo `guia-fit-main.zip` que compartiste del repositorio `AmandoMtz/guia-fit`. Incluye web, servidor, Flutter, motores locales de lectura y las migraciones. No se han publicado cambios en tus servicios.

## 1. Copiar los cambios

1. Haz una copia de tu carpeta actual por si necesitas consultar archivos anteriores.
2. Extrae este ZIP en otra carpeta. Entra a `Guia_FIT`, donde está `package.json`.
3. Copia su contenido dentro de tu repositorio local existente, combinando carpetas y reemplazando archivos del proyecto.
4. Conserva la carpeta `.git`, tu `.env`, certificados, `flutter/config.local.json` y tus archivos de firma. El ZIP no incluye esos datos privados.

No reemplaces solo `web/dist`: también hay cambios en el servidor y en Flutter. No modifiques ni vuelvas a ejecutar manualmente las migraciones 001 y 002.

## 2. Verlo en tu terminal

Abre PowerShell en la carpeta del repositorio que contiene `package.json`:

```powershell
npm ci
npm start
```

Abre `http://localhost:3000`. Usa Node 22.16 o posterior dentro de las ramas 22, 23 o 24. `npm ci` instalará también el procesador de imágenes Sharp para tu sistema. No uses `--omit=optional`, ya que sus binarios son dependencias de plataforma.

Sin variables de base/correo puedes explorar la demostración. Para probar cuentas y fotos usa tu configuración `.env` existente. Si apunta a Aiven y `AUTO_MIGRATE=true`, iniciar el servidor aplicará la migración pendiente una sola vez. `docs/RENDER_AIVEN_GIT.md` conserva las instrucciones de conexión y certificado CA.

## 3. Actualizar GitHub

Detén el servidor con Ctrl+C y ejecuta:

```powershell
git status
git add .
git commit -m "Horarios FIT de 11 columnas, roles y fotos de perfil"
git push origin main
```

Comprueba en `git status` que no aparezcan credenciales ni certificados. El `.gitignore` los excluye. Utiliza tu rama habitual si no es `main`.

## 4. Render y Aiven

En el mismo Web Service de Render:

- Build Command: `npm ci --omit=dev`
- Start Command: `npm start`
- `AUTO_MIGRATE=true`
- Conserva `DATABASE_URL`, el certificado CA y las demás variables actuales.

Si está habilitado el despliegue automático, se publicará al recibir el commit; si no, usa **Manual Deploy → Deploy latest commit**. No crees otra base de datos.

El arranque registra la migración **003_profiles.sql**: agrega `profile_photos` y la pausa `food_vendors.is_active`. No borra usuarios, productos ni pedidos. Esta versión necesita esa migración antes de atender perfiles y Comidas. El sistema ya aplica y registra los SQL pendientes durante el arranque con `AUTO_MIGRATE=true`; si lo desactivaste, ejecuta una vez `npm run db:migrate` en un entorno con la configuración de tu base antes del despliegue.

No cambies el dominio durante esta actualización si quieres conservar los horarios locales. El almacenamiento del navegador depende del dominio y no viaja al servidor.

## 5. Comprobar el resultado

- En **Mi cuenta**, sube una foto y cambia una cuenta antigua a **Alumno vendedor**.
- En **Comidas**, completa el puesto. Un administrador debe aprobarlo con evidencia antes de publicarlo.
- Volver a **Alumno** oculta el puesto y bloquea nuevos pedidos. Los existentes se pueden terminar y el historial se conserva.
- En **Mi horario**, importa un PDF o imagen legible. Revisa la tabla de 11 columnas y confirma las clases. La app no ofrece conservar el original.
- Cierra sesión y entra con otra cuenta: no debe mostrar el horario ni la foto privada de la anterior.

Los originales locales de versiones anteriores se retiran al abrir el almacenamiento actualizado. En Flutter móvil, abre Mi horario en cada cuenta usada en ese dispositivo para retirar su copia antigua. No se borra el archivo que tú conserves en Descargas, Fotos, Drive o fuera de la app.

El ZIP incluye el wrapper de Gradle y ajusta `flutter/android/.gitignore` para conservarlo en GitHub; la descarga del repositorio no lo incluía.

Para Flutter: `cd flutter`, `flutter pub get` y sigue `docs/FLUTTER.md`. Las pruebas compartidas requieren conservar la carpeta `tests/fixtures` de la raíz.
