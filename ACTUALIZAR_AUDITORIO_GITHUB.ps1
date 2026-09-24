[CmdletBinding()]
param([string]$Rama = "main", [string]$Remoto = "https://github.com/AmandoMtz/guia-fit.git")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
function Invoke-Git { param([string[]]$Argumentos)
    & git @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Git fallo. No se forzaron cambios remotos." }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git para Windows primero." }
$destino = Join-Path $env:TEMP ("guia-fit-auditorio-" + [guid]::NewGuid().ToString("N"))
Invoke-Git -Argumentos @("-c", "core.autocrlf=false", "clone", "--branch", $Rama, "--single-branch", $Remoto, $destino)
$archivos = @(
    @{ Path = 'tests/push.test.cjs'; Base = '5212cf2aaffe89526dbe297d3ac99922377ae2604ebf01a41eb95204dcf85b02' }
    @{ Path = 'tests/audit-console.test.cjs'; Base = 'NEW' }
    @{ Path = 'server/audit-console.cjs'; Base = 'NEW' }
    @{ Path = 'server/food-chat.cjs'; Base = '6ade29dbcebcef61c0377ac8eb833cee697c45ad147e7c35d901ad654532cf8e' }
    @{ Path = 'server/food.cjs'; Base = '3dd8044a8df7daaaf0be4297d26fdbf6fa710e51794bd6f73726f7aa4711d9d9' }
    @{ Path = 'server/app.cjs'; Base = 'b9b95c8e5cc4d2bf1b19ee7f0920633e1aa5fd3e6b35219ee59472e41b5128d7' }
    @{ Path = 'docs/AUDITORIO_DE_REGISTROS.md'; Base = 'NEW' }
    @{ Path = 'web/dist/index.html'; Base = '697b3f4ac91b2f38aa80dd670d540ccf357119563778c11d414ab10ef3af8fc2' }
    @{ Path = 'web/dist/sw.js'; Base = '8188f418c133b7cc33ce9bd39e6538f951be8a4d2b4bd986ef67337bf4a9ff11' }
    @{ Path = 'web/dist/js/app.js'; Base = '5ba026f902c55ca9c7ea6d60f139569f133aa82a13e2d3f73b3a2213b8c7b335' }
    @{ Path = 'web/dist/js/audit.js'; Base = 'NEW' }
    @{ Path = 'web/dist/js/academic-chat.js'; Base = '1bc8c20eace885fbe53d9742dc6dd4081c0279f4600e304892c5a51ab9feee50' }
    @{ Path = 'web/dist/js/food.js'; Base = '78f533da34105aee0755e4677ae7793fb5c51b89086ae56adcd9b219ed2d63d9' }
    @{ Path = 'backend/migrations/014_audit_console.sql'; Base = 'NEW' }
)
foreach ($item in $archivos) {
    $source = Join-Path $PSScriptRoot $item.Path
    $target = Join-Path $destino $item.Path
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta el archivo $($item.Path). Extrae el ZIP completo." }
    if (Test-Path -LiteralPath $target) {
        $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        $nuevo = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        if ($actual -ne $item.Base -and $actual -ne $nuevo) { throw "GitHub tiene cambios diferentes en $($item.Path). Hay que integrarlos antes de publicar." }
    } elseif ($item.Base -ne "NEW") { throw "El archivo $($item.Path) fue retirado de GitHub. Revisa el conflicto antes de publicar." }
}
foreach ($item in $archivos) {
    $target = Join-Path $destino $item.Path
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item.Path) -Destination $target -Force
}
Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $destino "ACTUALIZAR_AUDITORIO_GITHUB.ps1") -Force
Push-Location $destino
try {
    Invoke-Git -Argumentos @("add", "--", ".")
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "GitHub ya tiene esta actualizacion."; return }
    if ($LASTEXITCODE -ne 1) { throw "No se pudieron revisar los cambios." }
    Invoke-Git -Argumentos @("commit", "-m", "Agrega Auditorio de registros exclusivo para admin")
    Invoke-Git -Argumentos @("push", "origin", $Rama)
    Write-Host "Listo. Actualizacion enviada a GitHub. Si Render tiene despliegue automatico, iniciara el deploy."
} finally { Pop-Location }
