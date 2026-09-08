# Publicar con Render, Aiven y Git

La raíz de este proyecto contiene `package.json` y `render.yaml`. Render sirve la web y la API desde el mismo dominio; la API es la única que conoce la contraseña de Aiven. Flutter se conecta por HTTPS a Render.

## 1. Crear PostgreSQL en Aiven

1. En tu cuenta de Aiven, crea un servicio **PostgreSQL**. Elige el plan y región según tu uso; no es necesario crear otra base en Render.
2. Copia la **Service URI** PostgreSQL de la información de conexión. Es privada e incluye usuario, contraseña, host, puerto y base. Usa la URI que proporciona Aiven para preservar la codificación de caracteres de la contraseña.
3. Descarga el certificado **CA** del servicio. El servidor verifica ese certificado; no desactives TLS ni uses `rejectUnauthorized: false`.
4. Si aplicas restricciones de red en Aiven, permite la salida de tu servicio de Render según los rangos que muestre su panel. Para administrar desde tu equipo, permite también tu conexión.
5. Puedes usar la base y usuario que creaste para esta aplicación, con permiso para crear y modificar las tablas del esquema `public`. Usa una base dedicada a este proyecto.

Al arrancar, el servidor aplica `backend/migrations/001_initial.sql` y después el catálogo de `backend/02_catalog.sql`. Registra las migraciones aplicadas, usa bloqueo para evitar ejecuciones simultáneas y no sobrescribe los espacios editados. No necesitas pegar manualmente esos archivos en el panel. Para cambios futuros, crea otro archivo numerado de migración: no edites una migración que ya fue aplicada.

## 2. Preparar los correos de verificación

El proyecto incluye **Resend por HTTPS**, para confirmación y recuperación. Necesitas una cuenta del proveedor, una clave API y un remitente autorizado.

1. En Resend, agrega y verifica un dominio que controles mediante sus registros DNS. No uses un dominio institucional si no tienes autorización para administrarlo.
2. Crea una clave para enviar correo y guárdala como `RESEND_API_KEY`.
3. Define `MAIL_FROM`, por ejemplo `Guía FIT <acceso@tu-dominio.mx>`, con el remitente permitido por el proveedor.
4. Para pruebas con restricciones del proveedor, utiliza destinatarios autorizados. Para registrar usuarios reales, termina la verificación del dominio.

También existe integración SMTP opcional mediante `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD`. Si configuras Resend, tiene prioridad. El Blueprint usa HTTPS: el plan gratuito de Render bloquea los puertos SMTP comunes. Sin un envío de correo configurado, el servidor bloquea el registro de cuentas.

## 3. Subir el proyecto usando Git

Crea un repositorio vacío en GitHub. Desde la carpeta que contiene este README:

```bash
git init -b main
git add .
git commit -m "Proyecto inicial Guia FIT Render Aiven Flutter"
git remote add origin https://github.com/TU_USUARIO/guia-fit.git
git push -u origin main
```

Sustituye la URL por la de tu repositorio y autentícate con tu método habitual de GitHub. No se proporciona ni necesita un token dentro del proyecto. Si Git pide identidad, configura tu propio nombre y correo con `git config user.name` y `git config user.email` antes del commit.

`.gitignore` excluye credenciales locales, certificados, dependencias, compilaciones y claves de firma. Antes de cada commit, revisa `git status`. El workflow `.github/workflows/validate.yml` ejecuta pruebas de Node y Flutter en GitHub Actions. Render está configurado para desplegar al recibir commits; el workflow no configura por sí mismo una regla que bloquee despliegues fallidos. Puedes activar tus reglas de rama y espera a CI en los ajustes del repositorio/servicio.

## 4. Crear el servicio en Render

1. Conecta tu repositorio de GitHub en Render y elige **New → Blueprint**.
2. Selecciona el repositorio y la rama `main`. Render leerá `render.yaml` desde la raíz.
3. Completa estas variables privadas cuando las solicite:

| Variable | Contenido |
|---|---|
| `DATABASE_URL` | Service URI PostgreSQL de Aiven |
| `AIVEN_CA_CERT` | Certificado CA completo, incluyendo BEGIN/END CERTIFICATE |
| `RESEND_API_KEY` | Clave de envío de correo |
| `MAIL_FROM` | Remitente autorizado |

