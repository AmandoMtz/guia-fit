$ErrorActionPreference = "Stop"

Write-Host "Guía FIT - actualización a GitHub" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Ejecuta este archivo dentro de la carpeta de tu repositorio guia-fit (la que contiene .git)." -ForegroundColor Red
    exit 1
}

git status
git add .
git commit -m "Aplica temas globales y mejora personalizacion"
git push origin main

Write-Host "Listo. Cambios enviados a GitHub." -ForegroundColor Green
