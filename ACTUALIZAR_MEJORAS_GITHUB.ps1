[CmdletBinding()]
param([string]$Rama = "main", [string]$Remoto = "https://github.com/AmandoMtz/guia-fit.git")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
function Invoke-Git { param([string[]]$Argumentos)
    & git @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Git fallo. No se forzaron cambios remotos." }
}
function Get-TextHash { param([string]$Ruta)
    $contenido = [System.IO.File]::ReadAllText($Ruta).Replace("`r`n", "`n").Replace("`r", "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($contenido)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose() }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git para Windows primero." }
$destino = Join-Path $env:TEMP ("guia-fit-mejoras-" + [guid]::NewGuid().ToString("N"))
Write-Host "1/4 Descargando la version actual de GitHub..."
Invoke-Git -Argumentos @("-c", "core.autocrlf=false", "clone", "--branch", $Rama, "--single-branch", $Remoto, $destino)
$archivos = @(
    @{ Path = 'backend/migrations/015_persistent_schedules_food.sql'; Base = 'NEW' }
    @{ Path = 'docs/ACTUALIZACION_HORARIOS_CHATS_CUENTAS.md'; Base = 'NEW' }
    @{ Path = 'server/academic-chat.cjs'; Base = '9d06791a3244fe8e8c511729936d3567d18416a0c1b12fc5c07e1df0b7438961' }
    @{ Path = 'server/app.cjs'; Base = '1d36a46a96437e183343cd856f82cd9a88b11c9b71ae4c2d8f872b01beee3b86' }
    @{ Path = 'server/audit-console.cjs'; Base = 'e994ceb17a05136c92b14465ac2027f2cfa9460bf4af65671282dedfec72c56e' }
    @{ Path = 'server/food-chat.cjs'; Base = 'eab02cfc8db571e13c80cd0a3b6f82a4e282dd0c8b415b0f810d3974a3f5a004' }
    @{ Path = 'server/food.cjs'; Base = '3f3677971ca7dbca9e58e3347aff5ed9637f9f6893cfaaa5d94b160d2aeb798e' }
    @{ Path = 'server/index.cjs'; Base = 'c902b616b6e2323101e7c66d89f7413c0198db4a1eee986ff547250a27eaea62' }
    @{ Path = 'server/profile.cjs'; Base = '1291806af17808240929e072f79e679da802d095045ccadd7dcd000d9297aab8' }
    @{ Path = 'server/schedules.cjs'; Base = 'NEW' }
    @{ Path = 'tests/academic-chat.test.cjs'; Base = '30787a07e52e733c9869fc36fc2122f46b2c44138e51d6db53b83603f27c7e88' }
    @{ Path = 'tests/account-ui.test.cjs'; Base = 'NEW' }
    @{ Path = 'tests/food.test.cjs'; Base = '913f5cb5d0dfe3540697882d312a96854e144b110670f8d44f4dedb901fbc194' }
    @{ Path = 'tests/offline.test.cjs'; Base = '43dcc5c724bdb1db5e044b5e6e17eba644fb709905e3f14c49ad9a6953547b71' }
    @{ Path = 'tests/push.test.cjs'; Base = '6d111b708f17019c6162bdf5b9430ea2ce2ab64edde3e2c94277ad323c89f4d0' }
    @{ Path = 'tests/schedule-sync.test.cjs'; Base = 'NEW' }
    @{ Path = 'tests/security.test.cjs'; Base = 'fb35f3677ef0d098de63f31412f17cbfd5542633b241f30270f7e5926f1837c4' }
    @{ Path = 'web/dist/account-updates.css'; Base = 'NEW' }
    @{ Path = 'web/dist/index.html'; Base = '2915d85166e38d2950473ab0dc5347578eff3f189f4a73dd2da68b29777793b8' }
    @{ Path = 'web/dist/js/academic-chat.js'; Base = '7032942737f453ee69ca9b7a79c8f67e5608e439856a63d0bb9a34994ba54d7e' }
    @{ Path = 'web/dist/js/app.js'; Base = '426a0cb8f02c3c7406dac154b4bb262a004b43c6bbd9c57e49c7a708d7303776' }
    @{ Path = 'web/dist/js/audit.js'; Base = 'e2489e017c0d4a05986eca8b4033f4f52f8235844ec3e262045552bc76856dd9' }
    @{ Path = 'web/dist/js/food.js'; Base = '678c739ea70862b7d3b650e53504c40a8e677f566668ecb9cbbd63c109f2975c' }
    @{ Path = 'web/dist/js/offline.js'; Base = '6d59c4a52293ee396440c41ff62a3cac3333bb4513363b4a91de9f2d0f5b96cd' }
    @{ Path = 'web/dist/js/schedule.js'; Base = '4fe71c4ccee8b2422a45af496d36854807dfafca6ce2a35f079543792f729871' }
    @{ Path = 'web/dist/sw.js'; Base = '032cdd445232f8bca63e13bb332fcb54a12297687923cf66648fa8e5eb8179c9' }
    @{ Path = 'ACTUALIZAR_MEJORAS_GITHUB.ps1'; Base = 'NEW' }
)
Write-Host "2/4 Comprobando archivos..."
foreach ($item in $archivos) {
    $source = Join-Path $PSScriptRoot $item.Path
    $target = Join-Path $destino $item.Path
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta $($item.Path). Extrae el ZIP completo." }
    if (Test-Path -LiteralPath $target) {
        $actual = Get-TextHash $target
        $nuevo = Get-TextHash $source
        if ($actual -ne $item.Base -and $actual -ne $nuevo) { throw "GitHub tiene cambios diferentes en $($item.Path). Hay que integrarlos antes de publicar. No se subio ningun cambio." }
    } elseif ($item.Base -ne "NEW") { throw "El archivo $($item.Path) fue retirado de GitHub. Revisa el conflicto antes de publicar." }
}
foreach ($item in $archivos) {
    $target = Join-Path $destino $item.Path
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item.Path) -Destination $target -Force
}
Push-Location $destino
try {
    Write-Host "3/4 Preparando actualizacion..."
    Invoke-Git -Argumentos @("add", "--", ".")
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "GitHub ya tiene esta actualizacion."; return }
    if ($LASTEXITCODE -ne 1) { throw "No se pudieron revisar los cambios." }
    Invoke-Git -Argumentos @("commit", "-m", "Conserva horarios y chats; mejora cuentas y auditoria")
    Write-Host "4/4 Subiendo a GitHub..."
    Invoke-Git -Argumentos @("push", "origin", $Rama)
    Write-Host "Listo. Si Render tiene despliegue automatico, iniciara el deploy."
} finally { Pop-Location }
