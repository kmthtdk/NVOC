#!/bin/bash

##############################################################################
# MAC Address Test Suite Runner
#
# Purpose: Execute comprehensive MAC address functionality tests using
#          Playwright with detailed logging
#
# Usage:   ./run_mac_tests.sh [options]
#
# Options:
#   --headed          Run tests in headed mode (see browser)
#   --headed-chrome   Run tests in Chrome headed mode
#   --debug           Enable debug mode (verbose logging)
#   --workers N       Run N tests in parallel (default: 1, serial)
#   --filter PATTERN  Run only tests matching PATTERN
#
# Prerequisites:
#   - Backend running on http://localhost:4000
#   - Frontend running on http://localhost:3000
#   - Node.js and npm installed
#   - npx available (for running Playwright)
#
# Example runs:
#   ./run_mac_tests.sh                          # Standard run (serial)
#   ./run_mac_tests.sh --headed                 # See browser during tests
#   ./run_mac_tests.sh --filter "Creation"      # Only Creation tests
#   ./run_mac_tests.sh --debug --headed         # Debug + headed mode
#
##############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_FILE="tests/mac-address.spec.ts"
REPORT_DIR="test-results"
LOG_FILE="${REPORT_DIR}/mac-address-test.log"
JSON_REPORT="${REPORT_DIR}/mac-address-report.json"
HTML_REPORT="${REPORT_DIR}/index.html"

# Parse command line arguments
HEADED=false
DEBUG=false
WORKERS=1
FILTER=""
CHROME_HEADED=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      HEADED=true
      shift
      ;;
    --headed-chrome)
      CHROME_HEADED=true
      shift
      ;;
    --debug)
      DEBUG=true
      shift
      ;;
    --workers)
      WORKERS="$2"
      shift 2
      ;;
    --filter)
      FILTER="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Functions
print_header() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Main execution
main() {
  print_header "MAC Address Test Suite"

  # Check prerequisites
  print_info "Checking prerequisites..."

  if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install Node.js"
    exit 1
  fi

  if ! command -v npx &> /dev/null; then
    print_error "npx not found. Please install Node.js"
    exit 1
  fi

  # Check if servers are running
  print_info "Verifying backend connectivity..."
  if ! curl -s http://localhost:4000/health > /dev/null 2>&1; then
    print_error "Backend not responding on http://localhost:4000"
    print_info "Start backend with: cd backend && npm run dev"
    exit 1
  fi
  print_success "Backend is running"

  print_info "Verifying frontend connectivity..."
  if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_error "Frontend not responding on http://localhost:3000"
    print_info "Start frontend with: npm run dev"
    exit 1
  fi
  print_success "Frontend is running"

  # Create report directory
  mkdir -p "${REPORT_DIR}"
  print_success "Created report directory: ${REPORT_DIR}"

  # Build Playwright command
  print_header "Test Configuration"
  echo "Test file:     ${TEST_FILE}"
  echo "Output dir:    ${REPORT_DIR}"
  echo "Headed mode:   ${HEADED}"
  echo "Chrome headed: ${CHROME_HEADED}"
  echo "Debug mode:    ${DEBUG}"
  echo "Workers:       ${WORKERS}"
  if [ -n "${FILTER}" ]; then
    echo "Filter:        ${FILTER}"
  fi

  PLAYWRIGHT_CMD="npx playwright test ${TEST_FILE}"

  # Add configuration options
  if [ "${HEADED}" = true ]; then
    PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --headed"
  fi

  if [ "${CHROME_HEADED}" = true ]; then
    PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --headed --project=chromium"
  fi

  if [ "${DEBUG}" = true ]; then
    PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --debug"
  fi

  if [ "${WORKERS}" != "1" ]; then
    PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --workers=${WORKERS}"
  fi

  if [ -n "${FILTER}" ]; then
    PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --grep '${FILTER}'"
  fi

  # Add reporters
  PLAYWRIGHT_CMD="${PLAYWRIGHT_CMD} --reporter=list --reporter=html:${HTML_REPORT} --reporter=json:${JSON_REPORT}"

  print_header "Running Tests"
  print_info "Command: ${PLAYWRIGHT_CMD}"

  # Run tests with tee to both console and log file
  set +e
  eval "${PLAYWRIGHT_CMD}" 2>&1 | tee "${LOG_FILE}"
  TEST_RESULT=$?
  set -e

  # Print results
  print_header "Test Results"

  if [ ${TEST_RESULT} -eq 0 ]; then
    print_success "All tests passed!"
  else
    print_error "Tests failed with exit code: ${TEST_RESULT}"
  fi

  # Show report location
  print_header "Reports Generated"
  echo "📋 Text Log:     ${LOG_FILE}"
  echo "📊 JSON Report:  ${JSON_REPORT}"
  echo "🌐 HTML Report:  ${HTML_REPORT}"

  if [ -f "${HTML_REPORT}" ]; then
    print_info "Open HTML report: file://${PWD}/${HTML_REPORT}"
  fi

  # Cleanup summary
  print_header "Test Execution Summary"
  if [ ${TEST_RESULT} -eq 0 ]; then
    print_success "MAC address test suite completed successfully"
    echo ""
    echo "Test Coverage:"
    echo "  ✓ MAC Address Creation (1.1-1.4)"
    echo "  ✓ MAC Address Retrieval (2.1-2.4)"
    echo "  ✓ MAC Address Updates (3.1-3.4)"
    echo "  ✓ MAC Address Deletion (4.1-4.3)"
    echo "  ✓ Validation & Error Handling (5.1-5.11)"
    echo "  ✓ UI Interactions (6.1-6.10)"
    echo ""
    echo "Total Test Cases: 37+"
  else
    print_warning "Some tests failed. Review logs above for details."
    echo ""
    echo "Common issues:"
    echo "  - Backend not running on :4000"
    echo "  - Frontend not running on :3000"
    echo "  - Database not initialized"
    echo "  - Invalid test user credentials"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check backend: curl http://localhost:4000/health"
    echo "  2. Check frontend: curl http://localhost:3000"
    echo "  3. Review full logs: cat ${LOG_FILE}"
    echo "  4. Run with --debug flag for verbose output"
  fi

  echo ""
  return ${TEST_RESULT}
}

# Run main
main "$@"
exit $?
