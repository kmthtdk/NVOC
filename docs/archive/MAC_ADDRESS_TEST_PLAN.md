# MAC Address Functionality - Comprehensive Test Plan

## Project Context
- **Frontend:** React/Vite on port 3000
- **Backend:** Express.js on port 4000 (serves `/api`)
- **Database:** MySQL (tested via docker-compose)
- **Authentication:** JWT Bearer tokens, seeded users with password "Passw0rd!"

---

## Test Scope

### Covered Scenarios
1. **Device Creation with MAC Addresses** - Create a device and add MACs via dedicated endpoints
2. **MAC Address Retrieval** - Fetch MACs from device details, list, and search endpoints
3. **MAC Address Updates** - Modify MAC type and address via PUT endpoint
4. **MAC Address Deletion** - Remove MACs and verify device integrity
5. **Validation & Error Handling** - Test format validation, 400 responses, 404 for non-existent devices
6. **UI Interactions** - DeviceFormModal for adding, editing, and deleting MACs in edit mode

### Known Constraints
- **POST /devices does NOT persist macAddresses in body** - Even though schema accepts it, controller ignores it (lines 142-152 in device.controller.ts). Tests create devices via POST, then add MACs via POST /devices/:id/mac.
- **No Global Duplicate MAC Constraint** - Database schema has no UNIQUE constraint on mac_addresses.mac_address (only FK + indexes). Same MAC can exist across different devices. Duplicate enforcement is not tested.
- **MAC Type Enum** - Values are `Ethernet | WiFi | Bluetooth | Other` (not "wireless"/"wired").
- **Timestamp Formats** - All returned as ISO 8601 (UTC).

---

## Test Cases

### 1. MAC Address Creation

#### Test 1.1: Create Device + Add Wireless MAC
- **Precondition:** Authenticated as it_support user
- **Steps:**
  1. POST /devices with unique serial (e.g., SN-TEST-{timestamp})
  2. Verify device created with id, code (ITA-YYYY-NNNN), status=Active
  3. POST /devices/:id/mac { macType: "WiFi", macAddress: "AA:BB:CC:DD:EE:FF" }
  4. Verify MAC created with id, timestamps, and correct type
- **Expected:** 201 Created, MAC in response with valid id

#### Test 1.2: Create Device + Add Wired (Ethernet) MAC
- **Precondition:** Same as 1.1
- **Steps:**
  1. Create device
  2. POST /devices/:id/mac { macType: "Ethernet", macAddress: "11:22:33:44:55:66" }
- **Expected:** 201 Created, MAC properly stored

#### Test 1.3: Create Device + Add Multiple MACs (Ethernet + WiFi)
- **Precondition:** Same as 1.1
- **Steps:**
  1. Create device
  2. Add Ethernet MAC
  3. Add WiFi MAC
  4. Verify both appear in GET /devices/:id response
- **Expected:** Both MACs present with correct types

#### Test 1.4: Add Bluetooth MAC
- **Precondition:** Device exists
- **Steps:**
  1. POST /devices/:id/mac { macType: "Bluetooth", macAddress: "AA:11:BB:22:CC:33" }
- **Expected:** 201 Created, stored as Bluetooth type

---

### 2. MAC Address Retrieval

#### Test 2.1: Get Device by ID, Verify MAC List
- **Precondition:** Device with 2 MACs (Ethernet, WiFi)
- **Steps:**
  1. GET /devices/:id
  2. Inspect response.data.macAddresses array
- **Expected:** Array contains both MACs with all fields (id, deviceId, macType, macAddress, createdAt, updatedAt)

#### Test 2.2: Search Device by Serial, Verify MACs Included
- **Precondition:** Device with MACs exists
- **Steps:**
  1. GET /devices/search?serial=SN-123
  2. Verify response.data.macAddresses populated
