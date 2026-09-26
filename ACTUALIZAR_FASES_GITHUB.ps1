$ErrorActionPreference = 'Stop'
$origen = $PSScriptRoot
if (!(Test-Path (Join-Path $origen 'package.json'))) { throw 'Ejecuta este archivo desde la carpeta guia-fit-main extraida del ZIP.' }
$repo = Join-Path $env:TEMP ('guia-fit-fases-' + [guid]::NewGuid())
git clone https://github.com/AmandoMtz/guia-fit.git "$repo"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo clonar el repositorio.' }
robocopy "$origen" "$repo" /E /XD .git node_modules /XF .env /R:2 /W:2 /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw 'Fallo la copia de archivos.' }
Set-Location "$repo"
git add .
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los cambios.' }
git diff --cached --quiet
$resultado = $LASTEXITCODE
if ($resultado -eq 0) { Write-Host 'El repositorio ya tiene estos cambios.'; return }
if ($resultado -ne 1) { throw 'No se pudieron revisar los cambios.' }
git commit -m 'Completa entregas QR, salones 3D, GPS exterior y marcos festivos'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el commit.' }
git push origin HEAD
if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir. Comparte el error.' }
Write-Host 'Cambios enviados correctamente a GitHub.'
