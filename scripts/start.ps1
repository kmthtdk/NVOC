# Start the full N-VOC stack (build + detached). Creates .env from template if missing.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env")) {
    Write-Host "No .env found — creating from .env.example. EDIT IT before production use." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "Building and starting voc-db, voc-backend, voc-frontend..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host ""
Write-Host "Stack is starting. Frontend: http://localhost:3000   API: http://localhost:4000/health" -ForegroundColor Green
Write-Host "Follow logs:  docker compose logs -f" -ForegroundColor Gray
