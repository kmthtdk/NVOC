# MAC Address Functionality - Test Cases Summary

## Document Overview

This document provides a quick reference for all 36 test cases in the MAC address test suite. Each test includes:
- Test ID and name
- Preconditions
- Actions
- Expected results
- Status tracking

---

## Test Suite Statistics

| Metric | Value |
|--------|-------|
| Total Test Groups | 6 |
| Total Test Cases | 36 |
| API Tests | 26 |
| UI Tests | 10 |
| Estimated Execution Time | 2-3 minutes |
| Required Setup Time | 5-10 minutes |

---

## Group 1: MAC Address Creation (Tests 1.1 - 1.4)

### 1.1: Create Device and Add WiFi MAC
| Element | Details |
|---------|---------|
| **Test ID** | 1.1 |
| **Category** | MAC Address Creation |
| **Precondition** | Authenticated user (IT Support role), backend running |
| **Action** | POST /devices with device data, then POST /devices/{id}/mac with WiFi MAC |
| **Input Data** | macType: "WiFi", macAddress: "AA:BB:CC:DD:EE:FF" |
| **Expected Status Code** | 201 Created |
| **Expected Response** | Object with id, deviceId, macType, macAddress, createdAt, updatedAt |
| **Database Validation** | MAC record inserted into mac_addresses table |
| **Assertions** | status=201, mac.macType="WiFi", mac.macAddress="AA:BB:CC:DD:EE:FF" |
| **Estimated Duration** | 2 seconds |

### 1.2: Add Ethernet MAC to Same Device
| Element | Details |
|---------|---------|
| **Test ID** | 1.2 |
| **Category** | MAC Address Creation |
| **Precondition** | Device from 1.1 exists with one MAC |
| **Action** | POST /devices/{id}/mac with Ethernet MAC |
| **Input Data** | macType: "Ethernet", macAddress: "11:22:33:44:55:66" |
| **Expected Status Code** | 201 Created |
| **Expected Response** | Ethernet MAC object |
| **Database Validation** | Device now has 2 MAC records |
| **Assertions** | mac.macType="Ethernet", status=201 |
| **Estimated Duration** | 2 seconds |

### 1.3: Verify Both MACs Present in Device
| Element | Details |
|---------|---------|
| **Test ID** | 1.3 |
| **Category** | MAC Address Creation |
| **Precondition** | Device with 2 MACs exists |
| **Action** | GET /devices/{id} |
| **Expected Status Code** | 200 OK |
| **Expected Response** | Device object with macAddresses array containing 2 items |
| **Validation Rules** | Array ordered by createdAt DESC, both MACs present with correct values |
| **Assertions** | device.macAddresses.length=2, contains WiFi and Ethernet |
| **Estimated Duration** | 1 second |

### 1.4: Add Bluetooth MAC
| Element | Details |
|---------|---------|
| **Test ID** | 1.4 |
| **Category** | MAC Address Creation |
| **Precondition** | Device with 2 MACs |
| **Action** | POST /devices/{id}/mac with Bluetooth MAC |
| **Input Data** | macType: "Bluetooth", macAddress: "AA:11:BB:22:CC:33" |
| **Expected Status Code** | 201 Created |
| **Post-validation** | GET device returns 3 MACs |
| **Assertions** | status=201, device.macAddresses.length=3 |
| **Estimated Duration** | 2 seconds |

---

## Group 2: MAC Address Retrieval (Tests 2.1 - 2.4)

### 2.1: Get Device by ID with MAC List
| Element | Details |
|---------|---------|
| **Test ID** | 2.1 |
| **Category** | MAC Address Retrieval |
| **Precondition** | Device with 2+ MACs exists |
| **Action** | GET /devices/{id} |
| **Expected Status Code** | 200 OK |
| **Validation Rules** | macAddresses array populated, each MAC has id, deviceId, macType, macAddress, timestamps |
| **Format Validation** | MAC address matches regex: ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ |
| **Assertions** | macAddresses.length >= 2, all MACs have valid format |
| **Estimated Duration** | 1 second |

### 2.2: Search Device by Serial and Verify MACs
| Element | Details |
|---------|---------|
| **Test ID** | 2.2 |
| **Category** | MAC Address Retrieval |
| **Precondition** | Device with known serial number and 2+ MACs |
| **Action** | GET /devices/search?serial={serialNumber} |
| **Expected Status Code** | 200 OK |
| **Expected Response** | Single device object with macAddresses populated |
| **Assertions** | device.macAddresses.length >= 2, all MACs present |
| **Estimated Duration** | 1 second |

