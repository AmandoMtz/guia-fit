# Ejecutar dentro de tu copia local de AmandoMtz/guia-fit.
# Se detiene si hay cambios locales pendientes o si main no puede avanzar sin conflictos.
$ErrorActionPreference = "Stop"
function Invoke-FitGit {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArguments)
    & git @GitArguments
    if ($LASTEXITCODE -ne 0) { throw "Git no pudo completar la operacion. No se continuara." }
}
$repoRoot = Invoke-FitGit rev-parse --show-toplevel
Set-Location $repoRoot
$pending = Invoke-FitGit status --porcelain
if ($pending) { throw "Guarda o confirma tus cambios locales antes de actualizar el mapa." }
$remote = Invoke-FitGit remote get-url origin
if ($remote -notmatch "^(https://github\.com/|git@github\.com:)AmandoMtz/guia-fit(\.git)?/?$") {
    throw "Esta carpeta no apunta a AmandoMtz/guia-fit. Abre la carpeta correcta."
}
Invoke-FitGit fetch origin
Invoke-FitGit switch main
Invoke-FitGit merge --ff-only origin/main
Invoke-FitGit merge --ff-only origin/codex/mapa-campus-oriente
Invoke-FitGit push origin main
Write-Host "Mapa incorporado en main. Revisa el despliegue en Render."
