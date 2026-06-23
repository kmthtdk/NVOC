# MAC Address Testing - Quick Start Guide

## 30-Second Setup

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
npm run dev

# Terminal 3: Tests
./run_mac_address_tests.sh
# OR on Windows:
.\run_mac_address_tests.ps1
```

Expected: All 36 tests pass in ~2-3 minutes.

---

## One-Liner Commands

```bash
# Run all tests
npx playwright test tests/mac-address.spec.ts

# Run tests in UI mode (watch execution)
npx playwright test tests/mac-address.spec.ts --ui

# Run creation tests only
npx playwright test tests/mac-address.spec.ts -g "Creation"

# Run with visible browser
npx playwright test tests/mac-address.spec.ts --headed

# Generate HTML report
npx playwright test tests/mac-address.spec.ts --reporter=html && npx playwright show-report

# Debug mode (step through)
npx playwright test tests/mac-address.spec.ts --debug

# Specific test
npx playwright test tests/mac-address.spec.ts -g "1.1"
```

---

## Test Groups Quick Reference

| Group | Tests | Time | Focus |
|-------|-------|------|-------|
| 1. Creation | 4 | 10s | Device + MAC creation |
| 2. Retrieval | 4 | 8s | Get, search, list endpoints |
| 3. Updates | 4 | 10s | Type/address changes |
| 4. Deletion | 3 | 8s | Remove MACs, keep device |
| 5. Validation | 11 | 15s | Error codes, auth checks |
| 6. UI | 10 | 30-45s | Form interactions |

**Total**: 36 tests, ~2-3 minutes

---

## Troubleshooting

### Backend not running?
```bash
cd backend
npm install
npm run dev
# Check: curl http://localhost:4000/api/devices
```

### Frontend not running?
```bash
npm install
npm run dev
# Check: curl http://localhost:3000
```

### Tests timeout?
```bash
# Check connectivity
curl http://localhost:4000/api/devices
curl http://localhost:3000

# Ensure database is responsive
mysql -u root -p -e "USE n_voc_system; SELECT COUNT(*) FROM users;"
```

### Playwright not installed?
```bash
npm install @playwright/test --save-dev
npx playwright install
```

### Invalid credentials?
```bash
# Verify seeded users in database
mysql -u root -p -e "USE n_voc_system; SELECT email FROM users;"

# Expected users:
# - admin@company.com
# - marcus.vance@company.com
# - alex.mercer@company.com
```

---

## Test File Locations

```
tests/
└── mac-address.spec.ts          # Main test suite (36 tests)

Documentation:
├── MAC_ADDRESS_TEST_PLAN.md     # Detailed test plan (6 groups)
├── MAC_ADDRESS_TESTING_GUIDE.md # Full setup & execution guide
├── MAC_ADDRESS_TEST_CASES_SUMMARY.md # All 36 test specs
└── MAC_ADDRESS_QUICK_START.md   # This file

Execution Scripts:
├── run_mac_address_tests.sh     # Bash/Linux/macOS
└── run_mac_address_tests.ps1    # PowerShell/Windows
```

---

## Test Architecture

### API Tests (26 tests)
- Groups 1-5: ~1-2 seconds each
- Direct HTTP requests to backend
- No browser needed
- Run serially for state consistency

### UI Tests (10 tests)
- Group 6: ~3-5 seconds each (except login/nav: 5-8s)
- Browser automation with Playwright
- Interact with React frontend
- Depend on API being functional

### Test Data
- Unique serial numbers: `SN-TEST-{timestamp}-{random}`
- Authentication: JWT tokens from /api/auth/login
- Cleanup: Devices deleted after test completion

---

## Common Issues & Solutions

### ❌ "Connection refused"
```bash
# Backend/Frontend not running
cd backend && npm run dev &  # Background
npm run dev &               # Background
sleep 3
./run_mac_address_tests.sh
```

### ❌ "Invalid credentials"
```bash
# Database seed missing
mysql -u root -p n_voc_system < database/init/02_seed.sql
```

### ❌ "Element not found" (UI tests)
```bash
# Run with UI mode to inspect
npx playwright test tests/mac-address.spec.ts --ui
# Update selectors in test file if needed
```

### ❌ "Test timeout"
```bash
# Services too slow, check:
# 1. CPU usage (top, Task Manager)
# 2. Memory (free -h, Get-Process)
# 3. Database (mysql status)
# 4. Network connectivity
```

### ❌ "MAC validation fails"
```bash
# Check backend MAC validation rules
grep -n "macAddress" backend/src/controllers/device.controller.ts
# Verify format: XX:XX:XX:XX:XX:XX (MAC address regex)
```

---

## Test Results Interpretation

### Successful Run
```
✓ All MAC address functionality tests completed
Review logs above for detailed test results

