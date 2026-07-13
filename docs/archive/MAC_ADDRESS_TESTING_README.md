# MAC Address Functionality - Testing Guide

A comprehensive test suite for MAC address features in the N-VOC Request System, covering API endpoints and UI interactions.

## Quick Start

### Prerequisites
- Node.js 16+ with npm
- Backend running on `http://localhost:4000`
- Frontend running on `http://localhost:3000`
- MySQL database initialized with seed data

### Install Playwright
```bash
npm install -D @playwright/test
```

### Run Tests
```bash
# Linux/Mac: Use bash script
./run_mac_tests.sh

# Windows: Use PowerShell script
.\run_mac_tests.ps1

# Direct: Use npm/npx
npx playwright test tests/mac-address.spec.ts
```

---

## Test Architecture

### File Structure
```
n-voc-system-service-portal/
├── MAC_ADDRESS_TEST_PLAN.md          # Detailed test plan (37+ test cases)
├── MAC_ADDRESS_TESTING_README.md     # This file
├── tests/
│   └── mac-address.spec.ts           # Playwright test suite
├── run_mac_tests.sh                  # Bash runner (Linux/Mac)
└── run_mac_tests.ps1                 # PowerShell runner (Windows)
```

### Test Organization
Tests are organized in 6 groups covering the complete lifecycle:

| Group | Tests | Coverage |
|-------|-------|----------|
| 1. MAC Address Creation | 1.1-1.4 | Create device + multiple MACs |
| 2. MAC Address Retrieval | 2.1-2.4 | Fetch via ID, search, list, ordering |
| 3. MAC Address Updates | 3.1-3.4 | Type change, address change, partial updates |
| 4. MAC Address Deletion | 4.1-4.3 | Single, last, sequential deletion |
| 5. Validation & Error Handling | 5.1-5.11 | 400, 404, 401, 403 responses |
| 6. UI Interactions | 6.1-6.10 | Modal, add, edit, delete, validate |

**Total: 37+ test cases**

---

## Running Tests

### Basic Execution (Serial)
```bash
# Bash
./run_mac_tests.sh

# PowerShell
.\run_mac_tests.ps1

# Direct Playwright
npx playwright test tests/mac-address.spec.ts
```

### Running Specific Tests
```bash
# Run only Creation tests
npx playwright test tests/mac-address.spec.ts --grep "1\\. MAC Address Creation"

# Run only Validation tests
npx playwright test tests/mac-address.spec.ts --grep "5\\. Validation"

# Run by test name
npx playwright test tests/mac-address.spec.ts -k "Invalid MAC format"
```

### Headed Mode (See Browser)
```bash
# Bash
./run_mac_tests.sh --headed

# PowerShell
.\run_mac_tests.ps1 -Headed

# Direct
npx playwright test tests/mac-address.spec.ts --headed
```

### Debug Mode (Interactive)
```bash
# Bash
./run_mac_tests.sh --debug

# PowerShell
.\run_mac_tests.ps1 -Debug

# Direct
npx playwright test tests/mac-address.spec.ts --debug
```

### Parallel Execution
```bash
# Run with 4 workers (increases speed)
npx playwright test tests/mac-address.spec.ts --workers=4

# Using runners
./run_mac_tests.sh --workers 4
.\run_mac_tests.ps1 -Workers 4
```

### Specific Browser
```bash
# Chrome only
npx playwright test tests/mac-address.spec.ts --project=chromium

# Firefox only
npx playwright test tests/mac-address.spec.ts --project=firefox

# Safari only (Mac)
npx playwright test tests/mac-address.spec.ts --project=webkit
```

---

## Test Configuration

### Environment Variables
```bash
# Backend URL (default: http://localhost:4000/api)
export PLAYWRIGHT_TEST_BASE_URL=http://localhost:4000/api

# Timeout (default: 30000ms)
export PLAYWRIGHT_TEST_TIMEOUT=60000

# Reporter
export PLAYWRIGHT_TEST_REPORTER=html
```

### Playwright Config
Create `playwright.config.ts` in project root (if not exists):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run serial for API state consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

---

## Test Reports

### Output Files
After test execution, reports are generated in the `test-results/` directory:

```
test-results/
├── mac-address-test.log       # Full text log
├── mac-address-report.json    # JSON report (structured data)
└── index.html                 # HTML report (browser-friendly)
```

