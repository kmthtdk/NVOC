#Requires -Version 5.1

<#
.SYNOPSIS
  MAC Address Functionality - Comprehensive Test Execution Script (PowerShell)

.DESCRIPTION
  This script runs the complete MAC address test suite using Playwright.

  Prerequisites:
    - Backend running on http://localhost:4000
    - Frontend running on http://localhost:3000
    - MySQL database initialized with seed data
    - npm dependencies installed

.PARAMETER UIMode
  Run tests with Playwright UI mode enabled

.PARAMETER Headed
  Run tests in headed (browser visible) mode

.PARAMETER Group
  Filter tests by group name pattern

.PARAMETER Report
  Generate HTML report after test completion

.PARAMETER Debug
  Enable debug logging in Playwright

.PARAMETER Help
  Show help documentation

.EXAMPLE
  .\run_mac_address_tests.ps1

.EXAMPLE
  .\run_mac_address_tests.ps1 -UIMode -Group "MAC Address Creation"

.EXAMPLE
  .\run_mac_address_tests.ps1 -Headed -Report

.NOTES
  Author: QA Automation Team
  Version: 1.0.0
  Last Updated: 2026-06-23
#>

param (
  [switch]$UIMode,
  [switch]$Headed,
  [string]$Group,
  [switch]$Report,
  [switch]$Debug,
  [switch]$Help
)

# Configuration
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommandPath
$BackendUrl = "http://localhost:4000"
$FrontendUrl = "http://localhost:3000"
$TestFile = "tests/mac-address.spec.ts"
$ReportDir = "playwright-report"
$TestLogFile = "mac-address-tests.log"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Colors
function Write-Header {
  param([string]$Message)
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host $Message -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
  param([string]$Message)
  Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
  param([string]$Message)
  Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
  param([string]$Message)
  Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Show-Help {
  Get-Help -Full $MyInvocation.MyCommandPath
}

function Test-ServiceAvailable {
  param(
    [string]$Url,
    [string]$ServiceName
  )

  try {
    Write-Info "Checking $ServiceName connectivity to $Url..."
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Success "$ServiceName is running"
    return $true
  } catch {
    Write-Warning-Custom "$ServiceName at $Url may not be responding"
    return $false
  }
}

function Check-Prerequisites {
  Write-Header "Checking Prerequisites"

  # Check npm
  try {
    $null = npm --version 2>$null
    Write-Success "npm is installed ($(npm --version))"
  } catch {
    Write-Error-Custom "npm is not installed"
    exit 1
  }

  # Check connectivity
  Test-ServiceAvailable -Url $BackendUrl -ServiceName "Backend"
  Test-ServiceAvailable -Url $FrontendUrl -ServiceName "Frontend"

  # Check Playwright
  if (Test-Path -Path "$ProjectDir/node_modules/@playwright/test") {
    Write-Success "Playwright is installed"
  } else {
    Write-Warning-Custom "Playwright not found, will attempt install during setup"
  }

  # Check test file
  if (Test-Path -Path "$ProjectDir/$TestFile") {
    Write-Success "Test file found: $TestFile"
  } else {
    Write-Error-Custom "Test file not found: $TestFile"
    exit 1
  }
}

function Install-Dependencies {
  Write-Header "Installing/Verifying Dependencies"

  Push-Location $ProjectDir

  if (-not (Test-Path -Path "node_modules")) {
    Write-Info "Installing npm dependencies..."
    npm install 2>&1 | Tee-Object -FilePath $TestLogFile
    Write-Success "Dependencies installed"
  } else {
    Write-Success "node_modules exists"
  }

  # Install Playwright browsers
  Write-Info "Verifying Playwright browsers..."
  npx playwright install 2>&1 | Out-Null
  Write-Success "Playwright browsers verified"

  Pop-Location
}

function Build-TestCommand {
  $cmd = "npx playwright test `"$TestFile`""

  if ($UIMode) {
    $cmd += " --ui"
  }

  if ($Headed) {
    $cmd += " --headed"
  }

  if ($Group) {
    $cmd += " -g `"$Group`""
  }

  if ($Debug) {
    $cmd += " --debug"
  }

  # Add reporter configuration
  $cmd += " --reporter=list --reporter=json:`"$ReportDir/results.json`""

  return $cmd
}

function Run-Tests {
  Write-Header "Running MAC Address Test Suite"

  Push-Location $ProjectDir

  Write-Info "Test execution started at $(Get-Date)"
  Write-Info "Backend: $BackendUrl"
  Write-Info "Frontend: $FrontendUrl"
  Write-Info "Test file: $TestFile"

  if ($Group) {
    Write-Info "Running tests matching: $Group"
  }

  Write-Host ""

  # Build and run test command
  $testCmd = Build-TestCommand
  Write-Info "Executing: $testCmd"
  Write-Host ""

  # Execute tests
  try {
    Invoke-Expression $testCmd 2>&1 | Tee-Object -FilePath $TestLogFile
    $exitCode = 0
    Write-Success "Test execution completed at $(Get-Date)"
  } catch {
    $exitCode = 1
    Write-Error-Custom "Test execution failed at $(Get-Date)"
  }

  Pop-Location
  return $exitCode
}

function Parse-TestResults {
  Write-Header "Test Results Summary"

  if (Test-Path -Path $TestLogFile) {
    $content = Get-Content -Path $TestLogFile -Raw

    # Count test markers
    $passCount = ($content | Select-String "✓" -AllMatches).Matches.Count
    $failCount = ($content | Select-String "✗" -AllMatches).Matches.Count

    Write-Info "Tests passed: $passCount"
    Write-Info "Tests failed: $failCount"

    # Show failures if any
    if ($content -match "FAIL") {
      Write-Warning-Custom "Some tests failed - review details:"
      Write-Host ""
      $content -split "`n" | Select-String "FAIL" -Context 0, 5 | ForEach-Object { Write-Host $_ }
    }
  }
}

function Generate-HtmlReport {
  Write-Header "Generating HTML Report"

  Push-Location $ProjectDir

  $reportJsonPath = "$ReportDir/results.json"
  if (Test-Path -Path $reportJsonPath) {
    Write-Info "Generating HTML report..."
    try {
      npx playwright show-report $ReportDir 2>&1 | Out-Null
      Write-Success "HTML report generated in $ReportDir/"
      Write-Info "Open in browser: file://$ProjectDir/$ReportDir/index.html"
    } catch {
      Write-Warning-Custom "Could not auto-open report, but files were generated"
    }
  } else {
    Write-Warning-Custom "No test results JSON found"
  }

  Pop-Location
}

function Show-ExecutionSummary {
  Write-Header "Execution Summary"

  Write-Info "Test log saved to: $TestLogFile"

  if ($Report) {
    Write-Info "HTML report saved to: $ReportDir/"
  }

  Write-Info "Execution timestamp: $Timestamp"
  Write-Info ""
  Write-Info "Next Steps:"
  Write-Info "  1. Review test results in: $TestLogFile"

  if ($Report) {
    Write-Info "  2. Open HTML report: file://$ProjectDir/$ReportDir/index.html"
  }

  Write-Info "  3. Fix any failing tests"
  Write-Info "  4. Re-run tests to verify fixes"
}

# Main execution
function Main {
  if ($Help) {
    Show-Help
    return
  }

  Check-Prerequisites
  Install-Dependencies

  # Run tests
  $testExitCode = Run-Tests

  # Post-test actions
  Parse-TestResults

  if ($Report) {
    Generate-HtmlReport
  }

  Show-ExecutionSummary

  exit $testExitCode
}

# Execute
Main
