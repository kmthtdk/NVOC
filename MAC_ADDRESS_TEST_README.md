# MAC Address Functionality - Complete Test Suite

## Overview

This directory contains a comprehensive, production-ready test suite for MAC address functionality in the Device Management system. The suite includes 36 automated tests covering creation, retrieval, updates, deletion, validation, and UI interactions.

**Status**: ✅ Complete and Ready for Use
**Test Count**: 36 tests
**Execution Time**: 2-3 minutes
**Platforms**: Windows, macOS, Linux
**Last Updated**: 2026-06-23

---

## 📚 Documentation Index

### 1. **Quick Start Guide** - `MAC_ADDRESS_QUICK_START.md`
**Best for**: Developers who want to run tests immediately

- 30-second setup instructions
- One-liner commands for common tasks
- Test groups overview
- Quick troubleshooting
- Performance baselines

**Start here if**: You just want to run the tests now

---

### 2. **Complete Testing Guide** - `MAC_ADDRESS_TESTING_GUIDE.md`
**Best for**: Comprehensive setup and troubleshooting

- System requirements and prerequisites
- Step-by-step setup instructions
- Database initialization
- 6 methods to run tests
- Understanding test output
- Detailed troubleshooting (10+ solutions)
- Customization examples
- CI/CD integration

**Start here if**: You're setting up from scratch or troubleshooting issues

---

### 3. **Test Plan** - `MAC_ADDRESS_TEST_PLAN.md`
**Best for**: Understanding what's being tested and why

- Test objectives and scope
- Test environment setup
- 36 detailed test case specifications
- Validation rules
- Success criteria
- Known limitations

**Start here if**: You want to understand the testing strategy

---

### 4. **Test Cases Summary** - `MAC_ADDRESS_TEST_CASES_SUMMARY.md`
**Best for**: Detailed reference of each test case

- All 36 test cases documented
- Preconditions, actions, expected results
- Validation rules and assertions
- API endpoints and HTTP methods
- Test dependencies
- Result tracking templates

**Start here if**: You need details about a specific test

---

### 5. **Complete Summary** - `MAC_ADDRESS_TEST_SUITE_SUMMARY.md`
**Best for**: Executive overview and comprehensive reference

- Deliverables overview
- Test coverage matrix
- Quality metrics
- Integration examples
- Maintenance notes
- Complete file organization

**Start here if**: You want the big picture

---

## 🚀 Quick Start

### 30-Second Setup
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
npm run dev

# Terminal 3: Run tests
./run_mac_address_tests.sh
```

### Expected Output
```
✓ All MAC address functionality tests completed
36 tests passed, 0 failed
Execution time: ~2:30
```

---

## 📋 Test Organization

### Group 1: MAC Address Creation (4 tests)
- Create device with WiFi MAC
- Add Ethernet MAC to same device
- Verify both MACs in device details
- Add Bluetooth MAC

### Group 2: MAC Address Retrieval (4 tests)
- Get device by ID with MAC list
- Search device by serial number
- List devices and verify MACs
- Verify MAC ordering

### Group 3: MAC Address Updates (4 tests)
- Update MAC type (WiFi → Ethernet)
- Update MAC address
- Update both type and address
- Partial update (type only)

### Group 4: MAC Address Deletion (3 tests)
- Delete single MAC from multi-MAC device
- Delete last MAC from device
- Delete all MACs sequentially

### Group 5: Validation & Error Handling (11 tests)
- Invalid MAC format → 400
- Missing colons → 400
- Invalid hex → 400
- Invalid type → 400
- Non-existent device → 404
- Non-existent MAC → 404
- No authentication → 401
- Insufficient permissions → 403
- (+ 3 more device/MAC not found scenarios)

### Group 6: UI Interactions (10 tests)
- Login to frontend
- Navigate to Device Management
- Create device via UI
- Open device and view MACs
- Add new MAC via UI
- Edit existing MAC type
- Delete MAC from UI
- Validate error messages
- Save device form
- Cancel without saving

---

## 🔧 Execution Scripts

### Bash/Linux/macOS
**File**: `run_mac_address_tests.sh` (executable)

```bash
# All tests
./run_mac_address_tests.sh