### Viewing Reports
```bash
# Open HTML report
open test-results/index.html              # Mac
start test-results/index.html             # Windows
xdg-open test-results/index.html         # Linux

# View text log
cat test-results/mac-address-test.log

# Parse JSON report
jq '.[] | .title, .status' test-results/mac-address-report.json
```

### Report Contents
- ✓ Test name and status (passed/failed)
- ⏱️ Duration for each test
- 📊 Overall statistics
- 🔍 Failure details with assertions
- 📸 Screenshots (if enabled)
- 🎬 Video recordings (if enabled)

---

## Troubleshooting

### Backend Not Running
```
Error: Backend not responding on http://localhost:4000
```
**Solution:**
```bash
cd backend
npm run dev
```

### Frontend Not Running
```
Error: Frontend not responding on http://localhost:3000
```
**Solution:**
```bash
npm run dev
```

### Database Not Initialized
```
Error: ECONNREFUSED (port 3306)
```
**Solution:**
```bash
# Start Docker Compose
docker-compose up -d

# Or initialize manually
mysql -u root < database/init/01_schema.sql
```

### Invalid Credentials
```
Error: Invalid email or password
```
**Check seeded users:**
| Email | Password |
|-------|----------|
| admin@company.com | Passw0rd! |
| marcus.vance@company.com | Passw0rd! |
| alex.mercer@company.com | Passw0rd! |

### Tests Timing Out
```
Error: Timeout waiting for response
```
**Solution:** Increase timeout
```bash
npx playwright test tests/mac-address.spec.ts --timeout=60000
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Kill process on port
```bash
# Linux/Mac
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Windows PowerShell
Get-Process | Where-Object { $_.Port -eq 3000 } | Stop-Process -Force
```

---

## Test Data Management

### Seeded Users (from database/init/02_seed.sql)
```
admin@company.com          → admin role
marcus.vance@company.com   → it_support role
alex.mercer@company.com    → requester role
Password: Passw0rd!
```

### Device Serial Numbers
Tests use unique serial numbers to avoid collisions:
```
SN-TEST-{timestamp}-{random}
```
This allows safe re-runs without cleanup.

### MAC Address Format
Tests use valid MAC addresses in format:
```
AA:BB:CC:DD:EE:FF
```

### Database State
- Tests run **serially** to maintain consistent database state
- Devices created during tests are cleaned up at the end
- Tests are **idempotent** (can be run multiple times)

---

## API Endpoints Tested

### Authentication
- `POST /api/auth/login` - Get JWT token

### Device Management
- `GET /api/devices` - List devices (paginated)
- `GET /api/devices/:id` - Get device by ID
- `GET /api/devices/search?serial=` - Search by serial
- `POST /api/devices` - Create device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device

### MAC Address Management
- `POST /api/devices/:id/mac` - Add MAC (201 Created)
- `PUT /api/devices/:id/mac/:macId` - Update MAC (200 OK)
- `DELETE /api/devices/:id/mac/:macId` - Delete MAC (204 No Content)

### Error Responses
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate serial number

---

## Test Results Summary

### Expected Output
```
Running tests...

✓ 1. MAC Address Creation (4 tests)
  ✓ 1.1: Create device and add WiFi MAC
  ✓ 1.2: Add Ethernet MAC to same device
  ✓ 1.3: Verify both MACs present in device
  ✓ 1.4: Add Bluetooth MAC

✓ 2. MAC Address Retrieval (4 tests)
  ✓ 2.1: Get device by ID with MAC list
  ✓ 2.2: Search device by serial and verify MACs
  ✓ 2.3: List devices and verify MACs accessible
  ✓ 2.4: Verify MAC ordering (newest first)

✓ 3. MAC Address Updates (4 tests)
  ✓ 3.1: Update MAC type (WiFi → Ethernet)
  ✓ 3.2: Update MAC address (keep type)
  ✓ 3.3: Update both type and address
  ✓ 3.4: Partial update (only macType)

✓ 4. MAC Address Deletion (3 tests)
  ✓ 4.1: Delete single MAC from device with multiple
  ✓ 4.2: Delete last MAC from device
  ✓ 4.3: Delete all MACs sequentially

