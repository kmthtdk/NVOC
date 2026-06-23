# Stop the N-VOC stack. Pass -Volumes to also delete the DB + uploads volumes.
param([switch]$Volumes)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($Volumes) {
    Write-Host "Stopping stack and REMOVING volumes (DB data + uploads will be lost)..." -ForegroundColor Yellow
    docker compose down -v
} else {
    Write-Host "Stopping stack (volumes preserved)..." -ForegroundColor Cyan
    docker compose down
}
Write-Host "Done." -ForegroundColor Green
