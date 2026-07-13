# MAC Address Testing - Complete Setup & Execution Guide

## Overview

This guide provides comprehensive instructions for running the MAC address functionality test suite using Playwright. The tests cover API endpoints, database validation, and UI interactions.

---

## Quick Start (5 Minutes)

### Prerequisites Check
```bash
# Make sure you have:
# 1. Node.js 16+ installed
# 2. npm 7+ installed
# 3. MySQL database running with seed data
```

### Start Servers
```bash
# Terminal 1: Start Backend
cd backend
npm install
npm run dev

# Terminal 2: Start Frontend
npm install
npm run dev
```

### Run Tests
```bash
# Terminal 3: Execute tests
./run_mac_address_tests.sh

# OR on Windows:
.\run_mac_address_tests.ps1
```

---

## Detailed Setup

### 1. System Requirements

#### Minimum Requirements
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher
- **RAM**: 4GB minimum
- **Disk**: 2GB free space

#### Required Services
- **MySQL**: Version 5.7 or 8.0
  - Database: `n_voc_system` (or configured name)
  - User: `root` (or configured)
  - Password: configured in `.env`
- **Backend**: Express.js running on http://localhost:4000
- **Frontend**: Vite/React running on http://localhost:3000

#### Test Database
The database must be seeded with:
```sql
-- Test Users (from database/init/02_seed.sql)
- Email: admin@company.com / Password: Passw0rd!
- Email: marcus.vance@company.com / Password: Passw0rd!
- Email: alex.mercer@company.com / Password: Passw0rd!

-- These users have different roles:
- admin@company.com → Admin role (full device access)
- marcus.vance@company.com → IT Support role (can manage MACs)
- alex.mercer@company.com → Requester role (limited access)
```

### 2. Project Structure Setup

#### Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Verify .env configuration
cat .env
# Should include:
# - DATABASE_URL or DB_HOST, DB_USER, DB_PASS, DB_NAME
# - JWT_SECRET
# - NODE_ENV=development

# Initialize database (if needed)
npm run migrate  # or your migration command

# Start development server
npm run dev
# Expected output: "Server running on http://localhost:4000"
```

#### Frontend Setup
```bash
# From project root
npm install

# Verify configuration
ls -la .env

# Start development server
npm run dev
# Expected output: "VITE v... ready in ... ms"
# Access at http://localhost:3000
```

### 3. Database Setup

#### Initialize Database
```bash
# Navigate to database directory
cd database

# Apply migrations and seed data
./init.sh  # or windows equivalent

# Verify seeding
mysql -u root -p n_voc_system < init/02_seed.sql
```

#### Verify Database
```bash
# Connect to MySQL
mysql -u root -p

# Check database
USE n_voc_system;

# Verify tables exist
SHOW TABLES;

# Verify MAC addresses table
DESCRIBE mac_addresses;
```

Expected schema:
```
CREATE TABLE mac_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id INT NOT NULL,
  mac_type ENUM('Ethernet', 'WiFi', 'Bluetooth', 'Other'),
  mac_address VARCHAR(17) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE KEY unique_mac_per_device (device_id, mac_address)
);
```

---

## Test Execution

### Method 1: Using Provided Scripts

#### On Linux/macOS (Bash)
```bash
# Make script executable
chmod +x run_mac_address_tests.sh

# Run all tests
./run_mac_address_tests.sh

# Run specific test group
./run_mac_address_tests.sh --group "MAC Address Creation"

# Run with UI mode (interactive)
./run_mac_address_tests.sh --ui

# Run with browser visible
./run_mac_address_tests.sh --headed

# Generate HTML report
./run_mac_address_tests.sh --report
```

#### On Windows (PowerShell)
```powershell
# Run all tests
.\run_mac_address_tests.ps1

# Run specific test group
.\run_mac_address_tests.ps1 -Group "MAC Address Creation"

# Run with UI mode
.\run_mac_address_tests.ps1 -UIMode

# Run with browser visible
.\run_mac_address_tests.ps1 -Headed