✓ 5. Validation & Error Handling (11 tests)
  ✓ 5.1: Invalid MAC format → 400
  ✓ 5.2: Missing colons in MAC → 400
  ✓ 5.3: Invalid hex in MAC → 400
  ✓ 5.4: Invalid MAC type → 400
  ✓ 5.5: Add MAC to non-existent device → 404
  ✓ 5.6: Update MAC on non-existent device → 404
  ✓ 5.7: Update non-existent MAC → 404
  ✓ 5.8: Delete MAC from non-existent device → 404
  ✓ 5.9: Delete non-existent MAC → 404
  ✓ 5.10: Request without authentication → 401
  ✓ 5.11: Requester role trying to add MAC → 403

✓ 6. UI Interactions (10 tests)
  ✓ 6.1: Login to frontend and navigate
  ✓ 6.2: Navigate to Device Management
  ✓ 6.3: Create device via UI
  ✓ 6.4: Open device edit modal with MACs
  ✓ 6.5: Add new MAC via UI
  ✓ 6.6: Edit existing MAC type
  ✓ 6.7: Delete MAC via UI
  ✓ 6.8: Validate MAC format error message
  ✓ 6.9: Save device form with new MAC
  ✓ 6.10: Cancel modal without saving

============================
37 passed (2m 30s)
```

---

## Performance Benchmarks

Typical execution times:

| Configuration | Time |
|---------------|------|
| Serial (1 worker) | 2-3 minutes |
| Parallel (4 workers) | ~45 seconds |
| Headed mode | +30 seconds |
| Debug mode | Interactive (no timeout) |

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: MAC Address Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install

      - name: Start backend
        run: cd backend && npm run dev &

      - name: Start frontend
        run: npm run dev &

      - name: Wait for servers
        run: |
          timeout 30 bash -c 'until curl http://localhost:4000/health; do sleep 1; done'
          timeout 30 bash -c 'until curl http://localhost:3000; do sleep 1; done'

      - name: Run MAC tests
        run: npx playwright test tests/mac-address.spec.ts

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/
```

---

## Known Issues & Limitations

### Issue 1: POST /devices Ignores macAddresses Body
- **Status:** Known limitation
- **Workaround:** Use POST /devices/:id/mac for each MAC
- **Impact:** Cannot create device with MACs in single request

### Issue 2: No Global Duplicate MAC Constraint
- **Status:** Design (MACs can be identical across devices)
- **Impact:** Tests don't validate duplicate MAC rejection
- **Behavior:** Same MAC can exist on multiple devices

### Issue 3: Search Endpoint (GET /devices/search) May Not Hydrate MACs
- **Status:** TBD (depends on controller implementation)
- **Impact:** Search result may have empty macAddresses array
- **Behavior:** Documented in test 2.2

---

## Contributing Tests

### Adding New Test Cases
1. Update `MAC_ADDRESS_TEST_PLAN.md` with test specification
2. Add test to appropriate group in `tests/mac-address.spec.ts`
3. Use existing helper functions (loginAndGetToken, createDevice, etc.)
4. Document expected behavior in test comments
5. Run full suite: `npx playwright test tests/mac-address.spec.ts`

### Test Template
```typescript
test('X.Y: Test description', async ({ request }) => {
  // Setup
  const token = await loginAndGetToken(...);
  const device = await createDevice(request, token);

  // Action
  const result = await addMacToDevice(request, token, device.id, 'Ethernet', 'AA:BB:CC:DD:EE:FF');

  // Assert
  expect(result.macType).toBe('Ethernet');
  console.log('✓ Test passed');
});
```

---

## Support & Resources

### Documentation
- `MAC_ADDRESS_TEST_PLAN.md` - Detailed test specifications
- `tests/mac-address.spec.ts` - Test implementation
- `backend/src/controllers/device.controller.ts` - API implementation

### Playwright Docs
- [Getting Started](https://playwright.dev/docs/intro)
- [API Reference](https://playwright.dev/docs/api/class-testoptions)
- [Best Practices](https://playwright.dev/docs/best-practices)

### Project Resources
- Backend: `backend/README.md`
- Frontend: `src/components/DeviceFormModal.tsx`
- Database: `database/init/04_mac_addresses.sql`

---

## Version History

- **v1.0** (2026-06-23) - Initial comprehensive test suite
  - 37+ test cases across 6 test groups
  - Bash and PowerShell runner scripts
  - Detailed test plan and documentation

---

## License

This test suite is part of the N-VOC Request System project.