Summary: 36 passed, 0 failed
```

### Failed Test Example
```
✗ 3.1: Update MAC type (WiFi → Ethernet)
  Error: expect(mac.macType).toBe('Ethernet')
         Expected "WiFi", got "Ethernet"

Solution: Check backend PUT /devices/{id}/mac/{macId} handler
```

### Partial Failures (e.g., 1 group failing)
```
Group 6 (UI tests) failing:
  ✗ 6.4 - Open device and view existing MACs
  ✗ 6.5 - Add new MAC via UI

Likely cause: DOM selector mismatch
Solution: Run with --ui mode to inspect, update selectors
```

---

## Performance Baselines

| Component | Expected | Action if Slower |
|-----------|----------|------------------|
| API call | <200ms | Check backend logs |
| UI render | <1s | Check browser performance |
| Test group | <20s | Profile with --debug |
| Full suite | <3min | Identify slow tests, optimize |

---

## Debug Mode Usage

```bash
npx playwright test tests/mac-address.spec.ts --debug

# In debug mode:
# - Step through tests line by line
# - Inspect variables
# - Take screenshots
# - View DOM in browser DevTools
# Press 'c' to continue, 's' to step over, etc.
```

---

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run MAC tests
  run: ./run_mac_address_tests.sh --report

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v2
  with:
    name: test-report
    path: playwright-report
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
npx playwright test tests/mac-address.spec.ts --exit-code=1
```

---

## Test Modification Examples

### Changing Test Credentials
```typescript
// tests/mac-address.spec.ts, line 30-34
const TEST_USERS = {
  admin: { email: 'your-email@company.com', password: 'YourPassword!' },
  // ...
};
```

### Changing API Base URL
```typescript
// tests/mac-address.spec.ts, line 26-27
const API_BASE = 'http://your-server.com/api';
const FRONTEND_BASE = 'http://your-server.com';
```

### Filtering Tests by Name
```bash
# Exact match
npx playwright test tests/mac-address.spec.ts -g "^1.1$"

# Partial match
npx playwright test tests/mac-address.spec.ts -g "WiFi"

# Regex
npx playwright test tests/mac-address.spec.ts -g "1\\.[1-2]"
```

---

## Useful Grep Commands

### Find all test names
```bash
grep "test('" tests/mac-address.spec.ts | head -20
```

### Find API endpoints used
```bash
grep -o "/${API_BASE}/[^']\\+" tests/mac-address.spec.ts | sort -u
```

### Find validation checks
```bash
grep "expect(" tests/mac-address.spec.ts | wc -l
# Shows total assertions in tests
```

---

## Browser Console Inspection

### While Tests Run
```bash
# In another terminal, during test execution:
nvm use 18  # Ensure Node 18+
node -e "require('open')('about:blank')"  # Open DevTools

# OR use --ui mode:
npx playwright test tests/mac-address.spec.ts --ui
# Browser DevTools available in UI
```

### Capture Network Logs
```bash
npx playwright test tests/mac-address.spec.ts --reporter=json:results.json
# Analyze results.json for API calls and responses
```

---

## Test Maintenance Checklist

- [ ] Run tests weekly
- [ ] Update test data if DB schema changes
- [ ] Review failing tests immediately
- [ ] Update selectors if UI changes
- [ ] Document new MAC types in validation tests
- [ ] Keep test file in version control
- [ ] Tag releases with test version

---

## Reference Links

- **Test File**: `tests/mac-address.spec.ts`
- **Full Guide**: `MAC_ADDRESS_TESTING_GUIDE.md`
- **Test Plan**: `MAC_ADDRESS_TEST_PLAN.md`
- **Test Cases**: `MAC_ADDRESS_TEST_CASES_SUMMARY.md`
- **Backend**: `backend/README.md`
- **Playwright Docs**: https://playwright.dev
- **API Reference**: Check backend API docs

