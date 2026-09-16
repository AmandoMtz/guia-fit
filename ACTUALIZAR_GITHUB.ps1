[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Repositorio,
    [string]$Rama = "main"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git fallo: $($Arguments -join ' ')" }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git para Windows primero." }
$source = $PSScriptRoot
if (-not (Test-Path (Join-Path $source 'web/dist/js/app.js'))) { throw "Ejecuta el script incluido dentro del ZIP extraido." }
$target = (Resolve-Path -LiteralPath $Repositorio).Path
if ($target -eq $source) { throw "Extrae esta actualizacion en una carpeta separada de tu repositorio." }
Push-Location $target
try {
    $root = & git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0) { throw "La ruta no es un repositorio Git." }
    if ([IO.Path]::GetFullPath($root).TrimEnd('\','/') -ne $target.TrimEnd('\','/')) { throw "Indica la carpeta raiz del repositorio." }
    $remote = & git remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch 'github\.com[:/]AmandoMtz/guia-fit(?:\.git)?/?$') { throw "El remoto origin debe ser AmandoMtz/guia-fit en GitHub. Revisa git remote -v." }
    $status = & git status --porcelain
    if ($LASTEXITCODE -ne 0 -or $status) { throw "Hay cambios locales pendientes. Guardalos en un commit antes de actualizar." }
    $current = & git branch --show-current
    if ($LASTEXITCODE -ne 0 -or $current -ne $Rama) { throw "Cambia primero a la rama $Rama." }
    Invoke-Git -Arguments @('fetch','origin',$Rama)
    $ahead = & git rev-list --count "origin/$Rama..HEAD"
    if ($LASTEXITCODE -ne 0 -or [int]$ahead -gt 0) { throw "Hay commits locales sin publicar. Resuelvelos antes de aplicar la actualizacion." }
    Invoke-Git -Arguments @('merge','--ff-only',"origin/$Rama")
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $source 'actualizacion-manifest.json') | ConvertFrom-Json
    foreach ($file in $manifest) {
        $dest = Join-Path $target $file.path
        if ($file.baseSha256) {
            if (-not (Test-Path -LiteralPath $dest)) { throw "Falta el archivo base: $($file.path)" }
            $hashOriginal = (Get-FileHash -Algorithm SHA256 -LiteralPath $dest).Hash.ToLowerInvariant()
$contenidoLF = [IO.File]::ReadAllText($dest).Replace("`r`n", "`n")
$shaFIT = [Security.Cryptography.SHA256]::Create()
try {
    $hashLF = [BitConverter]::ToString(
        $shaFIT.ComputeHash([Text.Encoding]::UTF8.GetBytes($contenidoLF))
    ).Replace("-", "").ToLowerInvariant()
} finally {
    $shaFIT.Dispose()
}
$hash = @($hashOriginal, $hashLF)
            if ($hash -notcontains $file.baseSha256 -and $hash -notcontains $file.newSha256) { throw "El archivo $($file.path) cambio desde el ZIP original. Se detuvo la actualizacion antes de copiar para conservar tus cambios." }
        } elseif (Test-Path -LiteralPath $dest) {
            if ((Get-FileHash -Algorithm SHA256 -LiteralPath $dest).Hash.ToLowerInvariant() -ne $file.newSha256) { throw "Ya existe un archivo diferente: $($file.path)." }
        }
    }
    foreach ($file in $manifest) {
        $dest = Join-Path $target $file.path
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
        Copy-Item -LiteralPath (Join-Path $source $file.path) -Destination $dest -Force
        Invoke-Git -Arguments @('add','--',$file.path)
    }
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "Esta actualizacion ya esta aplicada."; return }
    if ($LASTEXITCODE -ne 1) { throw "No se pudieron revisar los cambios." }
    Invoke-Git -Arguments @('commit','-m','Actualiza identidad FIT, tipografia Visby y enlaces institucionales')
    Invoke-Git -Arguments @('push','origin',$Rama)
    Write-Host "Listo. Actualizacion enviada a GitHub." -ForegroundColor Green
} finally { Pop-Location }
