# Test Plan: Device Assignment Workflow and Reports

## Section 1: Hardware Request & Device Assignment Workflow

### 1.1 Create Hardware Request (deviceAction: 'new')
- **Setup:** Prepare request with category='hardware_request', deviceAction='new'
- **Request payload:**
  ```json
  {
    "title": "New Laptop Request",
    "description": "Need laptop for new hire",
    "requesterName": "John Smith",
    "requesterEmail": "john@example.com",
    "requesterDept": "Finance",
    "category": "hardware_request",
    "subcategory": "laptop",
    "deviceType": "laptop",
    "deviceModel": "Dell Latitude 7440",
    "priority": "high"
  }
  ```
- **Expected result:**
  - Ticket created with status='submitted'
  - Device created with status='In Stock' (from ticket.repo line 197)
  - Device assigned temporary serial: `TEMP-{ticketId}-{timestamp}`
  - Device linked to ticket with action_type='new'
  - History entry: "Device Created" appended to ticket
- **Assertion:** `GET /devices/{deviceId}` returns status='In Stock'

### 1.2 Verify Device In Stock Status
- **Test:** Call `GET /devices/{deviceId}` (from section 1.1)
- **Expected result:**
  - Response contains device object
  - device.status = 'In Stock'
  - device.assignedTo = null
  - device.code = 'ITA-{year}-{NNNN}' format
  - linkedTickets array contains one entry with actionType='new'

### 1.3 Assign Device to User (via /devices/:id/assign)
- **Setup:** Use deviceId from section 1.1
- **Request:** `POST /devices/{deviceId}/assign`
  ```json
  {
    "userName": "John Smith",
    "userEmail": "john@example.com",
    "userId": 123,
    "userDept": "Finance"
  }
  ```
- **Expected result:**
  - Device status changed to 'Active' (from device.repo line 439)
  - Device.assignedTo = "John Smith (john@example.com)" (exact format line 439)
  - Response includes updated device object

### 1.4 Verify Device Assigned After Assignment
- **Test:** Call `GET /devices/{deviceId}` after section 1.3
- **Expected result:**
  - device.status = 'Active'
  - device.assignedTo = "John Smith (john@example.com)"
  - Updated timestamp reflects recent change

### 1.5 Device Linking to Hardware Request (deviceAction: 'repair')
- **Setup:** Create ticket with deviceAction='repair' and reference existing device serial
- **Request:** Create ticket with:
  ```json
  {
    "category": "hardware_request",
    "deviceAction": "repair",
    "deviceSerialNumber": "SN-DL7440-0001"
  }
  ```
- **Expected result:**
  - Device found and linked to ticket
  - Device status set to 'In Repair' (from ticket.repo line 224)
  - Ticket history: "Device Linked" entry created
  - linkedTickets contains entry with actionType='repair'

### 1.6 Device Linking to Hardware Request (deviceAction: 'replace')
- **Setup:** Create ticket with deviceAction='replace' and existing device serial
- **Expected result:**
  - Device linked with action_type='replace'
  - Device status remains unchanged (no status update for replace, only repair/return)
  - Ticket history appended

### 1.7 Device Linking to Hardware Request (deviceAction: 'return')
- **Setup:** Create ticket with deviceAction='return' and existing device serial
- **Expected result:**
  - Device linked with action_type='return'
  - Device status set to 'In Repair' (from ticket.repo line 224)
  - Ticket history appended