---

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/login | Get JWT token |
| POST | /api/devices | Create device |
| GET | /api/devices/{id} | Get device details |
| GET | /api/devices/search?serial=... | Search by serial |
| POST | /api/devices/{id}/mac | Add MAC to device |
| PUT | /api/devices/{id}/mac/{macId} | Update MAC |
| DELETE | /api/devices/{id}/mac/{macId} | Delete MAC |

---

## Example Test Output

```log
[SETUP] Authentication token captured
[DEVICE CREATE] Device ITA-2026-0001 (id=1) created
[MAC ADD] Added WiFi MAC (AA:BB:CC:DD:EE:FF) to device 1
[MAC ADD] Added Ethernet MAC (11:22:33:44:55:66) to device 1
✓ WiFi MAC created successfully
✓ Ethernet MAC created successfully
✓ Both MACs verified in device details
✓ Bluetooth MAC created successfully

[DEVICE CREATE] Device ITA-2026-0002 (id=2) created
[MAC ADD] Added Ethernet MAC (AA:BB:CC:DD:EE:FF) to device 2
[MAC ADD] Added WiFi MAC (11:22:33:44:55:66) to device 2
✓ Device retrieved with complete MAC list
✓ Device search returns MAC addresses
✓ Device found in list. macAddresses included: true
✓ MACs ordered by createdAt DESC

[DEVICE CREATE] Device ITA-2026-0003 (id=3) created
[MAC ADD] Added Ethernet MAC (AA:BB:CC:DD:EE:FF) to device 3
[MAC ADD] Added WiFi MAC (11:22:33:44:55:66) to device 3
[MAC UPDATE] MAC 6 updated on device 3
✓ MAC type updated successfully
✓ MAC address updated successfully
✓ Both MAC type and address updated
✓ Partial update (type only) successful

[DEVICE CREATE] Device ITA-2026-0004 (id=4) created
[MAC ADD] Added Ethernet MAC (AA:BB:CC:DD:EE:FF) to device 4
[MAC ADD] Added WiFi MAC (11:22:33:44:55:66) to device 4
[MAC DELETE] MAC 9 deleted from device 4
✓ Single MAC deleted, other MAC remains
✓ Last MAC deleted, device persists with empty MAC list
✓ All MACs deleted sequentially, device remains

✓ Invalid MAC format returns 400 VALIDATION_ERROR
✓ MAC without colons rejected with 400
✓ Invalid hex characters rejected with 400
✓ Invalid MAC type returns 400
✓ Non-existent device returns 404
✓ Update on non-existent device returns 404
✓ Non-existent MAC returns 404
✓ Delete from non-existent device returns 404
✓ Delete non-existent MAC returns 404
✓ Request without token returns 401
✓ Non-admin role returns 403 Forbidden

✓ Logged in successfully
✓ Navigated to Device Management
✓ Device created via UI
✓ Device modal loaded with existing MACs
✓ New MAC added via UI
✓ MAC type updated via UI
✓ MAC deleted via UI
✓ Validation error displayed for invalid MAC format
✓ Device form saved successfully
✓ Modal closed without persisting changes

========== TEST CLEANUP ==========
Deleting test devices...
✓ Cleaned up device 1

========== TEST SUMMARY ==========
✓ All MAC address functionality tests completed
Review logs above for detailed test results
```

---

## When to Run Tests

- **Before commit**: `./run_mac_address_tests.sh`
- **Before PR**: `./run_mac_address_tests.sh --report`
- **On CI/CD**: Auto-run on push/PR
- **After changes**: If you modify API endpoints or UI
- **Before release**: Full regression test suite
- **During development**: `npx playwright test --ui`

---

## Support

For detailed help:
1. Check `MAC_ADDRESS_TESTING_GUIDE.md` (full setup)
2. Review `MAC_ADDRESS_TEST_PLAN.md` (test structure)
3. Check `MAC_ADDRESS_TEST_CASES_SUMMARY.md` (individual tests)
4. Run `./run_mac_address_tests.sh --help` (script options)

---

**Last Updated**: 2026-06-23
**Test Count**: 36
**Coverage**: MAC Address CRUD, validation, UI interactions, error handling