### 2.3: List Devices and Verify MACs Accessible
| Element | Details |
|---------|---------|
| **Test ID** | 2.3 |
| **Category** | MAC Address Retrieval |
| **Precondition** | Multiple devices with MACs |
| **Action** | GET /devices?page=1&pageSize=20 |
| **Expected Status Code** | 200 OK |
| **Behavior Note** | MACs may or may not be included in list (design-dependent) |
| **Assertions** | data is array, status=200 |
| **Documentation** | Tests actual behavior regardless of design decision |
| **Estimated Duration** | 1 second |

### 2.4: Verify MAC Ordering (Newest First)
| Element | Details |
|---------|---------|
| **Test ID** | 2.4 |
| **Category** | MAC Address Retrieval |
| **Precondition** | Device with 2+ MACs added with time delays |
| **Action** | GET /devices/{id} multiple times |
| **Expected Status Code** | 200 OK |
| **Ordering Rule** | macAddresses ordered by createdAt DESC (newest first) |
| **Assertions** | First MAC createdAt >= Second MAC createdAt, order consistent |
| **Estimated Duration** | 2 seconds |

---

## Group 3: MAC Address Updates (Tests 3.1 - 3.4)

### 3.1: Update MAC Type (WiFi → Ethernet)
| Element | Details |
|---------|---------|
| **Test ID** | 3.1 |
| **Category** | MAC Address Updates |
| **Precondition** | Device with WiFi MAC |
| **Action** | PUT /devices/{id}/mac/{macId} with new macType |
| **Input Data** | { "macType": "Ethernet" } |
| **Expected Status Code** | 200 OK |
| **Validation Rules** | macType changed, macAddress unchanged, updatedAt timestamp updated |
| **Assertions** | mac.macType="Ethernet", mac.macAddress unchanged, updatedAt > original |
| **Estimated Duration** | 2 seconds |

### 3.2: Update MAC Address (Keep Type)
| Element | Details |
|---------|---------|
| **Test ID** | 3.2 |
| **Category** | MAC Address Updates |
| **Precondition** | Device with Ethernet MAC |
| **Action** | PUT /devices/{id}/mac/{macId} with new macAddress |
| **Input Data** | { "macAddress": "FF:EE:DD:CC:BB:AA" } |
| **Expected Status Code** | 200 OK |
| **Validation Rules** | macAddress changed, macType unchanged |
| **Assertions** | mac.macAddress="FF:EE:DD:CC:BB:AA", mac.macType unchanged |
| **Estimated Duration** | 2 seconds |

### 3.3: Update Both Type and Address
| Element | Details |
|---------|---------|
| **Test ID** | 3.3 |
| **Category** | MAC Address Updates |
| **Precondition** | Device with MAC |
| **Action** | PUT /devices/{id}/mac/{macId} with both fields |
| **Input Data** | { "macType": "Bluetooth", "macAddress": "BB:BB:BB:BB:BB:BB" } |
| **Expected Status Code** | 200 OK |
| **Validation Rules** | Both fields updated, other device properties unchanged |
| **Assertions** | mac.macType="Bluetooth" AND mac.macAddress="BB:BB:BB:BB:BB:BB" |
| **Estimated Duration** | 2 seconds |

### 3.4: Partial Update (Only Type)
| Element | Details |
|---------|---------|
| **Test ID** | 3.4 |
| **Category** | MAC Address Updates |
| **Precondition** | Device with MAC |
| **Action** | PUT /devices/{id}/mac/{macId} with only macType |
| **Input Data** | { "macType": "Other" } |
| **Expected Status Code** | 200 OK |
| **Validation Rules** | macType updated, macAddress preserved |
| **Assertions** | mac.macType="Other", mac.macAddress=original value |
| **Estimated Duration** | 2 seconds |

---

## Group 4: MAC Address Deletion (Tests 4.1 - 4.3)

### 4.1: Delete Single MAC from Multi-MAC Device
| Element | Details |
|---------|---------|
| **Test ID** | 4.1 |
| **Category** | MAC Address Deletion |
| **Precondition** | Device with 2 MACs |
| **Action** | DELETE /devices/{id}/mac/{macId1} |
| **Expected Status Code** | 204 No Content |
| **Post-condition Validation** | GET device shows 1 MAC, correct one remains |
| **Assertions** | Delete returns 204, remaining MAC intact |
| **Estimated Duration** | 2 seconds |

