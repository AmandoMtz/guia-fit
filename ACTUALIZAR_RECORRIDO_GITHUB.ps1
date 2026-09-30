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
$destino = Join-Path $env:TEMP ("guia-fit-recorrido-" + [guid]::NewGuid().ToString("N"))
Write-Host "1/4 Descargando la version actual de GitHub..."
Invoke-Git -Argumentos @("-c", "core.autocrlf=false", "clone", "--branch", $Rama, "--single-branch", $Remoto, $destino)
$archivos = @(
    @{ Path = 'web/dist/js/campus-map.js'; Base = @('2cce6e7e186c5e30ca257778514a07c752fc9576e83973a15caa4e9805b7997f','ff36748efd9e111859a3bc9a59de8f91ae4a7edb23497a07723035bb9bc033db') }
    @{ Path = 'web/dist/js/campus-controls.js'; Base = @('NEW') }
    @{ Path = 'web/dist/campus-map.css'; Base = @('70ff5c93974b768b7bdc93a086c59ebc12da577a5b4f85f3ece8eda3cff4a708','0891f4c877d27f2f1fa725fcff14218b19d1f928d06b96a116526200ae883560') }
    @{ Path = 'web/dist/index.html'; Base = @('d9a9c7aa181dbee9b1877a9c2b6fbe1a6ce7c7299b2924a3c618aaf0bbfdb4fa','87178041fc0aafd9c3d529e91b238fb8ec23e2456c1f6d00f298f2d03c95b7bf') }
    @{ Path = 'web/dist/mapa-campus-demo.html'; Base = @('6f735649b3bcd1162aee91929c0615d1351dac6ee7ea7453a7a7defe62b13937','15018dd51e2dfdddfed0208dffb6f0082c0097e72397f4a381b96f01a8c352a5') }
    @{ Path = 'web/dist/sw.js'; Base = @('daba460077b81c3109b5ec249d5e5bf46b1747040bdf32beaafd4582c3cde129','8a62a934adc22e69418e20883da270ca05b93034819e658658545d790285a20b') }
    @{ Path = 'tests/campus-immersive.test.cjs'; Base = @('927de4661d91cb5f554f890925e328515fa54e5912b8d4401ab68a169638517d','NEW') }
    @{ Path = 'tests/campus-controls.test.cjs'; Base = @('NEW') }
    @{ Path = 'tests/campus-walk.test.cjs'; Base = @('a592a64736bebbfb2376ff696a93ce8dae65c849889240c83ac11a6a8e8d7210') }
    @{ Path = 'scripts/test-campus-map-browser.cjs'; Base = @('f53c42c3995699dd3fdc2675b01b50992e4d788212be6ed352f0abc5425ff3e5') }
    @{ Path = 'RECORRIDO_360_CAMARA.md'; Base = @('dc64fa07bf95da57ae84b6cd274d7477bcd2c4fb22c0f762e40ff2f7022f4826','NEW') }
    @{ Path = 'ACTUALIZAR_RECORRIDO_GITHUB.ps1'; Base = @('52bbac97c370148dd8cacd74ac0ea0b039dd2a65d872ef9217cd7ea96b886f68','NEW') }
)
Write-Host "2/4 Comprobando archivos..."
foreach ($item in $archivos) {
    $source = Join-Path $PSScriptRoot $item.Path
    $target = Join-Path $destino $item.Path
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta $($item.Path). Extrae el ZIP completo." }
    if (Test-Path -LiteralPath $target) {
        $actual = Get-TextHash $target
        $nuevo = Get-TextHash $source
        if (($item.Base -notcontains $actual) -and $actual -ne $nuevo) { throw "GitHub tiene cambios diferentes en $($item.Path). Hay que integrarlos antes de publicar. No se subio ningun cambio." }
    } elseif ($item.Base -notcontains "NEW") { throw "El archivo $($item.Path) fue retirado de GitHub. Revisa el conflicto antes de publicar." }
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
    Invoke-Git -Argumentos @("commit", "-m", "Recorrido rojo con joystick, orientacion y seguimiento AR relativo")
    Write-Host "4/4 Subiendo a GitHub..."
    Invoke-Git -Argumentos @("push", "origin", $Rama)
    Write-Host "Listo. Si Render tiene despliegue automatico, iniciara el deploy."
} finally { Pop-Location }
