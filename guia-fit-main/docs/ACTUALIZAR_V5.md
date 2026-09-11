# Actualizar a Guía FIT 5 · Docentes y eventos

Esta entrega es **aditiva**: conserva usuarios, puestos, productos, pedidos, chats temporales y horarios locales. Agrega la migración `004_events.sql` para carreras de perfil, eventos, invitaciones, QR, asistencias y códigos de validación de PDF.

## 1. Haz respaldo antes de copiar

En PowerShell puedes conservar una copia exacta de tu carpeta actual:

```powershell
$repo = "C:\Users\elnoo\Downloads\Guia_FIT_Render_Aiven_Flutter\Guia_FIT"
$backup = "C:\Users\elnoo\Downloads\Guia_FIT_RESPALDO_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path $repo -Destination $backup -Recurse
```

## 2. Sustituye el código sin borrar `.git`

Descomprime este ZIP en una carpeta temporal y copia sus archivos encima de tu repositorio. **No reemplaces ni borres `.git`**.

Ejemplo si el ZIP se llama `Guia_FIT_docentes_eventos.zip`:

```powershell
$repo = "C:\Users\elnoo\Downloads\Guia_FIT_Render_Aiven_Flutter\Guia_FIT"
$zip = "C:\Users\elnoo\Downloads\Guia_FIT_docentes_eventos.zip"
$temp = "C:\Users\elnoo\Downloads\Guia_FIT_TEMP_V5"

if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $temp -Force

# Si al descomprimir ves una carpeta guia-fit-main, usa esta línea:
robocopy "$temp\guia-fit-main" "$repo" /MIR /XD ".git" "node_modules"
```

Si el ZIP se descomprime con otro nombre de carpeta, cambia solo `"$temp\guia-fit-main"` por la carpeta que realmente contiene `package.json`.

## 3. Instala y comprueba

```powershell
cd "C:\Users\elnoo\Downloads\Guia_FIT_Render_Aiven_Flutter\Guia_FIT"
npm ci
npm test
git status
```

Las pruebas que usan PostgreSQL embebido y OCR requieren las dependencias de desarrollo instaladas por `npm ci`.

## 4. Sube a GitHub

```powershell
git add .
git commit -m "Agregar cuentas docentes y eventos con QR"
git push origin main
```

Si Render está conectado a esa rama, iniciará el nuevo despliegue.

## 5. Migración de Aiven

Con `AUTO_MIGRATE=true`, el arranque aplica automáticamente **solo** la migración pendiente `004_events.sql` y la registra en `schema_migrations`. No modifiques `001_initial.sql`, `002_food.sql` ni `003_profiles.sql` si ya fueron aplicadas.

Si desactivaste las migraciones automáticas, ejecútala desde un entorno que ya tenga `DATABASE_URL` y el certificado configurados:

```powershell
npm run db:migrate
```

La nueva migración **no borra** usuarios ni pedidos. Añade:

- `profiles.career`.
- `events`.
- `event_careers`.
- `event_teacher_invites`.
- `event_checkin_tokens`.
- `event_attendance`.
- `event_documents`.

## Roles por correo

Guía FIT clasifica la experiencia de la cuenta así:

- Alumno: `a` + números + `@alumnos.uat.edu.mx`, por ejemplo `a2213332176@alumnos.uat.edu.mx`.
- Docente: correo terminado en `@uat.edu.mx` o `@docentes.uat.edu.mx`.
- Administrador: conserva el rol `admin` guardado en la base; este rol tiene prioridad sobre el formato del correo.
- Cualquier otro dominio queda como cuenta no clasificada para estas funciones.

La clasificación por dominio decide qué interfaz mostrar; no sustituye la revisión institucional del perfil.

## Qué revisar después del deploy

1. Entra con una cuenta de alumno y confirma que **Mi cuenta** permite guardar la carrera.
2. Entra con una cuenta docente y confirma que **Mi horario** solo pide materia, salón, día y hora.
3. Prueba una foto de perfil: debe abrir el recorte para mover y acercar antes de guardarla.
4. Con administrador, crea un evento para alumnos, público y después otro cerrado para dos carreras.
5. Genera el QR. La asistencia debe rechazarse antes/después del día del evento y funcionar el día programado.
6. Entra con el alumno correspondiente, escanea el QR y revisa **Eventos → Mis asistencias**.
7. Genera el PDF y valida su código `FIT-AAAA-XXXXXXXXXXXX` en la pestaña **Validar PDF**.
8. Con una cuenta docente crea un evento para todos los docentes y otro exclusivo seleccionando docentes registrados.

## Nota del horario docente

El lector web reconoce tanto la tabla estudiantil de 11 columnas como formatos docentes que contienen **Materia**, **Lunes–Domingo** y **Aula**, aunque también traigan columnas como Clave, Sit, F.F. o Hrs. Para cuentas docentes, esas columnas administrativas se descartan y se conserva únicamente materia, salón y bloques de día/hora. Siempre se muestra una revisión antes de guardar.
