[CmdletBinding()]
param(
    [string]$Rama = "main",
    [string]$Remoto = "https://github.com/AmandoMtz/guia-fit.git"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Git {
    param([Parameter(Mandatory=$true)][string[]]$Argumentos)
    & git @Argumentos
    if ($LASTEXITCODE -ne 0) {
        throw "Git falló: git $($Argumentos -join ' ')"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "No se encontró Git para Windows. Instálalo y vuelve a ejecutar este script."
}

$origen = $PSScriptRoot
if (-not (Test-Path (Join-Path $origen "web\dist\js\app.js"))) {
    throw "Ejecuta este archivo desde la carpeta raíz del proyecto corregido."
}

$destino = Join-Path $env:TEMP "guia-fit-publicar"
if (Test-Path $destino) {
    Remove-Item -LiteralPath $destino -Recurse -Force
}

Write-Host "1/4 Clonando la rama $Rama..." -ForegroundColor Cyan
Invoke-Git -Argumentos @("clone", "--branch", $Rama, "--single-branch", $Remoto, $destino)

Write-Host "2/4 Copiando la versión corregida..." -ForegroundColor Cyan
$null = & robocopy $origen $destino /MIR /XD ".git" "node_modules" ".dart_tool" "build" /XF ".env"
$robo = $LASTEXITCODE
if ($robo -ge 8) {
    throw "Robocopy no pudo copiar el proyecto. Código: $robo"
}

Push-Location $destino
try {
    Write-Host "3/4 Preparando commit..." -ForegroundColor Cyan
    Invoke-Git -Argumentos @("add", "-A")

    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No hay cambios nuevos que publicar. GitHub ya tiene esta versión." -ForegroundColor Yellow
        return
    }
    if ($LASTEXITCODE -ne 1) {
        throw "No se pudieron revisar los cambios preparados."
    }

    Invoke-Git -Argumentos @("commit", "-m", "Mejora portada, footer, chatbot y notificaciones")

    Write-Host "4/4 Subiendo a GitHub..." -ForegroundColor Cyan
    Invoke-Git -Argumentos @("push", "origin", $Rama)

    Write-Host "Listo. Los cambios fueron enviados a GitHub." -ForegroundColor Green
    Write-Host "Render debería detectar el nuevo commit y desplegarlo automáticamente si tu servicio está conectado al repositorio." -ForegroundColor Green
}
finally {
    Pop-Location
}