# Specific group
./run_mac_address_tests.sh --group "MAC Address Creation"

# With browser visible
./run_mac_address_tests.sh --headed

# Interactive UI mode
./run_mac_address_tests.sh --ui

# With HTML report
./run_mac_address_tests.sh --report

# Debug mode
./run_mac_address_tests.sh --debug

# Help
./run_mac_address_tests.sh --help
```

### PowerShell/Windows
**File**: `run_mac_address_tests.ps1`

```powershell
# All tests
.\run_mac_address_tests.ps1

# Specific group
.\run_mac_address_tests.ps1 -Group "MAC Address Creation"

# With browser visible
.\run_mac_address_tests.ps1 -Headed

# Interactive UI mode
.\run_mac_address_tests.ps1 -UIMode

# With HTML report
.\run_mac_address_tests.ps1 -Report

# Debug mode
.\run_mac_address_tests.ps1 -Debug

# Help
.\run_mac_address_tests.ps1 -Help
```

### Direct Playwright Commands
```bash
# All tests
npx playwright test tests/mac-address.spec.ts

# Specific test
npx playwright test tests/mac-address.spec.ts -g "1.1"

# Interactive debugging
npx playwright test tests/mac-address.spec.ts --debug

# Headed mode
npx playwright test tests/mac-address.spec.ts --headed

# HTML report
npx playwright test tests/mac-address.spec.ts --reporter=html
npx playwright show-report
```

---

## 📊 Test File Details

### Main Test Suite
**File**: `tests/mac-address.spec.ts` (821 lines)

**Components**:
- Test configuration (API base, credentials)
- Type definitions (Device, MacAddress interfaces)
- Helper functions (login, device creation, MAC operations)
- 6 test groups with serial execution
- Cleanup and summary hooks

**Key Features**:
- Serial execution for state consistency
- Reusable helper functions
- Clear logging with [CONTEXT] prefixes
- Automatic test data generation
- Post-test cleanup

---

## ✅ Prerequisites Checklist

- [ ] Node.js 16+ installed
- [ ] npm 7+ installed
- [ ] MySQL 5.7+ running
- [ ] Database `n_voc_system` created
- [ ] Seed data applied (test users created)
- [ ] Backend running on http://localhost:4000
- [ ] Frontend running on http://localhost:3000

**Database Test Users**:
```
Email: admin@company.com / Password: Passw0rd!
Email: marcus.vance@company.com / Password: Passw0rd!
Email: alex.mercer@company.com / Password: Passw0rd!
```

---

## 🔍 Understanding Test Output

### Console Output
```
[SETUP] Authentication token captured
[DEVICE CREATE] Device ITA-2026-0001 (id=1) created
[MAC ADD] Added WiFi MAC (AA:BB:CC:DD:EE:FF) to device 1
✓ WiFi MAC created successfully
✓ Both MACs verified in device details
...
[MAC UPDATE] MAC 3 updated on device 1
✓ MAC type updated successfully
...
========== TEST CLEANUP ==========
Deleting test devices...
✓ Cleaned up device 1
========== TEST SUMMARY ==========
✓ All MAC address functionality tests completed
```

### Log File
- **File**: `mac-address-tests.log`
- **Contents**: All console output + timing information
- **Use**: Review for detailed test results and debugging

### HTML Report
- **Directory**: `playwright-report/`
- **Main file**: `index.html`
- **Contents**: Test timeline, screenshots, browser logs
- **Generation**: `./run_mac_address_tests.sh --report`

---

## 🛠️ Common Commands

| Goal | Command |
|------|---------|
| Run all tests | `./run_mac_address_tests.sh` |
| Watch execution | `./run_mac_address_tests.sh --ui` |
| See browser | `./run_mac_address_tests.sh --headed` |
| Specific group | `./run_mac_address_tests.sh --group "Creation"` |
| Generate report | `./run_mac_address_tests.sh --report` |
| Debug step-by-step | `./run_mac_address_tests.sh --debug` |
| Direct Playwright | `npx playwright test tests/mac-address.spec.ts` |
| Specific test | `npx playwright test -g "1.1"` |

---

## 🐛 Quick Troubleshooting

### Backend not responding
```bash
cd backend
npm install
npm run dev
# Check: curl http://localhost:4000/api/devices
```

### Database connection failed
```bash
# Verify MySQL is running
mysql -u root -p -e "SHOW DATABASES;"

