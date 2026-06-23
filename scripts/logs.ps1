# Tail logs for all services, or a single one:  .\scripts\logs.ps1 backend
param([string]$Service)
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Service) { docker compose logs -f $Service } else { docker compose logs -f }