### 4.2: Delete Last MAC from Device
| Element | Details |
|---------|---------|
| **Test ID** | 4.2 |
| **Category** | MAC Address Deletion |
| **Precondition** | Device with 1 MAC |
| **Action** | DELETE /devices/{id}/mac/{macId} |
| **Expected Status Code** | 204 No Content |
| **Post-condition Validation** | Device still exists, macAddresses array is empty |
| **Assertions** | Delete returns 204, device.macAddresses.length=0 |
| **Estimated Duration** | 2 seconds |

### 4.3: Delete All MACs Sequentially
| Element | Details |
|---------|---------|
| **Test ID** | 4.3 |
| **Category** | MAC Address Deletion |
| **Precondition** | Device with 3 MACs |
| **Action** | DELETE /devices/{id}/mac/{macId} three times |
| **Expected Status Code** | 204 No Content (each deletion) |
| **Sequence Validation** | Each delete succeeds, after last delete macAddresses is empty |
| **Assertions** | All 3 deletes return 204, final device.macAddresses.length=0 |
| **Estimated Duration** | 3 seconds |

---

## Group 5: Validation & Error Handling (Tests 5.1 - 5.11)

### 5.1: Invalid MAC Format → 400
| Element | Details |
|---------|---------|
| **Test ID** | 5.1 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists |
| **Action** | POST /devices/{id}/mac with invalid MAC |
| **Input Data** | { "macType": "Ethernet", "macAddress": "INVALID" } |
| **Expected Status Code** | 400 Bad Request |
| **Error Response** | { error: { code: "VALIDATION_ERROR", details: "..." } } |
| **Assertions** | status=400, error.code="VALIDATION_ERROR" |
| **Estimated Duration** | 1 second |

### 5.2: Missing Colons in MAC → 400
| Element | Details |
|---------|---------|
| **Test ID** | 5.2 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists |
| **Action** | POST /devices/{id}/mac with MAC without colons |
| **Input Data** | { "macType": "Ethernet", "macAddress": "AABBCCDDEEFF" } |
| **Expected Status Code** | 400 Bad Request |
| **Assertions** | status=400, error indicates format requirement |
| **Estimated Duration** | 1 second |

### 5.3: Invalid Hex Characters → 400
| Element | Details |
|---------|---------|
| **Test ID** | 5.3 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists |
| **Action** | POST /devices/{id}/mac with invalid hex |
| **Input Data** | { "macType": "Ethernet", "macAddress": "GG:BB:CC:DD:EE:FF" } |
| **Expected Status Code** | 400 Bad Request |
| **Assertions** | status=400 |
| **Estimated Duration** | 1 second |

### 5.4: Invalid MAC Type → 400
| Element | Details |
|---------|---------|
| **Test ID** | 5.4 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists |
| **Action** | POST /devices/{id}/mac with invalid type |
| **Input Data** | { "macType": "InvalidType", "macAddress": "AA:BB:CC:DD:EE:FF" } |
| **Expected Status Code** | 400 Bad Request |
| **Valid Types** | Ethernet, WiFi, Bluetooth, Other |
| **Assertions** | status=400, error.code="VALIDATION_ERROR" |
| **Estimated Duration** | 1 second |

### 5.5: Add MAC to Non-Existent Device → 404
| Element | Details |
|---------|---------|
| **Test ID** | 5.5 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device ID 99999 doesn't exist |
| **Action** | POST /devices/99999/mac |
| **Expected Status Code** | 404 Not Found |
| **Error Response** | { error: { code: "NOT_FOUND" } } |
| **Assertions** | status=404, error.code="NOT_FOUND" |
| **Estimated Duration** | 1 second |

### 5.6: Update MAC on Non-Existent Device → 404
| Element | Details |
|---------|---------|
| **Test ID** | 5.6 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device ID 99999 doesn't exist |
| **Action** | PUT /devices/99999/mac/1 |
| **Expected Status Code** | 404 Not Found |
| **Assertions** | status=404 |
| **Estimated Duration** | 1 second |

### 5.7: Update Non-Existent MAC → 404
| Element | Details |
|---------|---------|
| **Test ID** | 5.7 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists, MAC ID 99999 doesn't exist |
| **Action** | PUT /devices/{validId}/mac/99999 |
| **Expected Status Code** | 404 Not Found |
| **Error Message** | Should indicate "MAC not found" or similar |
| **Assertions** | status=404, error.message contains "not found" |
| **Estimated Duration** | 1 second |