# Check seeded users
mysql -u root -p n_voc_system -e "SELECT email FROM users;"

# Reseed if needed
mysql -u root -p n_voc_system < database/init/02_seed.sql
```

### Test timeout
```bash
# Check all services are running
curl http://localhost:4000/api/devices
curl http://localhost:3000

# Check database responsiveness
mysql -u root -p -e "SELECT 1;"
```

### Element not found (UI tests)
```bash
# Run with UI mode to inspect actual page
./run_mac_address_tests.sh --ui

# Or debug mode
./run_mac_address_tests.sh --debug
```

**For more**: See `MAC_ADDRESS_TESTING_GUIDE.md` Troubleshooting section

---

## 📈 Performance Baselines

| Component | Expected | Note |
|-----------|----------|------|
| API test | < 2 seconds | Per test |
| UI test | 3-5 seconds | Per test (minus login/nav) |
| Full suite | < 3 minutes | With cleanup |
| Group 1-5 | ~70 seconds | API tests only |
| Group 6 | ~45 seconds | UI tests only |

---

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install dependencies
  run: npm install && cd backend && npm install

- name: Run MAC Address Tests
  run: ./run_mac_address_tests.sh --report

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v2
  with:
    name: test-report
    path: playwright-report/
```

### Pre-commit Hook Example
```bash
#!/bin/bash
# .git/hooks/pre-commit
npx playwright test tests/mac-address.spec.ts --exit-code=1
```

---

## 📖 How to Use This Suite

### For Developers
1. Start with **Quick Start Guide** (`MAC_ADDRESS_QUICK_START.md`)
2. Run tests with `./run_mac_address_tests.sh`
3. Check logs in `mac-address-tests.log`
4. Review any failures in the guide's troubleshooting section

### For QA Engineers
1. Read **Test Plan** (`MAC_ADDRESS_TEST_PLAN.md`)
2. Review **Test Cases** (`MAC_ADDRESS_TEST_CASES_SUMMARY.md`)
3. Execute tests with `./run_mac_address_tests.sh --report`
4. Analyze HTML report in `playwright-report/`
5. Document results using provided template

### For DevOps/CI Engineers
1. Read **Complete Guide** (`MAC_ADDRESS_TESTING_GUIDE.md`)
2. Check **CI/CD Integration** section
3. Set up GitHub Actions or equivalent
4. Configure test execution in pipeline
5. Add artifact uploading for reports

### For New Team Members
1. Start with **Quick Start** (`MAC_ADDRESS_QUICK_START.md`)
2. Run tests to get familiar with the system
3. Read **Test Plan** to understand coverage
4. Review **Test Cases** for detailed specifications
5. Ask questions - documentation is comprehensive!

---

## 🎯 Success Criteria

✅ All 36 tests pass
✅ Execution time < 3 minutes
✅ No database errors
✅ No authentication issues
✅ HTML report generates successfully
✅ Log file captures all output
✅ Cleanup executes without errors

---

## 📝 Test Maintenance

### Regular Tasks
- **Weekly**: Run full test suite to catch regressions
- **Per Release**: Ensure all tests pass before deployment
- **On Changes**: Update tests when API/UI changes
- **Monthly**: Review test logs for patterns or issues

### When Tests Fail
1. Check the test output for [CONTEXT] markers
2. Review `mac-address-tests.log` for details
3. Run failed test in isolation with `--debug`
4. Verify prerequisites are met
5. Check service logs for errors

### Updating Tests
- Credentials: Edit `TEST_USERS` in `tests/mac-address.spec.ts`
- API URL: Edit `API_BASE` and `FRONTEND_BASE`
- Selectors: Update in UI test section (Group 6)
- Validation rules: Check test assertions

---

## 🔗 File Structure

