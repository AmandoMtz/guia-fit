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
        throw "Git fallo: git $($Argumentos -join ' ')"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "No se encontro Git para Windows. Instalalo y vuelve a ejecutar este script."
}

$origen = $PSScriptRoot
if (-not (Test-Path (Join-Path $origen "web\dist\js\app.js"))) {
    throw "Coloca este archivo dentro de la carpeta raiz del proyecto corregido y ejecutalo desde ahi."
}

$destino = Join-Path $env:TEMP "guia-fit-publicar"
if (Test-Path $destino) {
    Remove-Item -LiteralPath $destino -Recurse -Force
}

Write-Host "1/4 Clonando la rama $Rama por HTTPS..." -ForegroundColor Cyan
Invoke-Git -Argumentos @("clone", "--branch", $Rama, "--single-branch", $Remoto, $destino)

Write-Host "2/4 Copiando la version corregida..." -ForegroundColor Cyan
$null = & robocopy $origen $destino /MIR /XD ".git" "node_modules" ".dart_tool" "build" /XF ".env"
$robo = $LASTEXITCODE
if ($robo -ge 8) {
    throw "Robocopy no pudo copiar el proyecto. Codigo: $robo"
}

Push-Location $destino
try {
    Write-Host "3/4 Preparando commit..." -ForegroundColor Cyan
    Invoke-Git -Argumentos @("add", "-A")

    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No hay cambios nuevos que publicar. GitHub ya tiene esta version." -ForegroundColor Yellow
        return
    }
    if ($LASTEXITCODE -ne 1) {
        throw "No se pudieron revisar los cambios preparados."
    }

    Invoke-Git -Argumentos @("commit", "-m", "Agrega chat entre alumnos y docentes")

    Write-Host "4/4 Subiendo a GitHub..." -ForegroundColor Cyan
    Invoke-Git -Argumentos @("push", "origin", $Rama)

    Write-Host "LISTO: los cambios fueron enviados a GitHub." -ForegroundColor Green
    Write-Host "Render deberia detectar el commit y desplegar automaticamente." -ForegroundColor Green
}
finally {
    Pop-Location
}