### 5.8: Delete MAC from Non-Existent Device → 404
| Element | Details |
|---------|---------|
| **Test ID** | 5.8 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device ID 99999 doesn't exist |
| **Action** | DELETE /devices/99999/mac/1 |
| **Expected Status Code** | 404 Not Found |
| **Assertions** | status=404 |
| **Estimated Duration** | 1 second |

### 5.9: Delete Non-Existent MAC → 404
| Element | Details |
|---------|---------|
| **Test ID** | 5.9 |
| **Category** | Validation & Error Handling |
| **Precondition** | Device exists, MAC ID 99999 doesn't exist |
| **Action** | DELETE /devices/{validId}/mac/99999 |
| **Expected Status Code** | 404 Not Found |
| **Assertions** | status=404 |
| **Estimated Duration** | 1 second |

### 5.10: Request Without Authentication → 401
| Element | Details |
|---------|---------|
| **Test ID** | 5.10 |
| **Category** | Validation & Error Handling |
| **Precondition** | No authentication token |
| **Action** | POST /devices/{id}/mac without Authorization header |
| **Expected Status Code** | 401 Unauthorized |
| **Error Response** | Authentication error message |
| **Assertions** | status=401 |
| **Estimated Duration** | 1 second |

### 5.11: Non-Admin Role Attempting MAC Addition → 403
| Element | Details |
|---------|---------|
| **Test ID** | 5.11 |
| **Category** | Validation & Error Handling |
| **Precondition** | Logged in as "Requester" role (not IT Support or Admin) |
| **Action** | POST /devices/{id}/mac |
| **Expected Status Code** | 403 Forbidden (or ≥403) |
| **Error Response** | Permission/authorization error |
| **Assertions** | status >= 403, indicates insufficient permissions |
| **Estimated Duration** | 2 seconds |

---

## Group 6: UI Interactions (Tests 6.1 - 6.10)

### 6.1: Login to Frontend
| Element | Details |
|---------|---------|
| **Test ID** | 6.1 |
| **Category** | UI Interactions |
| **Precondition** | Frontend running on http://localhost:3000, user exists |
| **Action** | Navigate to login, enter credentials, submit |
| **Credentials** | marcus.vance@company.com / Passw0rd! |
| **Expected Navigation** | Redirect to /dashboard |
| **Session Validation** | JWT token stored in browser storage |
| **Assertions** | URL contains "dashboard", page loaded |
| **Estimated Duration** | 5 seconds |

### 6.2: Navigate to Device Management
| Element | Details |
|---------|---------|
| **Test ID** | 6.2 |
| **Category** | UI Interactions |
| **Precondition** | Logged in, on dashboard |
| **Action** | Click Device Management navigation item |
| **Expected Outcome** | Device list page loaded |
| **Validation** | Devices displayed in table/grid, network complete |
| **Assertions** | URL contains "device", page fully loaded |
| **Estimated Duration** | 3 seconds |

### 6.3: Create Device via UI
| Element | Details |
|---------|---------|
| **Test ID** | 6.3 |
| **Category** | UI Interactions |
| **Precondition** | On Device Management page |
| **Action** | Click "Add Device" button, fill form, submit |
| **Form Fields** | deviceType, model, serialNumber |
| **Expected Outcome** | Device form modal opens, form populated, device appears in list |
| **Database Validation** | Device created with unique serial number |
| **Assertions** | Device row visible with correct data |
| **Estimated Duration** | 8 seconds |

### 6.4: Open Device and View Existing MACs
| Element | Details |
|---------|---------|
| **Test ID** | 6.4 |
| **Category** | UI Interactions |
| **Precondition** | Device with MACs exists (created via API) |
| **Action** | Navigate to device edit page or click edit button |
| **Expected Outcome** | Device modal opens with all MACs displayed |
| **Display Validation** | MAC type and address visible in form fields |
| **Assertions** | All MACs rendered, correct values shown |
| **Estimated Duration** | 3 seconds |

### 6.5: Add New MAC via UI
| Element | Details |
|---------|---------|
| **Test ID** | 6.5 |
| **Category** | UI Interactions |
| **Precondition** | Device modal open |
| **Action** | Click "Add MAC", select type, enter address |
| **Input Data** | Type: WiFi, Address: 99:88:77:66:55:44 |
| **Expected Outcome** | New MAC input fields appear, form accepts input, MAC visible in form |
| **Database Persistence** | Save device → MAC persisted |
| **Assertions** | New MAC row visible in form |
| **Estimated Duration** | 4 seconds |