```
├── tests/
│   └── mac-address.spec.ts                    # Main test suite
├── run_mac_address_tests.sh                   # Bash execution script
├── run_mac_address_tests.ps1                  # PowerShell script
├── MAC_ADDRESS_QUICK_START.md                 # Quick reference
├── MAC_ADDRESS_TESTING_GUIDE.md               # Complete guide
├── MAC_ADDRESS_TEST_PLAN.md                   # Test strategy
├── MAC_ADDRESS_TEST_CASES_SUMMARY.md          # Test specs
├── MAC_ADDRESS_TEST_SUITE_SUMMARY.md          # Full summary
└── MAC_ADDRESS_TEST_README.md                 # This file
```

---

## 💡 Tips & Best Practices

### Running Tests Efficiently
- Use `--group` to run specific test groups
- Use `--ui` mode during development for visibility
- Run API tests (`--group "Creation"` through `"Handling"`) for quick feedback
- Run full suite before committing code

### Debugging Issues
- Run with `--debug` flag for step-by-step execution
- Use `--headed` to see browser interactions
- Check `mac-address-tests.log` for detailed output
- Increase timeouts if running on slow hardware

### Customizing for Your Environment
- Update credentials in test file if using different users
- Change API URL if deploying to different server
- Adjust selectors if UI components differ
- Modify test data as needed for your database

---

## 📞 Support & Resources

### Documentation Files (Read in Order)
1. `MAC_ADDRESS_QUICK_START.md` - Start here for quick setup
2. `MAC_ADDRESS_TESTING_GUIDE.md` - For detailed guidance
3. `MAC_ADDRESS_TEST_PLAN.md` - For test strategy
4. `MAC_ADDRESS_TEST_CASES_SUMMARY.md` - For specific tests
5. `MAC_ADDRESS_TEST_SUITE_SUMMARY.md` - For comprehensive overview

### Getting Help
1. **Quick questions**: Check `MAC_ADDRESS_QUICK_START.md`
2. **Setup issues**: See `MAC_ADDRESS_TESTING_GUIDE.md` troubleshooting
3. **Test details**: Review `MAC_ADDRESS_TEST_CASES_SUMMARY.md`
4. **Test strategy**: Consult `MAC_ADDRESS_TEST_PLAN.md`
5. **Command help**: Run `./run_mac_address_tests.sh --help`

---

## 📊 Execution Checklist

### Before Running
- [ ] All services running (backend, frontend, database)
- [ ] Database initialized with seed data
- [ ] npm dependencies installed
- [ ] Test file exists and is readable
- [ ] Scripts have execute permissions

### During Execution
- [ ] Console shows [CONTEXT] prefixed messages
- [ ] No "connection refused" errors
- [ ] Tests progress without hanging
- [ ] Database updates visible in logs

### After Execution
- [ ] All 36 tests reported
- [ ] `mac-address-tests.log` generated
- [ ] Test cleanup completed successfully
- [ ] Results displayed in summary

---

## 🎓 Learning Resources

### Understanding the Test Suite
- Playwright documentation: https://playwright.dev
- Jest/Test patterns: https://jestjs.io
- API testing best practices: https://www.postman.com/resources/
- Database testing: https://github.com/testcontainers

### Backend API Reference
- Check `backend/README.md` for API endpoints
- Review `backend/src/routes` for endpoint definitions
- Check `backend/src/controllers` for validation logic

### Frontend Implementation
- Check `src/components/DeviceFormModal` for UI components
- Review form handling in component code
- Check validation in frontend form logic

---

## 🚀 Getting Started Right Now

```bash
# 1. Open 3 terminals

# Terminal 1: Start Backend
cd backend && npm run dev

# Terminal 2: Start Frontend  
npm run dev

# Terminal 3: Run Tests
./run_mac_address_tests.sh

# Watch the output - tests run serially
# Should complete in ~2-3 minutes
# All 36 tests should pass
```

**That's it!** You're now running the complete MAC address test suite.

---

## 📜 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-23 | Initial comprehensive test suite release |

---

## 📄 License & Attribution

This test suite was created as a comprehensive QA automation solution for MAC address functionality testing. Use freely within your organization.

---

**Last Updated**: 2026-06-23
**Status**: ✅ Complete and Production-Ready
**Test Count**: 36
**Documentation Pages**: 5 + This README