- **Expected:** MACs present in search result (unless the search path doesn't hydrate them—verify)

#### Test 2.3: List Devices (Paginated), Verify MACs Accessible
- **Precondition:** 3+ devices with mixed MAC counts
- **Steps:**
  1. GET /devices?page=1&pageSize=20
  2. Check if response includes macAddresses per device
- **Expected:** Depending on API design, list either shows summary (no MACs) or includes MACs. **Document actual behavior.**

#### Test 2.4: MAC Order (Should be DESC by created_at)
- **Precondition:** Device with 3 MACs added sequentially
- **Steps:**
  1. GET /devices/:id
  2. Verify macAddresses[0].createdAt >= macAddresses[1].createdAt
- **Expected:** Newest MAC first (query uses ORDER BY created_at DESC)

---

### 3. MAC Address Updates

#### Test 3.1: Update MAC Type (WiFi → Ethernet)
- **Precondition:** Device with WiFi MAC
- **Steps:**
  1. PUT /devices/:id/mac/:macId { macType: "Ethernet", macAddress: "AA:BB:CC:DD:EE:FF" }
  2. GET /devices/:id to verify
- **Expected:** MAC type changed, address unchanged, updatedAt updated

#### Test 3.2: Update MAC Address (Keep Type)
- **Precondition:** Device with Ethernet MAC "AA:BB:CC:DD:EE:FF"
- **Steps:**
  1. PUT /devices/:id/mac/:macId { macAddress: "11:22:33:44:55:66" }
  2. Verify type unchanged
- **Expected:** macAddress updated, macType = Ethernet, updatedAt changed

#### Test 3.3: Update Both Type and Address
- **Precondition:** Device with WiFi MAC
- **Steps:**
  1. PUT /devices/:id/mac/:macId { macType: "Bluetooth", macAddress: "FF:EE:DD:CC:BB:AA" }
- **Expected:** Both fields updated in single call

#### Test 3.4: Update with Partial Payload (Only macType)
- **Precondition:** Device with MAC (Ethernet, "AA:BB:CC:DD:EE:FF")
- **Steps:**
  1. PUT /devices/:id/mac/:macId { macType: "WiFi" } (no macAddress field)
- **Expected:** macType updated, macAddress unchanged

---

### 4. MAC Address Deletion

#### Test 4.1: Delete Single MAC from Device with 2
- **Precondition:** Device with Ethernet + WiFi MACs
- **Steps:**
  1. DELETE /devices/:id/mac/:macId (Ethernet)
  2. GET /devices/:id
- **Expected:** 204 No Content, WiFi MAC remains, device still exists

#### Test 4.2: Delete Last MAC from Device
- **Precondition:** Device with 1 MAC
- **Steps:**
  1. DELETE /devices/:id/mac/:macId
  2. GET /devices/:id
- **Expected:** 204 No Content, device persists with empty macAddresses array

#### Test 4.3: Delete All MACs Sequentially
- **Precondition:** Device with 3 MACs
- **Steps:**
  1. Delete each MAC in loop
  2. Verify device still exists with macAddresses = []
- **Expected:** Device intact, all MACs gone

---

### 5. Validation & Error Handling

#### Test 5.1: Invalid MAC Format → 400
- **Precondition:** Device exists
- **Steps:**
  1. POST /devices/:id/mac { macType: "Ethernet", macAddress: "INVALID" }
- **Expected:** 400 Bad Request, error.code = VALIDATION_ERROR, includes field path

#### Test 5.2: Invalid MAC Format Variations
- **Steps:**
  1. Missing colons: "AABBCCDDEEFF"
  2. Wrong pair count: "AA:BB:CC:DD:EE"
  3. Invalid hex: "GG:BB:CC:DD:EE:FF"
  4. Extra colons: "AA:BB:CC:DD:EE:FF:"
- **Expected:** All return 400 VALIDATION_ERROR

#### Test 5.3: Invalid macType → 400
- **Precondition:** Device exists
- **Steps:**
  1. POST /devices/:id/mac { macType: "InvalidType", macAddress: "AA:BB:CC:DD:EE:FF" }
- **Expected:** 400, VALIDATION_ERROR

#### Test 5.4: Add MAC to Non-Existent Device → 404
- **Precondition:** None
- **Steps:**
  1. POST /devices/99999/mac { macType: "Ethernet", macAddress: "AA:BB:CC:DD:EE:FF" }
- **Expected:** 404 Not Found

#### Test 5.5: Update MAC on Non-Existent Device → 404
- **Precondition:** None
- **Steps:**
  1. PUT /devices/99999/mac/1 { macType: "WiFi" }
- **Expected:** 404 Not Found

#### Test 5.6: Update Non-Existent MAC on Existing Device → 404
- **Precondition:** Device exists, but MAC id does not belong to it
- **Steps:**
  1. PUT /devices/:id/mac/99999 { macType: "WiFi" }
- **Expected:** 404, message includes "not found on this device"

#### Test 5.7: Delete MAC from Non-Existent Device → 404
- **Precondition:** None
- **Steps:**
  1. DELETE /devices/99999/mac/1
- **Expected:** 404 Not Found

#### Test 5.8: Delete Non-Existent MAC → 404
- **Precondition:** Device exists
- **Steps:**
  1. DELETE /devices/:id/mac/99999
- **Expected:** 404, message includes "not found on this device"

#### Test 5.9: Missing Authentication → 401
- **Precondition:** None
- **Steps:**
  1. POST /devices/:id/mac { ... } without Bearer token
- **Expected:** 401 Unauthorized

#### Test 5.10: Non-Admin/IT_Support User → 403
- **Precondition:** Logged in as requester role
- **Steps:**
  1. POST /devices/:id/mac { ... }
- **Expected:** 403 Forbidden (or appropriate permission error)

---

### 6. UI Interactions (DeviceFormModal)

#### Test 6.1: Open Device Edit Modal, View Existing MACs
- **Precondition:** Device with 2 MACs created via API
- **Precondition (UI):** Logged in as it_support, DeviceManagement page loaded
- **Steps:**
  1. Click "Edit" on device with 2 MACs
  2. Modal opens and loads full device
  3. Verify both MACs displayed in list (macType + macAddress visible)
- **Expected:** Both MACs shown with edit/delete buttons per MAC

#### Test 6.2: Add New MAC via UI Add Button
- **Precondition:** Edit modal open, device has 1 MAC
- **Steps:**
  1. Click "Add MAC" / "+" button
  2. New empty MAC form appears
  3. Enter macType = "WiFi", macAddress = "11:22:33:44:55:66"
  4. Click "Save" (or "Add MAC" sub-button)
  5. Verify new MAC added to the list state
  6. Click Save Device (submit form)
- **Expected:** MAC POST sent, device refetched, new MAC visible

#### Test 6.3: Edit Existing MAC, Change Type
- **Precondition:** Edit modal open, device has Ethernet MAC
- **Steps:**
  1. Click Edit icon on MAC row
  2. Change macType dropdown from Ethernet → WiFi
  3. Keep macAddress same
  4. Click "Save MAC" or confirm
  5. Submit device form
- **Expected:** PUT /devices/:id/mac/:macId sent, type updated in database

#### Test 6.4: Edit Existing MAC, Change Address
- **Precondition:** Edit modal open
- **Steps:**
  1. Click Edit on MAC
  2. Clear macAddress field, enter "FF:EE:DD:CC:BB:AA"
  3. Keep type unchanged
  4. Confirm, save device
- **Expected:** PUT sent with new address, database updated

#### Test 6.5: Delete MAC via UI Delete Button
- **Precondition:** Edit modal open, device has 2 MACs
- **Steps:**
  1. Click Delete icon on one MAC
  2. MAC removed from list (may show confirmation)
  3. Click Save Device
- **Expected:** DELETE /devices/:id/mac/:macId sent, device refetched without that MAC

#### Test 6.6: Add MAC with Invalid Format, See Error
- **Precondition:** Edit modal open
- **Steps:**
  1. Click Add MAC
  2. Enter macAddress = "INVALID"
  3. Try to save (submit button or MAC save action)
- **Expected:** Inline error message: "Invalid format. Use: 00:11:22:33:44:55"

#### Test 6.7: Add MAC, Then Delete (Before Saving Device)
- **Precondition:** Edit modal open
- **Steps:**
  1. Add new MAC
  2. Click delete on that new MAC (before device form save)
  3. MAC removed from local state
  4. Save device (no POST /devices/:id/mac should fire)
- **Expected:** MAC never persisted (isNew flag not sent to backend)

#### Test 6.8: Add Multiple MACs in Single Device Edit
- **Precondition:** Edit modal open, device has 1 MAC
- **Steps:**
  1. Add MAC 1 (Ethernet)
  2. Add MAC 2 (WiFi)
  3. Add MAC 3 (Bluetooth)
  4. Save device
- **Expected:** 3 POST /devices/:id/mac requests sent, all succeed, device shows 4 MACs total

#### Test 6.9: Edit a New MAC (Not Yet Saved)
- **Precondition:** Add new MAC, don't save device yet
- **Steps:**
  1. Click edit on newly added MAC
  2. Change type or address
  3. Save device
- **Expected:** Single POST with updated values (not PUT)

#### Test 6.10: Device Modal Close/Cancel Without Saving
- **Precondition:** Add new MAC, modify existing MAC
- **Steps:**
  1. Click X / Cancel without saving
  2. Reopen device
- **Expected:** Changes discarded, device shows original state

#### Test 6.11: MAC Address Field Validation (Real-Time)
- **Precondition:** Edit modal open, new MAC form visible
- **Steps:**
  1. Enter partial MAC, e.g., "AA:BB"
  2. Move focus away (blur)
  3. Check if inline error appears
- **Expected:** Real-time validation error: "Invalid format"

#### Test 6.12: MAC Type Dropdown Selection
- **Precondition:** Add new MAC form visible
- **Steps:**
  1. Verify dropdown shows all 4 options: Ethernet, WiFi, Bluetooth, Other
  2. Select each, verify correct value in form state
- **Expected:** All options selectable, no defaults assumed incorrectly

---

## Test Data Setup

### Seeded Users (from database/init/02_seed.sql)
| Email | Role | Password |
|-------|------|----------|
| admin@company.com | admin | Passw0rd! |
| marcus.vance@company.com | it_support | Passw0rd! |
| alex.mercer@company.com | requester | Passw0rd! |

### Device Creation Template
```json
{
  "deviceType": "laptop",
  "model": "Dell XPS 15",
  "serialNumber": "SN-TEST-{timestamp}",
  "status": "Active",
  "assignedTo": "John Doe",
  "department": "IT Operations",
  "purchaseDate": "2026-01-01",
  "warrantyExpiry": "2028-01-01",
  "notes": "Test device for MAC address testing"
}
```

### MAC Address Template
```json
{
  "macType": "Ethernet",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

---

## Expected API Responses

### Successful Device Creation
```json
{
  "data": {
    "id": 1,
    "code": "ITA-2026-0001",
    "deviceType": "laptop",
    "model": "Dell XPS 15",
    "serialNumber": "SN-TEST-1234567890",
    "status": "Active",
    "assignedTo": "John Doe",
    "department": "IT Operations",
    "purchaseDate": "2026-01-01",
    "warrantyExpiry": "2028-01-01",
    "notes": "...",
    "createdAt": "2026-06-23T12:00:00Z",
    "updatedAt": "2026-06-23T12:00:00Z",
    "linkedTickets": [],
    "macAddresses": []
  }
}
```

### Successful MAC Addition
```json
{
  "data": {
    "id": 1,
    "deviceId": 1,
    "macType": "Ethernet",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "createdAt": "2026-06-23T12:00:00Z",
    "updatedAt": "2026-06-23T12:00:00Z"
  }
}
```

### Device with MACs Retrieved
```json
{
  "data": {
    "id": 1,
    "code": "ITA-2026-0001",
    "...",
    "macAddresses": [
      {
        "id": 1,
        "deviceId": 1,
        "macType": "WiFi",
        "macAddress": "11:22:33:44:55:66",
        "createdAt": "2026-06-23T12:01:00Z",
        "updatedAt": "2026-06-23T12:01:00Z"
      },
      {
        "id": 2,
        "deviceId": 1,
        "macType": "Ethernet",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "createdAt": "2026-06-23T12:00:00Z",
        "updatedAt": "2026-06-23T12:00:00Z"
      }
    ]
  }
}
```

### Validation Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "macAddress",
        "message": "MAC address must be in format 00:00:00:00:00:00"
      }
    ]
  }
}
```

### 404 Error Response
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Device not found" or "MAC address not found on this device"
  }
}
```

---

## Execution Notes

### Prerequisites
- Both backend and frontend servers running (`npm run dev` in root)
- MySQL database initialized and populated with seed data
- Test user credentials available (see Seeded Users table)

### Test Execution Order
1. **Authentication Tests** - Verify login works, capture token
2. **Creation Tests** - Establish test data (devices + MACs)
3. **Retrieval Tests** - Query created data
4. **Update Tests** - Modify existing data
5. **Deletion Tests** - Remove data (cleanup)
6. **Validation Tests** - Negative cases (can be in any order)
7. **UI Tests** - Interactive workflows in browser

### Cleanup Strategy
- Delete all test devices at the end (cascade removes MACs)
- Use unique serial numbers (timestamp-based) to avoid collisions
- Optional: Preserve test data for manual inspection

### Performance Considerations
- No performance benchmarks in scope
- Use reasonable timeouts (5-10 seconds for API calls, 10-20 seconds for UI interactions)
- Consider database state after each test

---

## Defects Found During Test Design

### Known Issues
1. **POST /devices Ignores macAddresses in Request Body** (DEFECT)
   - Schema accepts `macAddresses?: MacAddressInput[]` (createDeviceSchema, line 40)
   - Controller does NOT use it (lines 142-152)
   - Workaround: Use POST /devices/:id/mac for each MAC
   - Impact: Cannot create device with MACs in single request
   - Recommendation: Either fix controller to process body MACs or remove from schema

2. **Search Endpoint (GET /devices/search?serial=) Missing MAC Hydration** (TBD)
   - Controller calls `deviceRepo.findBySerial()` which does NOT fetch MACs (line 245)
   - Verify if this is intentional (summary response) or a bug
   - Tests to clarify behavior

---

## Coverage Summary

| Category | Tests | Coverage |
|----------|-------|----------|
| Creation | 4 | Device + multiple MACs, all types |
| Retrieval | 4 | By ID, search, list, ordering |
| Updates | 4 | Type, address, both, partial |
| Deletion | 3 | Single, last, all sequential |
| Validation | 10 | Formats, types, missing refs, auth |
| UI Interactions | 12 | Modal, add, edit, delete, validation, state |
| **Total** | **37** | Comprehensive functional + integration |

---

## Notes for QA Engineers

- **Token Management:** Capture and reuse Bearer token throughout test session
- **Database State:** Each test should be isolated; verify cleanup between runs
- **Timestamp Handling:** Tests compare timestamps as strings (ISO 8601); ensure timezone consistency (UTC)
- **Serial Number Uniqueness:** Use timestamp or UUID to avoid collisions; document pattern
- **UI Waits:** Use Playwright's `waitForResponse()` to sync network events with UI actions
- **Error Messages:** Verify exact error codes/messages match schema (helps catch future regressions)