### 6.6: Edit Existing MAC Type
| Element | Details |
|---------|---------|
| **Test ID** | 6.6 |
| **Category** | UI Interactions |
| **Precondition** | Device modal open with MACs, edit mode active |
| **Action** | Click edit on MAC, change type dropdown, save |
| **Change** | WiFi → Bluetooth |
| **Expected Outcome** | Type dropdown shows valid options, selection changes |
| **Database Persistence** | Save form → type change persisted |
| **Assertions** | Dropdown updates reflect new type |
| **Estimated Duration** | 4 seconds |

### 6.7: Delete MAC from UI
| Element | Details |
|---------|---------|
| **Test ID** | 6.7 |
| **Category** | UI Interactions |
| **Precondition** | Device modal with multiple MACs |
| **Action** | Click delete button on MAC row, confirm if needed |
| **Expected Outcome** | MAC removed from form UI, confirmation optional |
| **Database Persistence** | Save device → MAC deleted |
| **Assertions** | MAC count decreased after save |
| **Estimated Duration** | 4 seconds |

### 6.8: Validate MAC Format Error Message
| Element | Details |
|---------|---------|
| **Test ID** | 6.8 |
| **Category** | UI Interactions |
| **Precondition** | Add MAC form open |
| **Action** | Enter invalid MAC format, trigger validation |
| **Input Data** | "INVALID" |
| **Expected Outcome** | Error message displays below field |
| **Message Content** | Indicates proper format requirement |
| **UI State** | Save button may be disabled |
| **Assertions** | Error message visible, user can correct input |
| **Estimated Duration** | 3 seconds |

### 6.9: Save Device Form with New MAC
| Element | Details |
|---------|---------|
| **Test ID** | 6.9 |
| **Category** | UI Interactions |
| **Precondition** | Device modal with new MAC added |
| **Action** | Click Save Device button |
| **Expected Outcome** | Form submission succeeds, success message shown |
| **Modal State** | Modal closes on success |
| **API Validation** | POST/PUT to /api/devices succeeds |
| **Database Validation** | Changes persisted, retrievable via GET |
| **Assertions** | Device list updated, changes visible |
| **Estimated Duration** | 3 seconds |

### 6.10: Cancel Modal Without Saving
| Element | Details |
|---------|---------|
| **Test ID** | 6.10 |
| **Category** | UI Interactions |
| **Precondition** | Device modal with unsaved changes |
| **Action** | Click Cancel button |
| **Expected Outcome** | Modal closes, changes not persisted |
| **Reopen Validation** | Reopen device shows original values |
| **Database State** | Unchanged from before modal opened |
| **Assertions** | Changes discarded, no API calls made |
| **Estimated Duration** | 3 seconds |

---

## Test Execution Checklist

### Pre-Test (Setup)
- [ ] Backend running on http://localhost:4000
- [ ] Frontend running on http://localhost:3000
- [ ] MySQL database initialized with seed data
- [ ] npm dependencies installed
- [ ] Playwright browsers installed

### During Test
- [ ] Tests execute in serial mode (for state consistency)
- [ ] No external interruptions (network, database restarts)
- [ ] Browser window available (for UI tests)
- [ ] Console logs capture all [AUTH], [DEVICE], [MAC] prefixed messages

### Post-Test
- [ ] Review mac-address-tests.log for all test outputs
- [ ] Verify all 36 tests completed
- [ ] Check HTML report (if generated)
- [ ] Document any failures with reproduction steps

---

## Test Result Template