### 1.8 Missing Device in Repair Request
- **Setup:** Create ticket with deviceAction='repair' and non-existent serial number
- **Expected result:**
  - Ticket creation succeeds (error caught, doesn't fail ticket, line 236-239)
  - No device linked
  - History contains "Device Linked" entry NOT created
  - No exception thrown

---

## Section 2: Device Reports - **CRITICAL ISSUES FOUND**

### **BLOCKER: All Report Endpoints Query Non-existent Column**
All five report methods filter on `WHERE is_active = true`, but the `devices` table has no `is_active` column:
- Schema definition (03_it_devices.sql lines 31-53): No is_active column
- ALTER TABLE (line 142-154): Adds specs, not is_active
- `is_active` exists only on: `users` table and `mac_addresses` table

**Impact:** All five report endpoints (lines 462, 474, 522, 548, 574, 595 in device.repo.ts) will throw:
```
Error: Unknown column 'is_active' in 'where clause'
```

### 2.1 Summary Report - **FAILS**
- **Endpoint:** `GET /devices/reports/summary`
- **Expected behavior:** Return device count by status, type, and department
- **Actual result:** 500 error - Unknown column 'is_active'
- **Fix needed:** Remove `WHERE is_active = true` from queries, or add `is_active` column to devices table

### 2.2 Assignments Report - **FAILS**
- **Endpoint:** `GET /devices/reports/assignments`
- **Expected behavior:** Return device-to-user mapping for all assigned devices
- **Actual result:** 500 error - Unknown column 'is_active'
- **Expected data shape (if working):**
  ```json
  [
    {
      "device_code": "ITA-2026-0001",
      "model": "Dell Latitude 7440",
      "serial_number": "SN-DL7440-0001",
      "assigned_to": "Alice Tan (alice@company.com)",
      "status": "Active",
      "department": "Finance"
    }
  ]
  ```

### 2.3 Aging Report - **FAILS**
- **Endpoint:** `GET /devices/reports/aging`
- **Expected behavior:** Return devices with warranty expiring within 90 days
- **Actual result:** 500 error - Unknown column 'is_active'
- **Expected data shape (if working):**
  ```json
  [
    {
      "device_code": "ITA-2026-0003",
      "model": "Dell U2723QE 27\"",
      "assigned_to": "Ben Lim (ben@company.com)",
      "warranty_expiry": "2028-02-01",
      "days_until_expiry": 233,
      "status": "Active"
    }
  ]
  ```

### 2.4 Department Report - **FAILS**
- **Endpoint:** `GET /devices/reports/department`
- **Expected behavior:** Return device counts by department and status
- **Actual result:** 500 error - Unknown column 'is_active'
- **Expected data shape (if working):**
  ```json
  [
    {
      "department": "Finance",
      "total": 3,
      "active": 2,
      "in_repair": 1,
      "retired": 0
    }
  ]
  ```

### 2.5 Availability Report - **FAILS**
- **Endpoint:** `GET /devices/reports/availability`
- **Expected behavior:** Return device count by status (in_stock, active, in_repair, retired, lost)
- **Actual result:** 500 error - Unknown column 'is_active'
- **Expected data shape (if working):**
  ```json
  {
    "in_stock": 1,
    "active": 3,
    "in_repair": 1,
    "retired": 0,
    "lost": 0
  }
  ```

---

## Section 3: CSV Export - **FEATURE NOT IMPLEMENTED**

### 3.1 CSV Export for Reports
- **Expected endpoint:** One of:
  - `GET /devices/reports/summary?format=csv`
  - `GET /devices/reports/assignments/export.csv`
  - `POST /devices/reports/{name}/csv`
- **Actual status:** No CSV export endpoints exist in device.routes.ts or device.controller.ts
- **Current behavior:** All report endpoints only support JSON response via `res.json()`
- **Action required:** Implement CSV export functionality or update test plan

---

## Cleanup Tasks Before Running Tests

1. **Add is_active column to devices table** (or remove from all report queries)
   ```sql
   ALTER TABLE devices
   ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER updated_at,
   ADD INDEX idx_devices_active (is_active);
   ```

2. **Implement CSV export** if required, or mark as out-of-scope

3. **Verify 'In Stock' status is valid:**
   - Controller accepts it (createDeviceSchema line 43) ✓
   - Repository creates with it (ticket.repo line 197) ✓
   - Database schema rejects it (ENUM only allows Active, In Repair, Retired, Lost) ✗
   - **Fix:** Update devices table ENUM: `ENUM('Active','In Repair','Retired','Lost','In Stock')`

---

## Test Execution Order

1. **Pre-flight checks:**
   - Database schema validation (is_active column, status ENUM)
   - Route registration verification (`GET /devices/reports/*`)

2. **Section 1 tests (Hardware Request Workflow):**
   - 1.1 → 1.2 → 1.3 → 1.4 (main assignment flow)
   - 1.5, 1.6, 1.7 (repair/replace/return linking)
   - 1.8 (error handling)

3. **Section 2 tests (Reports):**
   - Skip or flag as "EXPECTED TO FAIL - BLOCKER" until schema fixed
   - After schema fixes, run 2.1–2.5

4. **Section 3:**
   - Skip "CSV export" or implement feature first

---

## Test Fixtures

**Demo devices from seed (03_it_devices.sql):**
- ITA-2026-0001: Dell Latitude 7440 (Alice Tan, Finance, Active)
- ITA-2026-0002: HP EliteDesk 800 G9 (Ben Lim, HR, Active)
- ITA-2026-0003: Dell U2723QE 27" monitor (Ben Lim, HR, Active)
- ITA-2026-0004: iPhone 15 (Carla Reyes, Sales, In Repair)
- ITA-2026-0005: Lenovo ThinkPad X1 (unassigned, IT, Active)
