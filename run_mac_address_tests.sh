#!/bin/bash

################################################################################
# MAC Address Functionality - Comprehensive Test Execution Script
#
# This script runs the complete MAC address test suite using Playwright
# Prerequisites:
#   - Backend running on http://localhost:4000
#   - Frontend running on http://localhost:3000
#   - MySQL database initialized with seed data
#   - npm dependencies installed
#
# Usage:
#   ./run_mac_address_tests.sh [options]
#
# Options:
#   --ui              Run with Playwright UI mode
#   --headed          Run in headed (browser visible) mode
#   --group <name>    Run only tests matching group name
#   --report          Generate HTML report after tests
#   --debug           Enable debug logging
#   --help            Show this help message
#
################################################################################

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
TEST_FILE="tests/mac-address.spec.ts"
REPORT_DIR="playwright-report"
TEST_LOG_FILE="mac-address-tests.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Options
UI_MODE=false
HEADED_MODE=false
FILTER_GROUP=""
GENERATE_REPORT=false
DEBUG_MODE=false

################################################################################
# Functions
################################################################################

print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
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

show_help() {
  grep "^# " "$0" | head -20
}

check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check if npm is installed
  if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
  fi
  print_success "npm is installed"

  # Check if backend is running
  print_info "Checking backend connectivity to ${BACKEND_URL}..."
  if curl -s "${BACKEND_URL}/health" > /dev/null 2>&1 || curl -s "${BACKEND_URL}/api/devices" > /dev/null 2>&1; then
    print_success "Backend is running"
  else
    print_warning "Backend at ${BACKEND_URL} may not be responding (this may be okay if health check endpoint doesn't exist)"
  fi

  # Check if frontend is running
  print_info "Checking frontend connectivity to ${FRONTEND_URL}..."
  if curl -s "${FRONTEND_URL}" > /dev/null 2>&1; then
    print_success "Frontend is running"
  else
    print_warning "Frontend at ${FRONTEND_URL} may not be responding yet"
  fi

  # Check if Playwright is installed
  if [ -d "${PROJECT_DIR}/node_modules/@playwright/test" ]; then
    print_success "Playwright is installed"
  else
    print_warning "Playwright not found in node_modules, attempting to install..."
    cd "${PROJECT_DIR}"
    npm install @playwright/test --save-dev
    print_success "Playwright installed"
  fi

  # Check if test file exists
  if [ -f "${PROJECT_DIR}/${TEST_FILE}" ]; then
    print_success "Test file found: ${TEST_FILE}"
  else
    print_error "Test file not found: ${TEST_FILE}"
    exit 1
  fi
}

install_dependencies() {
  print_header "Installing/Verifying Dependencies"

  cd "${PROJECT_DIR}"

  if [ ! -d "node_modules" ]; then
    print_info "node_modules not found, installing dependencies..."
    npm install
    print_success "Dependencies installed"
  else
    print_success "node_modules exists"
  fi

  # Ensure Playwright browsers are installed
  if ! npx playwright install &> /dev/null; then
    print_warning "Playwright browser installation may have failed (this might be acceptable)"
  else
    print_success "Playwright browsers verified"
  fi
}

build_test_command() {
  local cmd="npx playwright test ${TEST_FILE}"

  if [ "${UI_MODE}" = true ]; then
    cmd="${cmd} --ui"
  fi

  if [ "${HEADED_MODE}" = true ]; then
    cmd="${cmd} --headed"
  fi

  if [ -n "${FILTER_GROUP}" ]; then
    cmd="${cmd} -g '${FILTER_GROUP}'"
  fi

  if [ "${DEBUG_MODE}" = true ]; then
    cmd="${cmd} --debug"
  fi

  # Add reporter configuration
  cmd="${cmd} --reporter=list --reporter=json:${REPORT_DIR}/results.json"

  echo "${cmd}"
}

run_tests() {
  print_header "Running MAC Address Test Suite"

  cd "${PROJECT_DIR}"

  print_info "Test execution started at $(date)"
  print_info "Backend: ${BACKEND_URL}"
  print_info "Frontend: ${FRONTEND_URL}"
  print_info "Test file: ${TEST_FILE}"

  if [ -n "${FILTER_GROUP}" ]; then
    print_info "Running tests matching: ${FILTER_GROUP}"
  fi

  echo ""

  # Build and run the test command
  local test_cmd=$(build_test_command)

  # Execute tests and capture output
  if eval "${test_cmd}" 2>&1 | tee "${TEST_LOG_FILE}"; then
    local exit_code=0
  else
    local exit_code=$?
  fi

  echo ""
  print_info "Test execution completed at $(date)"

  return ${exit_code}
}

parse_test_results() {
  print_header "Test Results Summary"

  if [ -f "${TEST_LOG_FILE}" ]; then
    # Extract test summary
    local passed=$(grep -c "✓" "${TEST_LOG_FILE}" || echo "0")
    local failed=$(grep -c "✗" "${TEST_LOG_FILE}" || echo "0")

    print_info "Tests passed: ${passed}"
    print_info "Tests failed: ${failed}"

    # Show any failures
    if grep -q "FAIL" "${TEST_LOG_FILE}"; then
      print_warning "Some tests failed - review details below:"
      echo ""
      grep -A 5 "FAIL" "${TEST_LOG_FILE}" || true
    fi
  fi
}

generate_html_report() {
  print_header "Generating HTML Report"

  cd "${PROJECT_DIR}"

  if [ -f "${REPORT_DIR}/results.json" ]; then
    print_info "Generating HTML report..."
    npx playwright show-report "${REPORT_DIR}" || true
    print_success "HTML report generated in ${REPORT_DIR}/"
    print_info "Open in browser: file://${PROJECT_DIR}/${REPORT_DIR}/index.html"
  else
    print_warning "No test results JSON found (--reporter=json not used)"
  fi
}

show_execution_summary() {
  print_header "Execution Summary"

  print_info "Test log saved to: ${TEST_LOG_FILE}"

  if [ "${GENERATE_REPORT}" = true ]; then
    print_info "HTML report saved to: ${REPORT_DIR}/"
  fi

  print_info "Execution timestamp: ${TIMESTAMP}"
}

cleanup() {
  print_info "Cleaning up temporary files..."
  # Add any cleanup as needed
}

main() {
  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --ui)
        UI_MODE=true
        shift
        ;;
      --headed)
        HEADED_MODE=true
        shift
        ;;
      --group)
        FILTER_GROUP="$2"
        shift 2
        ;;
      --report)
        GENERATE_REPORT=true
        shift
        ;;
      --debug)
        DEBUG_MODE=true
        shift
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # Execute main workflow
  check_prerequisites
  install_dependencies

  # Run tests
  if run_tests; then
    TEST_EXIT_CODE=0
    print_success "All tests completed successfully"
  else
    TEST_EXIT_CODE=$?
    print_error "Some tests failed (exit code: ${TEST_EXIT_CODE})"
  fi

  # Post-test actions
  parse_test_results

  if [ "${GENERATE_REPORT}" = true ]; then
    generate_html_report
  fi

  show_execution_summary
  cleanup

  exit ${TEST_EXIT_CODE}
}

# Run main function
main "$@"
