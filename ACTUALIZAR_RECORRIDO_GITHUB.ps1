[CmdletBinding()]
param(
    [string]$Rama = "main",
    [string]$Remoto = "https://github.com/AmandoMtz/guia-fit.git",
    [switch]$SoloPreparar
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
function Invoke-Git { param([string[]]$Argumentos)
    & git --no-pager @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Git fallo. No se forzaron cambios remotos." }
}
function Get-TextHash { param([string]$Ruta)
    $texto = [System.IO.File]::ReadAllText($Ruta).Replace("`r`n", "`n").Replace("`r", "`n")
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($texto)))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Copy-Text { param([string]$Origen, [string]$Destino)
    New-Item -ItemType Directory -Force -Path (Split-Path $Destino -Parent) | Out-Null
    $texto = [System.IO.File]::ReadAllText($Origen).Replace("`r`n", "`n").Replace("`r", "`n")
    [System.IO.File]::WriteAllText($Destino, $texto, (New-Object System.Text.UTF8Encoding($false)))
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git para Windows primero." }
$manifestPath = Join-Path $PSScriptRoot ".fit-update/manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "Extrae el ZIP completo, incluyendo la carpeta .fit-update." }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$destino = Join-Path $env:TEMP ("guia-fit-movil-" + [guid]::NewGuid().ToString("N"))
Write-Host "1/4 Descargando la version actual de GitHub..."
Invoke-Git -Argumentos @("clone", "--config", "core.autocrlf=false", "--branch", $Rama, "--single-branch", $Remoto, $destino)
$preparados = Join-Path $env:TEMP ("guia-fit-cambios-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $preparados | Out-Null
Write-Host "2/4 Integrando todos los cambios de esta entrega..."
foreach ($item in $manifest.files) {
    $source = Join-Path $PSScriptRoot $item.path
    $target = Join-Path $destino $item.path
    $candidate = Join-Path $preparados $item.path
    $base = Join-Path $PSScriptRoot (".fit-update/base/" + $item.path)
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta $($item.path). Extrae de nuevo el ZIP completo." }
    if ((Get-TextHash $source) -ne $item.newHash) { throw "El archivo $($item.path) fue cambiado despues de preparar esta entrega. Revisa tus cambios antes de publicar." }
    if (-not (Test-Path -LiteralPath $target)) {
        if ($item.baseHash) { throw "GitHub retiro $($item.path). No se subio ningun cambio. Revisa $destino." }
        Copy-Text $source $candidate
        continue
    }
    $actual = Get-TextHash $target
    if ($actual -eq $item.newHash) { Copy-Text $target $candidate; continue }
    if ($item.baseHash -and $actual -eq $item.baseHash) { Copy-Text $source $candidate; continue }
    if (-not $item.baseHash) { throw "GitHub ya tiene un archivo diferente en $($item.path). No se subio ningun cambio. Revisa $destino." }
    if (-not (Test-Path -LiteralPath $base)) { throw "Falta la version base de $($item.path). Extrae el ZIP completo." }
    if ((Get-TextHash $base) -ne $item.baseHash) { throw "La version base de $($item.path) fue modificada." }

    # El index.html solo cambia por la version del CSS del login. Si GitHub tambien
    # actualizo ese HTML, conserva todo el archivo remoto y modifica unicamente ese enlace.
    if ($item.path -eq "web/dist/index.html") {
        $sourceText = [System.IO.File]::ReadAllText($source).Replace("`r`n", "`n").Replace("`r", "`n")
        $targetText = [System.IO.File]::ReadAllText($target).Replace("`r`n", "`n").Replace("`r", "`n")
        $linkPattern = '(?m)^[ \t]*<link\s+rel="stylesheet"\s+href="styles\.css[^"]*"[^>]*>[ \t]*$'
        $sourceLinks = [regex]::Matches($sourceText, $linkPattern)
        $targetLinks = [regex]::Matches($targetText, $linkPattern)
        if ($sourceLinks.Count -ne 1 -or $targetLinks.Count -ne 1) {
            throw "No se pudo identificar un unico enlace a styles.css en web/dist/index.html. No se subio ningun cambio."
        }
        $replacement = $sourceLinks[0].Value
        $patchedText = [regex]::Replace($targetText, $linkPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }, 1)
        New-Item -ItemType Directory -Force -Path (Split-Path $candidate -Parent) | Out-Null
        [System.IO.File]::WriteAllText($candidate, $patchedText, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Conservado el index.html de GitHub; actualizado solo el enlace al CSS del login."
        continue
    }

    # styles.css agrega un bloque al final. Anexa solo ese bloque a la version remota,
    # preservando estilos incorporados posteriormente en GitHub.
    if ($item.path -eq "web/dist/styles.css") {
        $sourceText = [System.IO.File]::ReadAllText($source).Replace("`r`n", "`n").Replace("`r", "`n")
        $baseText = [System.IO.File]::ReadAllText($base).Replace("`r`n", "`n").Replace("`r", "`n")
        $targetText = [System.IO.File]::ReadAllText($target).Replace("`r`n", "`n").Replace("`r", "`n")
        $loginMarker = "/* Login amplio: mapa y formulario comparten fila y ancho en escritorio. */"
        if ($targetText.Contains($loginMarker)) {
            Copy-Text $target $candidate
            Write-Host "Los estilos responsivos del login ya estan presentes en GitHub."
            continue
        }
        if ($sourceText.StartsWith($baseText, [System.StringComparison]::Ordinal)) {
            $addition = $sourceText.Substring($baseText.Length).TrimStart("`r", "`n")
            if ([string]::IsNullOrWhiteSpace($addition)) { throw "No se encontro el bloque nuevo de estilos responsivos." }
            $mergedText = $targetText.TrimEnd() + "`n`n" + $addition + "`n"
            New-Item -ItemType Directory -Force -Path (Split-Path $candidate -Parent) | Out-Null
            [System.IO.File]::WriteAllText($candidate, $mergedText, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "Conservados los estilos de GitHub y agregado el bloque responsivo del login."
            continue
        }
    }

    Copy-Text $target $candidate
    $baseTemporal = Join-Path $preparados ("base-" + [guid]::NewGuid().ToString("N"))
    $nuevaTemporal = Join-Path $preparados ("nueva-" + [guid]::NewGuid().ToString("N"))
    Copy-Text $base $baseTemporal
    Copy-Text $source $nuevaTemporal
    & git merge-file -- $candidate $baseTemporal $nuevaTemporal
    if ($LASTEXITCODE -ne 0) { throw "Conflicto en $($item.path). No se hizo commit ni push. La propuesta con marcas de conflicto esta en $candidate. GitHub descargado: $destino." }
}
foreach ($item in $manifest.files) {
    Copy-Text (Join-Path $preparados $item.path) (Join-Path $destino $item.path)
}
# Keep the updater self-contained when the project is downloaded again.
$soporte = Join-Path $destino ".fit-update"
New-Item -ItemType Directory -Force -Path $soporte | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot ".fit-update/*") -Destination $soporte -Recurse -Force
Push-Location $destino
try {
    Write-Host "3/4 Preparando actualizacion..."
    Invoke-Git -Argumentos @("add", "--", ".")
    & git --no-pager diff --cached --stat
    & git --no-pager diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "GitHub ya tiene esta actualizacion."; return }
    if ($LASTEXITCODE -ne 1) { throw "No se pudieron revisar los cambios." }
    if ($SoloPreparar) { Write-Host "Cambios preparados sin publicar en: $destino"; return }
    Invoke-Git -Argumentos @("commit", "-m", "Ampliar login al ancho y alto del mapa; conservar notificaciones y recorrido")
    Write-Host "4/4 Subiendo a GitHub..."
    Invoke-Git -Argumentos @("push", "origin", $Rama)
    Write-Host "Listo. Si Render tiene despliegue automatico, iniciara el deploy."
    Write-Host "Lee ACTUALIZACION_MOVIL_NOTIFICACIONES.md: el servicio debe permanecer activo para recordar clases."
} finally { Pop-Location }