# Generate HTML report
.\run_mac_address_tests.ps1 -Report
```

### Method 2: Direct Playwright Commands

#### Run All Tests
```bash
npx playwright test tests/mac-address.spec.ts
```

#### Run Specific Test Group
```bash
npx playwright test tests/mac-address.spec.ts -g "MAC Address Creation"
```

#### Run With UI Mode
```bash
npx playwright test tests/mac-address.spec.ts --ui
```

#### Run With Browser Visible
```bash
npx playwright test tests/mac-address.spec.ts --headed
```

#### Run Specific Test
```bash
npx playwright test tests/mac-address.spec.ts -g "1.1: Create device and add WiFi MAC"
```

#### Debug Mode
```bash
npx playwright test tests/mac-address.spec.ts --debug
```

#### Generate HTML Report
```bash
npx playwright test tests/mac-address.spec.ts --reporter=html
npx playwright show-report
```

---

## Test Structure

### Test Groups (6 Major Categories)

#### Group 1: MAC Address Creation (4 tests)
- Create device with WiFi MAC
- Add Ethernet MAC to same device
- Verify both MACs in device details
- Add Bluetooth MAC

**Expected Duration**: ~10 seconds

#### Group 2: MAC Address Retrieval (4 tests)
- Get device by ID with MAC list
- Search device by serial number
- List devices and verify MACs
- Verify MAC ordering (newest first)

**Expected Duration**: ~8 seconds

#### Group 3: MAC Address Updates (4 tests)
- Update MAC type (WiFi → Ethernet)
- Update MAC address (keep type)
- Update both type and address
- Partial update (only type)

**Expected Duration**: ~10 seconds

#### Group 4: MAC Address Deletion (3 tests)
- Delete single MAC from multi-MAC device
- Delete last MAC from device
- Delete all MACs sequentially

**Expected Duration**: ~8 seconds

#### Group 5: Validation & Error Handling (11 tests)
- Invalid MAC format → 400
- Missing colons in MAC → 400
- Invalid hex characters → 400
- Invalid MAC type → 400
- Add MAC to non-existent device → 404
- Update MAC on non-existent device → 404
- Update non-existent MAC → 404
- Delete from non-existent device → 404
- Delete non-existent MAC → 404
- Request without authentication → 401
- Non-admin role attempting to add MAC → 403

**Expected Duration**: ~15 seconds

#### Group 6: UI Interactions (10 tests)
- Login to frontend
- Navigate to Device Management
- Create device via UI
- Open device and view existing MACs
- Add new MAC via UI
- Edit existing MAC type
- Delete MAC from UI
- Validate MAC format error message
- Save device form with new MAC
- Cancel modal without saving

**Expected Duration**: ~30-45 seconds (includes browser automation)

---

## Understanding Test Output

### Console Output Example
```
[SETUP] Authentication token captured
[DEVICE CREATE] Device ITA-2026-0001 (id=1) created
[MAC ADD] Added WiFi MAC (AA:BB:CC:DD:EE:FF) to device 1
[MAC ADD] Added Ethernet MAC (11:22:33:44:55:66) to device 1
✓ Both MACs verified in device details

[DEVICE CREATE] Device ITA-2026-0002 (id=2) created
[MAC ADD] Added Ethernet MAC (AA:BB:CC:DD:EE:FF) to device 2
[MAC UPDATE] MAC 3 updated on device 2
✓ MAC type updated successfully

========== TEST CLEANUP ==========
Deleting test devices...
✓ Cleaned up device 1

========== TEST SUMMARY ==========
✓ All MAC address functionality tests completed
Review logs above for detailed test results
```

### Log File Format
- **File**: `mac-address-tests.log`
- **Contains**: All console output, test results, timing
- **Review**: For debugging failed tests

### HTML Report
- **Location**: `playwright-report/index.html`
- **Generated with**: `--report` flag
- **Contains**:
  - Test execution timeline
  - Pass/fail status for each test
  - Screenshots of failures (if captured)
  - Browser console logs
  - Network activity logs

---

## Troubleshooting

### Tests Fail to Start

#### Problem: "Cannot find module '@playwright/test'"
```bash
# Solution: Install Playwright
npm install @playwright/test --save-dev
npx playwright install
```

#### Problem: "Backend is not responding"
```bash
# Check backend is running on port 4000
curl http://localhost:4000/api/devices

# Verify backend started
cd backend && npm run dev

# Check port availability
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows
```

#### Problem: "Frontend is not responding"
```bash
# Check frontend is running on port 3000
curl http://localhost:3000

# Verify frontend started
npm run dev

# Check port availability
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### Authentication Issues

#### Problem: "Login failed" or "401 Unauthorized"
```
Issue: Seeded user credentials incorrect or user doesn't exist

Solution:
1. Verify seed data was applied
   mysql -u root -p n_voc_system < database/init/02_seed.sql

2. Check user exists
   SELECT email FROM users WHERE email = 'marcus.vance@company.com';

3. Reset password if needed
   UPDATE users SET password = SHA2('Passw0rd!', 256) WHERE email = 'marcus.vance@company.com';
```

### Database Issues

#### Problem: "Database connection refused"
```
Issue: MySQL not running or credentials wrong

Solution:
1. Verify MySQL is running
   mysqld status  # or systemctl status mysql

2. Test connection
   mysql -u root -p -h localhost

3. Check .env credentials
   cat backend/.env | grep DB_

4. Start MySQL service
   mysqld  # or docker compose up -d mysql
```

#### Problem: "Unknown database 'n_voc_system'"
```
Solution:
1. Create database if not exists
   mysql -u root -p -e "CREATE DATABASE n_voc_system;"

2. Apply migrations
   cd database && ./init.sh

3. Verify
   mysql -u root -p -e "SHOW DATABASES;"
```

### Test Failures