`AIVEN_CA_CERT` admite saltos de línea reales o la secuencia literal `\n`. No pegues comillas adicionales. Como alternativa, usa un Secret File de Render y define `AIVEN_CA_PATH` con su ruta absoluta, por ejemplo `/etc/secrets/ca.pem`.

El Blueprint establece `NODE_ENV=production`, Node 22, `AUTO_MIGRATE=true`, construcción `npm ci --omit=dev`, inicio `npm start` y revisión `/api/health`. Usa la raíz del repositorio como Root Directory. Es un **Web Service Node**, porque incluye la API.

4. Inicia el despliegue. El servidor usa `PORT` y `0.0.0.0`, y toma automáticamente `RENDER_EXTERNAL_URL` como dirección pública.
5. Si después utilizas un dominio propio, define `SITE_URL=https://tu-dominio.mx` y vuelve a desplegar. Esto controla enlaces del correo y origen autorizado para las cookies.
6. Comprueba `https://TU-SERVICIO.onrender.com/api/health`: debe devolver `{"status":"ok"}`. `demo` indica que falta `DATABASE_URL`.
7. Regístrate con un correo al que tengas acceso, abre el enlace de confirmación e inicia sesión. Prueba recuperación y cierre de sesión.

El plan `free` del archivo permite evaluar el proyecto y puede suspender el servicio por inactividad. Al reactivarse, Flutter puede necesitar reintentar la conexión. Para servicio institucional continuo, elige en tu panel un plan adecuado y configura respaldos de Aiven. Los datos, sesiones y fotos se guardan en PostgreSQL y no dependen del disco temporal de Render.

## 5. Habilitar el primer administrador

Primero registra y confirma una cuenta normal. Desde tu equipo, copia `.env.example` a `.env`, configura **la misma base de Aiven** y su certificado CA (puedes usar `AIVEN_CA_PATH=./certs/ca.pem`) y ejecuta:

```bash
npm ci
npm run admin -- tu-correo-confirmado@tu-dominio.mx
```

Este comando usa los permisos del propietario de la base para promover la cuenta indicada. No existe una contraseña de administrador predeterminada ni un campo público que conceda ese rol. Cierra e inicia sesión y aparecerá **Administrar** en la web.

Para validar pertenencia institucional: solicita al usuario su identificador de **Mi cuenta**, consulta su perfil en el panel, contrasta nombre/matrícula con una fuente autorizada de la facultad y registra la referencia. El correo confirmado no reemplaza este proceso. La referencia debe describir la fuente de revisión, sin copiar documentos personales completos.

## 6. Conectar Flutter

En `flutter/config.local.json`, coloca solo:

```json
{"API_BASE_URL":"https://TU-SERVICIO.onrender.com"}
```

La app no recibe credenciales PostgreSQL ni claves de correo. Ejecuta los pasos de `FLUTTER.md`. Las cuentas, verificaciones, fotos y rutas serán las mismas en la web y el teléfono.

## Si algo falla

| Síntoma | Revisión |
|---|---|
| No inicia el servicio | URI, puerto Aiven, certificado CA y permisos de migración |
| Correo no llega | Remitente/dominio verificado, restricciones de destinatarios, clave y panel del proveedor |
| Dice que el registro no está habilitado | Configuración de base y de correo; reinicia el servicio tras modificar variables |
| Perfil sin rutas | Registra y verifica puntos y tramos; el catálogo inicial no inventa recorridos |
| Flutter no conecta | URL HTTPS sin `/api` al final; arranque del servicio tras inactividad |
| Error de origen en web | `SITE_URL` debe coincidir con el dominio que abres |

## Referencias oficiales

- [Render: desplegar Node y Express](https://render.com/docs/deploy-node-express-app).
- [Render: especificación Blueprint](https://render.com/docs/blueprint-spec).
- [Render: características y límites del plan gratuito](https://render.com/docs/free).
- [Aiven: conexión PostgreSQL desde Node con certificado CA](https://aiven.io/docs/products/postgresql/howto/connect-node).
- [Resend: API de envío de correos](https://resend.com/docs/api-reference/emails/send-email).