```
Test Execution: [DATE_TIME]
Backend: http://localhost:4000
Frontend: http://localhost:3000

SUMMARY:
  Total Tests: 36
  Passed: __
  Failed: __
  Skipped: __
  Duration: __

GROUP 1: MAC Address Creation
  [✓/✗] 1.1 - Create device and add WiFi MAC
  [✓/✗] 1.2 - Add Ethernet MAC to same device
  [✓/✗] 1.3 - Verify both MACs present in device
  [✓/✗] 1.4 - Add Bluetooth MAC

GROUP 2: MAC Address Retrieval
  [✓/✗] 2.1 - Get device by ID with MAC list
  [✓/✗] 2.2 - Search device by serial
  [✓/✗] 2.3 - List devices and verify MACs
  [✓/✗] 2.4 - Verify MAC ordering

GROUP 3: MAC Address Updates
  [✓/✗] 3.1 - Update MAC type
  [✓/✗] 3.2 - Update MAC address
  [✓/✗] 3.3 - Update both type and address
  [✓/✗] 3.4 - Partial update

GROUP 4: MAC Address Deletion
  [✓/✗] 4.1 - Delete single MAC
  [✓/✗] 4.2 - Delete last MAC
  [✓/✗] 4.3 - Delete all MACs sequentially

GROUP 5: Validation & Error Handling
  [✓/✗] 5.1 - Invalid MAC format → 400
  [✓/✗] 5.2 - Missing colons → 400
  [✓/✗] 5.3 - Invalid hex → 400
  [✓/✗] 5.4 - Invalid MAC type → 400
  [✓/✗] 5.5 - Non-existent device → 404
  [✓/✗] 5.6 - Update non-existent device → 404
  [✓/✗] 5.7 - Update non-existent MAC → 404
  [✓/✗] 5.8 - Delete from non-existent device → 404
  [✓/✗] 5.9 - Delete non-existent MAC → 404
  [✓/✗] 5.10 - No authentication → 401
  [✓/✗] 5.11 - Insufficient permissions → 403

GROUP 6: UI Interactions
  [✓/✗] 6.1 - Login to frontend
  [✓/✗] 6.2 - Navigate to Device Management
  [✓/✗] 6.3 - Create device via UI
  [✓/✗] 6.4 - Open device and view MACs
  [✓/✗] 6.5 - Add new MAC via UI
  [✓/✗] 6.6 - Edit existing MAC type
  [✓/✗] 6.7 - Delete MAC from UI
  [✓/✗] 6.8 - Validate MAC format error
  [✓/✗] 6.9 - Save device with new MAC
  [✓/✗] 6.10 - Cancel without saving

FAILURES:
  [Test ID] - [Failure Description]

NOTES:
  - [Any observations or issues]
```

---

## Quick Reference: Test Filtering

```bash
# Run all tests
npx playwright test tests/mac-address.spec.ts

# Run specific group
npx playwright test tests/mac-address.spec.ts -g "MAC Address Creation"

# Run specific test
npx playwright test tests/mac-address.spec.ts -g "1.1"

# Run error handling only
npx playwright test tests/mac-address.spec.ts -g "Validation"

# Run UI tests only
npx playwright test tests/mac-address.spec.ts -g "UI Interactions"

# Run API tests only (exclude group 6)
# Requires test modification or use --grep with negative lookahead
```

---

## Test Dependencies

### Test 1.1
- **Depends on**: Authentication setup, backend running
- **Used by**: Tests 1.2, 1.3, 1.4

### Test 2.1 - 2.4
- **Depends on**: Fresh device creation (beforeEach)
- **Independent**: Each runs with own test device

### Test 3.1 - 3.4
- **Depends on**: Fresh device creation (beforeEach)
- **Independent**: Each runs with own test device

### Test 4.1 - 4.3
- **Depends on**: Fresh device creation
- **Independent**: Each runs with own test device

### Test 5.1 - 5.11
- **Depends on**: Fresh device creation (beforeEach for most)
- **Independent**: No shared state between tests

### Test 6.1 - 6.10
- **Depends on**: Browser page creation (test.beforeAll)
- **Sequential**: Some tests depend on previous navigation/login
- **Note**: All UI tests use single shared browser page

---

## Expected Output

A successful test run will display:

```
[SETUP] Authentication token captured
[DEVICE CREATE] Device ITA-2026-0001 (id=1) created
[MAC ADD] Added WiFi MAC (AA:BB:CC:DD:EE:FF) to device 1
[MAC ADD] Added Ethernet MAC (11:22:33:44:55:66) to device 1
✓ WiFi MAC created successfully
✓ Ethernet MAC created successfully
✓ Both MACs verified in device details
...
✓ Invalid MAC format returns 400 VALIDATION_ERROR
...
✓ Logged in successfully
✓ Navigated to Device Management
✓ Device created via UI
...
========== TEST CLEANUP ==========
Deleting test devices...
✓ Cleaned up device 1
========== TEST SUMMARY ==========
✓ All MAC address functionality tests completed
```

---

## Maintenance and Updates

### When to Update Test Cases
- API endpoint paths change
- Response structure changes
- Validation rules change
- UI selectors change
- New MAC types added

### Version Control
- Keep tests in Git
- Tag releases with version numbers
- Document breaking changes in CHANGELOG
- Review tests during sprint planning

---

## Contact & Support

For detailed test execution instructions, see: `MAC_ADDRESS_TESTING_GUIDE.md`
For test plan overview, see: `MAC_ADDRESS_TEST_PLAN.md`
