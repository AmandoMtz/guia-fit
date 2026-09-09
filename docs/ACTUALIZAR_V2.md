# Actualizar tu Guía FIT en GitHub, Render y Aiven

Esta entrega parte del ZIP que compartiste y añade Comidas y Mi horario a web y Flutter. No se ha modificado tu repositorio remoto ni desplegado en tus cuentas.

## 1. Copiar la actualización a tu repositorio existente

1. Descomprime este ZIP en una carpeta nueva.
2. Haz una copia de respaldo de tu carpeta actual `Guia_FIT` si has hecho cambios adicionales.
3. Copia **el contenido de la carpeta `Guia_FIT` de este ZIP** dentro de la carpeta `Guia_FIT` que ya tiene tu repositorio Git. Acepta reemplazar archivos con el mismo nombre. No anides una carpeta `Guia_FIT` dentro de otra.
4. Conserva tu `.git`, `.env`, `certs/ca.pem`, `flutter/config.local.json` y configuración/firma local de Flutter. El ZIP no contiene secretos ni reemplaza esos archivos.

La migración original `001_initial.sql` permanece idéntica. Copia también la nueva `backend/migrations/002_food.sql` y las carpetas `web/dist/vendor/` y `flutter/web/vendor/`: contienen los lectores locales de PDF e imágenes.

## 2. Abrir localmente

En PowerShell, desde tu carpeta del repositorio, donde aparece `package.json`:

```powershell
npm ci
npm start
```

Abre [Guía FIT local](http://localhost:3000). No abras `index.html` con doble clic para probar la importación: los motores necesitan HTTP/HTTPS. Detén el servidor con Ctrl+C cuando termines.

Sin `DATABASE_URL`, puedes ver la demostración. Para probar vendedores y guardar horarios debes iniciar sesión con tu backend configurado; el horario no se envía a ese backend.

## 3. Subir al mismo GitHub

```powershell
git status
git add .
git commit -m "Agrega Comidas y horario personal con OCR local"
git push origin main
```

No necesitas crear otro repositorio ni ejecutar `git init`. Usa la carpeta que ya está conectada a `AmandoMtz/guia-fit`. Si `git status` muestra cambios tuyos ajenos a esta entrega, revísalos antes de confirmar.

## 4. Render y Aiven

Mantén el servicio Node actual, con su repositorio y rama `main`:

| Ajuste                     | Valor                                    |
| -------------------------- | ---------------------------------------- |
| Build Command              | `npm ci --omit=dev`                      |
| Start Command              | `npm start`                              |
| Health Check               | `/api/health`                            |
| AUTO_MIGRATE               | `true`                                   |
| DATABASE_URL y CA de Aiven | Conserva los valores que ya configuraste |
| Correo y SITE_URL          | Conserva tu configuración vigente        |

Con despliegue automático activado, Render despliega después del push. Si está desactivado, usa **Manual Deploy → Deploy latest commit** en el servicio. [Documentación oficial de despliegues de Render](https://render.com/docs/deploys).

Al arrancar, el servidor aplica `002_food.sql` una sola vez. Añade puestos, productos, pedidos, avisos y el indicador de interés en vender. **No borres ni recrees la base de Aiven.** Si elegiste `AUTO_MIGRATE=false`, ejecuta `npm run db:migrate` en un entorno con tus variables de Aiven antes de iniciar esta versión.

No se necesitan variables nuevas, servicios de almacenamiento, claves de OCR ni otra base. Las fotografías de productos quedan en Aiven; los horarios y sus originales opcionales quedan en el dispositivo del alumno.

## 5. Activar vendedores y probar el recorrido

1. Un usuario confirmado entra en **Comidas → Quiero vender**, completa su puesto y prepara un producto.
2. La cuenta administradora abre **Vendedores** y revisa su pertenencia a la facultad y autorización para vender, anotando una fuente y fecha comprobables.
3. Al aprobarlo, los productos disponibles aparecen en el catálogo. Si necesitas configurar tu primera cuenta administradora, utiliza el procedimiento existente de `RENDER_AIVEN_GIT.md`.
4. Desde otra cuenta, solicita un producto. En la cuenta del vendedor aparecerá en **Mi puesto → Pedidos recibidos** y en la campana.
5. El vendedor puede aceptar, marcar listo y marcar entregado. El comprador recibe los cambios en Avisos.

Para probar el horario, importa una foto legible o un PDF, revisa los datos y guarda. Recarga la página: debe aparecer la tabla. Cierra sesión e inicia otra cuenta: esa cuenta tendrá su propio horario. Cambiar de dominio, navegador o dispositivo abre un almacenamiento local diferente; no hay sincronización entre ellos.

## Flutter actualizado

Desde `flutter/`, conserva tu `config.local.json` y ejecuta:

```powershell
flutter pub get
flutter run --dart-define-from-file=config.local.json
```

En celular, **Más** abre mapa, recorridos, cuenta y avisos. Para compilar Android/iOS, revisa `FLUTTER.md`; el OCR exige iOS 15.5 o posterior. Esta entrega incluye fuentes, no APK/IPA firmado.