#### Problem: "Tests timeout"
```
Cause: Services not responding in time

Solution:
1. Increase timeout in test config (if needed)
2. Check service health: curl http://localhost:4000/api/devices
3. Review backend logs for errors
4. Ensure database is responsive
```

#### Problem: "Invalid MAC format" test passes unexpectedly
```
Cause: Backend validation may be different

Solution:
1. Check actual API response:
   curl -X POST http://localhost:4000/api/devices/1/mac \
     -H "Authorization: Bearer TOKEN" \
     -d '{"macType":"Ethernet","macAddress":"INVALID"}'

2. Update test expectations if needed
3. Document actual validation behavior
```

#### Problem: "UI tests fail with 'Element not found'"
```
Cause: Selectors don't match actual DOM

Solution:
1. Run with --ui mode to see actual page
   npx playwright test --ui

2. Update selectors in test file (tests/mac-address.spec.ts)
3. Use --debug mode to step through tests
4. Take screenshots for comparison
```

---

## Customization

### Changing Test Credentials
Edit `tests/mac-address.spec.ts`:
```typescript
const TEST_USERS = {
  admin: { email: 'your-admin@company.com', password: 'YourPassword!' },
  itSupport: { email: 'your-itsupport@company.com', password: 'YourPassword!' },
  requester: { email: 'your-requester@company.com', password: 'YourPassword!' },
};
```

### Changing API Base URL
Edit `tests/mac-address.spec.ts`:
```typescript
const API_BASE = 'http://your-backend-url:4000/api';
const FRONTEND_BASE = 'http://your-frontend-url:3000';
```

### Adding Custom Selectors
For UI tests, update selectors based on your implementation:
```typescript
// Find elements by placeholder
await page.fill('input[placeholder*="serial" i]', serialNumber);

// Find by test ID
await page.click('[data-testid="add-mac-button"]');

// Find by role
await page.click('button:has-text("Save")');
```

### Filtering Tests by Name
```bash
# Run only creation tests
npx playwright test tests/mac-address.spec.ts -g "Creation"

# Run only validation tests
npx playwright test tests/mac-address.spec.ts -g "Validation"

# Run specific test
npx playwright test tests/mac-address.spec.ts -g "1.1"
```

---

## Performance Optimization

### Run Tests in Parallel (Faster Execution)
```bash
# Default: runs serially for state consistency
# To enable parallelization (if tests allow):
# Remove "test.describe.configure({ mode: 'serial' })"

# Note: Current tests require serial execution due to shared state
```

### Skip Browser UI Tests
```bash
# Comment out Group 6 UI tests in mac-address.spec.ts
# This speeds up execution if only API testing needed
```

### Run Headless (Faster, No Display)
```bash
# Already default - tests run without visible browser
# Use --headed only for debugging
```

---

## Continuous Integration Setup

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
          MYSQL_DATABASE: n_voc_system
          MYSQL_ROOT_PASSWORD: password
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd backend && npm install
          npx playwright install

      - name: Start services
        run: |
          cd backend && npm run dev &
          npm run dev &
          sleep 5

      - name: Run tests
        run: ./run_mac_address_tests.sh --report

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: test-report
          path: playwright-report
```

---

## Support & Documentation

### Test File Location
- **Main Test**: `tests/mac-address.spec.ts`
- **Config**: `playwright.config.ts` (if exists)

### Related Documentation
- **Test Plan**: `MAC_ADDRESS_TEST_PLAN.md`
- **Test Results**: `MAC_ADDRESS_TEST_SUMMARY.md` (generated after runs)
- **API Docs**: Check backend README for API endpoints

### Common Patterns

#### Login Flow
```typescript
const token = await loginAndGetToken(request, email, password);
// Token valid for entire test session
```

#### Device Creation
```typescript
const device = await createDevice(request, authToken, {
  deviceType: 'laptop',
  model: 'Dell XPS',
  serialNumber: getUniqueSerial(),
});
```

#### MAC Operations
```typescript
// Add MAC
const mac = await addMacToDevice(request, authToken, deviceId, 'WiFi', 'AA:BB:CC:DD:EE:FF');

// Update MAC
const updated = await updateMac(request, authToken, deviceId, macId, { macType: 'Ethernet' });

// Delete MAC
await deleteMac(request, authToken, deviceId, macId);
```

---

## Next Steps

1. **Initial Run**: Execute tests with `--ui` flag to watch execution
2. **Fix Failures**: Address any failing tests (usually selector mismatches)
3. **Review Results**: Open HTML report to see detailed results
4. **Integrate**: Add to CI/CD pipeline for automated testing
5. **Monitor**: Run tests regularly to catch regressions

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-23 | Initial comprehensive test suite |

---

## Contact

For issues or questions about the test suite:
1. Review this guide and troubleshooting section
2. Check test output logs in `mac-address-tests.log`
3. Review test file comments in `tests/mac-address.spec.ts`
4. File issues with test environment details
