##############################################################################
# MAC Address Test Suite Runner (PowerShell)
#
# Purpose: Execute comprehensive MAC address functionality tests using
#          Playwright with detailed logging on Windows
#
# Usage:   .\run_mac_tests.ps1 [-Headed] [-ChromeHeaded] [-Debug] [-Workers N] [-Filter "Pattern"]
#
# Parameters:
#   -Headed           Run tests in headed mode (see browser)
#   -ChromeHeaded     Run tests in Chrome headed mode
#   -Debug            Enable debug mode (verbose logging)
#   -Workers N        Run N tests in parallel (default: 1, serial)
#   -Filter           Run only tests matching pattern
#
# Prerequisites:
#   - Backend running on http://localhost:4000
#   - Frontend running on http://localhost:3000
#   - Node.js and npm installed
#   - PowerShell 5.0+
#
# Example runs:
#   .\run_mac_tests.ps1                                # Standard run (serial)
#   .\run_mac_tests.ps1 -Headed                        # See browser during tests
#   .\run_mac_tests.ps1 -Filter "Creation"             # Only Creation tests
#   .\run_mac_tests.ps1 -Debug -Headed                 # Debug + headed mode
#
##############################################################################

param(
    [switch]$Headed,
    [switch]$ChromeHeaded,
    [switch]$Debug,
    [int]$Workers = 1,
    [string]$Filter = ""
)

# Error handling
$ErrorActionPreference = "Stop"

# Configuration
$TestFile = "tests/mac-address.spec.ts"
$ReportDir = "test-results"
$LogFile = Join-Path $ReportDir "mac-address-test.log"
$JsonReport = Join-Path $ReportDir "mac-address-report.json"
$HtmlReport = Join-Path $ReportDir "index.html"

# Color output helper
function Write-Header {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "========================================`n" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Main execution
function Main {
    Write-Header "MAC Address Test Suite (PowerShell)"

    # Check prerequisites
    Write-Info "Checking prerequisites..."

    # Check npm
    $npmCheck = npm --version 2>$null
    if (-not $npmCheck) {
        Write-Error-Custom "npm not found. Please install Node.js"
        exit 1
    }
    Write-Success "npm is available"

    # Check npx
    $npxCheck = npx --version 2>$null
    if (-not $npxCheck) {
        Write-Error-Custom "npx not found. Please install Node.js"
        exit 1
    }
    Write-Success "npx is available"

    # Check backend connectivity
    Write-Info "Verifying backend connectivity..."
    try {
        $backendResponse = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($backendResponse.StatusCode -eq 200) {
            Write-Success "Backend is running on http://localhost:4000"
        } else {
            throw "Backend returned status $($backendResponse.StatusCode)"
        }
    } catch {
        Write-Error-Custom "Backend not responding on http://localhost:4000"
        Write-Info "Start backend with: cd backend && npm run dev"
        exit 1
    }

    # Check frontend connectivity
    Write-Info "Verifying frontend connectivity..."
    try {
        $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($frontendResponse.StatusCode -eq 200) {
            Write-Success "Frontend is running on http://localhost:3000"
        } else {
            throw "Frontend returned status $($frontendResponse.StatusCode)"
        }
    } catch {
        Write-Error-Custom "Frontend not responding on http://localhost:3000"
        Write-Info "Start frontend with: npm run dev"
        exit 1
    }

    # Create report directory
    if (-not (Test-Path $ReportDir)) {
        New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
    }
    Write-Success "Report directory ready: $ReportDir"

    # Build Playwright command
    Write-Header "Test Configuration"
    Write-Host "Test file:     $TestFile"
    Write-Host "Output dir:    $ReportDir"
    Write-Host "Headed mode:   $Headed"
    Write-Host "Chrome headed: $ChromeHeaded"
    Write-Host "Debug mode:    $Debug"
    Write-Host "Workers:       $Workers"
    if ($Filter) {
        Write-Host "Filter:        $Filter"
    }

    $PlaywrightArgs = @($TestFile)

    if ($Headed) {
        $PlaywrightArgs += "--headed"
    }

    if ($ChromeHeaded) {
        $PlaywrightArgs += "--headed"
        $PlaywrightArgs += "--project=chromium"
    }

    if ($Debug) {
        $PlaywrightArgs += "--debug"
    }

    if ($Workers -ne 1) {
        $PlaywrightArgs += "--workers=$Workers"
    }

    if ($Filter) {
        $PlaywrightArgs += "--grep", "'$Filter'"
    }

    $PlaywrightArgs += "--reporter=list"
    $PlaywrightArgs += "--reporter=html:$HtmlReport"
    $PlaywrightArgs += "--reporter=json:$JsonReport"

    Write-Header "Running Tests"
    Write-Info "Executing: npx playwright test $($PlaywrightArgs -join ' ')"

    # Run tests
    $testOutput = @()
    try {
        & npx playwright test @PlaywrightArgs 2>&1 | Tee-Object -Variable testOutput | Out-Host

        # Write to log file
        $testOutput | Out-File -FilePath $LogFile -Encoding utf8

        $testResult = $LASTEXITCODE
    } catch {
        Write-Error-Custom "Test execution failed: $_"
        $testResult = 1
    }

    # Print results
    Write-Header "Test Results"

    if ($testResult -eq 0) {
        Write-Success "All tests passed!"
    } else {
        Write-Error-Custom "Tests failed with exit code: $testResult"
    }

    # Show report location
    Write-Header "Reports Generated"
    Write-Host "📋 Text Log:     $LogFile"
    Write-Host "📊 JSON Report:  $JsonReport"
    Write-Host "🌐 HTML Report:  $HtmlReport"

    if (Test-Path $HtmlReport) {
        $absolutePath = (Get-Item $HtmlReport).FullName
        Write-Info "Open HTML report: file:///$absolutePath"
    }

    # Cleanup summary
    Write-Header "Test Execution Summary"

    if ($testResult -eq 0) {
        Write-Success "MAC address test suite completed successfully"
        Write-Host ""
        Write-Host "Test Coverage:"
        Write-Host "  ✓ MAC Address Creation (1.1-1.4)"
        Write-Host "  ✓ MAC Address Retrieval (2.1-2.4)"
        Write-Host "  ✓ MAC Address Updates (3.1-3.4)"
        Write-Host "  ✓ MAC Address Deletion (4.1-4.3)"
        Write-Host "  ✓ Validation & Error Handling (5.1-5.11)"
        Write-Host "  ✓ UI Interactions (6.1-6.10)"
        Write-Host ""
        Write-Host "Total Test Cases: 37+"
    } else {
        Write-Warning "Some tests failed. Review logs above for details."
        Write-Host ""
        Write-Host "Common issues:"
        Write-Host "  - Backend not running on :4000"
        Write-Host "  - Frontend not running on :3000"
        Write-Host "  - Database not initialized"
        Write-Host "  - Invalid test user credentials"
        Write-Host ""
        Write-Host "Troubleshooting:"
        Write-Host "  1. Check backend: Invoke-WebRequest http://localhost:4000/health"
        Write-Host "  2. Check frontend: Invoke-WebRequest http://localhost:3000"
        Write-Host "  3. Review full logs: Get-Content $LogFile"
        Write-Host "  4. Run with -Debug flag for verbose output"
    }

    Write-Host ""
    exit $testResult
}

# Run main
Main
