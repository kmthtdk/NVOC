# MAC Address Feature Documentation

## Overview

The MAC address feature enables IT Support administrators to track and manage multiple MAC addresses (Ethernet, WiFi, Bluetooth, Other) associated with each device in the inventory. This is essential for network administration, device tracking, and troubleshooting in IT operations.

### Why This Feature

- **Network Management**: Map physical devices to network interfaces for DHCP/DNS configuration
- **Device Identification**: Link multiple connectivity standards (wired and wireless) to single devices
- **Compliance & Auditing**: Track network-connected assets for security and compliance purposes
- **Troubleshooting**: Quickly identify devices by MAC address during network diagnostics

## Database Schema

### mac_addresses Table

The `mac_addresses` table stores MAC addresses with a one-to-many relationship to devices.

```sql
CREATE TABLE IF NOT EXISTS mac_addresses (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id   INT UNSIGNED NOT NULL,
  mac_type    ENUM('Ethernet','WiFi','Bluetooth','Other') NOT NULL DEFAULT 'Ethernet',
  mac_address VARCHAR(17)  NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_macs_device (device_id),
  KEY idx_macs_mac (mac_address),
  CONSTRAINT fk_macs_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| `id` | INT UNSIGNED | Unique identifier for this MAC record |
| `device_id` | INT UNSIGNED | Foreign key referencing `devices.id`; cascade on delete |
| `mac_type` | ENUM | Connection type: `Ethernet`, `WiFi`, `Bluetooth`, or `Other` |
| `mac_address` | VARCHAR(17) | MAC in format `XX:XX:XX:XX:XX:XX` (case-insensitive) |
| `created_at` | TIMESTAMP | UTC timestamp when record created; auto-set |
| `updated_at` | TIMESTAMP | UTC timestamp when record last updated; auto-updated |

### Indexes

- **idx_macs_device**: Optimizes lookups by `device_id` for fetching all MACs of a device
- **idx_macs_mac**: Optimizes lookups by `mac_address` for reverse DNS or auditing

### Relationships

- **One-to-Many**: Each device can have 0 or more MAC addresses
- **Cascade Delete**: Deleting a device automatically removes all its MAC addresses
- **No Unique Constraint**: A device can have duplicate MAC addresses (unusual but allowed for flexibility)

## API Endpoints

All MAC address endpoints require authentication (Bearer token) and are restricted to `it_support` and `admin` roles.

### POST /api/devices/:id/mac

**Create a new MAC address for a device.**

**Authentication**: Required (`it_support`, `admin`)

**Request**
```json
{
  "macType": "WiFi",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes (URL) | Device ID |
| `macType` | string | Yes | One of: `Ethernet`, `WiFi`, `Bluetooth`, `Other` |
| `macAddress` | string | Yes | Format: `XX:XX:XX:XX:XX:XX` (hex pairs with colons) |

**Response** (201 Created)
```json
{
  "data": {
    "id": 42,
    "deviceId": 5,
    "macType": "WiFi",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:30:00Z"
  }
}
```

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid MAC format or missing fields |
| 404 | NOT_FOUND | Device does not exist |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | Insufficient permissions (requester role) |

**Example**
```bash
curl -X POST http://localhost:4000/api/devices/5/mac \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "macType": "Ethernet",
    "macAddress": "00:11:22:33:44:55"
  }'
```

---

### PUT /api/devices/:id/mac/:macId

**Update an existing MAC address.**

**Authentication**: Required (`it_support`, `admin`)

**Request**
```json
{
  "macType": "Bluetooth",
  "macAddress": "FF:EE:DD:CC:BB:AA"
}
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes (URL) | Device ID |
| `macId` | integer | Yes (URL) | MAC address ID |
| `macType` | string | No | New connection type |
| `macAddress` | string | No | New MAC address (format: `XX:XX:XX:XX:XX:XX`) |

**Notes**
- Either or both fields can be updated
- Partial updates allowed (e.g., update only `macType`)

**Response** (200 OK)
```json
{
  "data": {
    "id": 42,
    "deviceId": 5,
    "macType": "Bluetooth",
    "macAddress": "FF:EE:DD:CC:BB:AA",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:35:00Z"
  }
}
```

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid MAC format |
| 404 | NOT_FOUND | Device or MAC address not found, or MAC does not belong to device |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | Insufficient permissions |

**Example**
```bash
curl -X PUT http://localhost:4000/api/devices/5/mac/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "macType": "WiFi"
  }'
```

---

### DELETE /api/devices/:id/mac/:macId

**Remove a MAC address from a device.**

**Authentication**: Required (`it_support`, `admin`)

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes (URL) | Device ID |
| `macId` | integer | Yes (URL) | MAC address ID |

**Response** (204 No Content)

**Error Responses**

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | Device or MAC address not found |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | Insufficient permissions |

**Example**
```bash
curl -X DELETE http://localhost:4000/api/devices/5/mac/42 \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/devices/:id

**Retrieve device details with all associated MAC addresses.**

**Authentication**: Required (any authenticated user)

**Response** (200 OK)
```json
{
  "data": {
    "id": 5,
    "code": "ITA-2026-0001",
    "deviceType": "laptop",
    "model": "Dell XPS 15",
    "serialNumber": "SN-12345",
    "status": "Active",
    "assignedTo": "John Doe",
    "department": "IT Operations",
    "purchaseDate": "2024-06-15",
    "warrantyExpiry": "2026-06-15",
    "notes": "Development machine",
    "createdAt": "2026-01-10T08:00:00Z",
    "updatedAt": "2026-01-15T10:35:00Z",
    "linkedTickets": [],
    "macAddresses": [
      {
        "id": 42,
        "deviceId": 5,
        "macType": "Ethernet",
        "macAddress": "00:11:22:33:44:55",
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-01-15T10:30:00Z"
      },
      {
        "id": 43,
        "deviceId": 5,
        "macType": "WiFi",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "createdAt": "2026-01-15T10:31:00Z",
        "updatedAt": "2026-01-15T10:31:00Z"
      }
    ]
  }
}
```

**Notes**
- MAC addresses are ordered by `created_at DESC` (newest first)
- `macAddresses` array is only included if the device has at least one MAC
- Available to any authenticated user (read permission)

## Frontend Components

### DeviceFormModal

The `DeviceFormModal` component handles device creation and editing, with integrated MAC address management. It supports both adding new MACs during device creation and managing MACs for existing devices.

**Location**: `/src/components/DeviceFormModal.tsx`

#### Props

```typescript
interface DeviceFormModalProps {
  device?: Device | null;              // Device to edit; undefined for create mode
  onClose: () => void;                  // Called when modal is closed
  onSaved: (device: Device) => void;    // Called after successful save
  apiBaseUrl?: string;                  // API base URL; defaults to '/api'
  authToken?: string;                   // Bearer token for requests
}
```

#### MAC Address Management UI

The component includes a dedicated "MAC Addresses" section that appears after the device details form.

**Features**:
- **Add MAC**: Click "Add MAC Address" button to reveal form
- **View MACs**: List existing MACs with type badge and status indicator
- **Edit MAC**: Click the edit icon to modify type or address
- **Delete MAC**: Click the trash icon to remove (with visual confirmation)
- **Status Indicators**:
  - `New` (green): MAC added but not yet persisted
  - `Edited` (blue): MAC modified from its original state
  - No badge: MAC unchanged since device load

#### Form Validation

MAC addresses are validated client-side with the regex pattern:
```regex
^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$
```

Valid formats:
- `00:11:22:33:44:55` ✓
- `AA:BB:CC:DD:EE:FF` ✓
- `aA:bB:cC:dD:eE:fF` ✓ (mixed case)

Invalid formats:
- `AABBCCDDEEFF` ✗ (no colons)
- `AA:BB:CC:DD:EE` ✗ (too short)
- `GG:BB:CC:DD:EE:FF` ✗ (invalid hex)

#### State Management

**Internal State**:
```typescript
interface MacAddressState {
  id: number;                              // Temp ID for new MACs (negative)
  macType: MacAddressType;
  macAddress: string;
  isNew?: boolean;                         // True if not yet persisted
  originalValues?: { macType; macAddress }; // Set if edited
}
```

#### Create Flow (New Device)

1. Fill device details form
2. Click "Add MAC Address"
3. Enter MAC type and address
4. Click "Add" to add to local list (MACs marked as `isNew`)
5. Click "Create Device" to submit
6. Backend receives `macAddresses[]` in POST body
7. Device and MACs created atomically

#### Edit Flow (Existing Device)

1. Modal loads with existing MACs from device
2. User can:
   - **Add**: Click "Add MAC Address", enter details, click "Add"
   - **Modify**: Click edit icon, change type/address, click "Save"
   - **Delete**: Click trash icon (immediately removed from UI)
3. Click "Save Changes" to persist all changes:
   - New MACs: POST to `/devices/:id/mac`
   - Modified MACs: PUT to `/devices/:id/mac/:macId`
   - Deleted MACs: DELETE to `/devices/:id/mac/:macId`
4. Device is refreshed to fetch updated MAC list
5. Success toast displayed

## Implementation Guide

### Step 1: Install Dependencies

The feature uses standard libraries already in the project:
- `mysql2/promise` - Database driver
- `zod` - Validation
- `express` - HTTP framework

No additional packages needed.

### Step 2: Database Migration

Run the migration script to create the `mac_addresses` table:

```bash
mysql -u root -p your_database < database/init/04_mac_addresses.sql
```

Verify the table was created:
```bash
mysql -u root -p your_database -e "DESCRIBE mac_addresses;"
```

### Step 3: Backend Type Definitions

Types are already defined in `/backend/src/types/index.ts`:

```typescript
export type MacAddressType = 'Ethernet' | 'WiFi' | 'Bluetooth' | 'Other';

export interface MacAddress {
  id: number;
  deviceId: number;
  macType: MacAddressType;
  macAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface MacAddressInput {
  macType: MacAddressType;
  macAddress: string;
}
```

### Step 4: Repository Methods

The `deviceRepo` already implements all MAC operations in `/backend/src/models/device.repo.ts`:

```typescript
// Fetch all MACs for a device
await deviceRepo.getMacsByDeviceId(deviceId): Promise<MacAddress[]>

// Add MAC to device (within transaction)
await deviceRepo.addMacAddress(conn, deviceId, macType, macAddress): Promise<MacAddress>

// Update MAC (within transaction)
await deviceRepo.updateMacAddress(conn, macId, { macType?, macAddress? }): Promise<MacAddress>

// Delete MAC (within transaction)
await deviceRepo.removeMacAddress(conn, macId): Promise<void>
```

### Step 5: API Routes

Routes are registered in `/backend/src/routes/device.routes.ts`:

```typescript
// POST /devices/:id/mac — Create MAC (it_support, admin)
deviceRoutes.post('/:id/mac', authenticate, requireRole('it_support', 'admin'), 
  validateBody(macAddressSchema), asyncHandler(deviceController.createMac));

// PUT /devices/:id/mac/:macId — Update MAC (it_support, admin)
deviceRoutes.put('/:id/mac/:macId', authenticate, requireRole('it_support', 'admin'),
  validateBody(updateMacSchema), asyncHandler(deviceController.updateMac));

// DELETE /devices/:id/mac/:macId — Delete MAC (it_support, admin)
deviceRoutes.delete('/:id/mac/:macId', authenticate, requireRole('it_support', 'admin'),
  asyncHandler(deviceController.removeMac));
```

### Step 6: Frontend Component

The `DeviceFormModal` is already integrated in the codebase. Use it as:

```typescript
import DeviceFormModal from './components/DeviceFormModal';

function MyDeviceManager() {
  const [modal, setModal] = useState<Device | null>(null);

  return (
    <>
      {modal && (
        <DeviceFormModal
          device={modal}
          onClose={() => setModal(null)}
          onSaved={(device) => {
            // Refresh device list
            setModal(null);
          }}
          authToken={yourToken}
        />
      )}
    </>
  );
}
```

### Step 7: Validation Schemas

Zod schemas are defined in `/backend/src/controllers/device.controller.ts`:

```typescript
const macAddressSchema = z.object({
  macType: z.enum(['Ethernet', 'WiFi', 'Bluetooth', 'Other']),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, 
      'MAC address must be in format 00:00:00:00:00:00'),
});

const updateMacSchema = z.object({
  macType: z.enum(['Ethernet', 'WiFi', 'Bluetooth', 'Other']).optional(),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/).optional(),
});
```

## Testing

### Unit Tests

Run the comprehensive MAC address test suite:

```bash
npx playwright test tests/mac-address.spec.ts
```

### Prerequisites

- Backend running: `npm run dev:backend` (port 4000)
- Frontend running: `npm run dev:frontend` (port 3000)
- Database initialized with seed data
- Test credentials available in `tests/mac-address.spec.ts`

### Test Coverage

The test suite (`tests/mac-address.spec.ts`) covers:

**Test Group 1**: MAC Address Creation (4 tests)
- Create device and add WiFi MAC
- Add Ethernet MAC to same device
- Verify both MACs present in device
- Add Bluetooth MAC

**Test Group 2**: MAC Address Retrieval (4 tests)
- Get device by ID with MAC list
- Search device by serial and verify MACs
- List devices and verify MACs accessible
- Verify MAC ordering (newest first)

**Test Group 3**: MAC Address Updates (4 tests)
- Update MAC type (WiFi → Ethernet)
- Update MAC address (keep type)
- Update both type and address
- Partial update (only macType)

**Test Group 4**: MAC Address Deletion (3 tests)
- Delete single MAC from device with multiple
- Delete last MAC from device
- Delete all MACs sequentially

**Test Group 5**: Validation & Error Handling (11 tests)
- Invalid MAC format → 400
- Missing colons in MAC → 400
- Invalid hex in MAC → 400
- Invalid MAC type → 400
- Add MAC to non-existent device → 404
- Update MAC on non-existent device → 404
- Update non-existent MAC → 404
- Delete MAC from non-existent device → 404
- Delete non-existent MAC → 404
- Request without authentication → 401
- Requester role trying to add MAC → 403

**Test Group 6**: UI Interactions (12 tests)
- Login to frontend
- Navigate to Device Management
- Create device via UI
- Open device edit modal and view existing MACs
- Add new MAC via UI
- Edit existing MAC type
- Delete MAC via UI
- Validate MAC format error message
- Save device form with new MAC
- Cancel modal without saving

### Running Individual Test Groups

```bash
# Only MAC creation tests
npx playwright test tests/mac-address.spec.ts -g "MAC Address Creation"

# Only validation tests
npx playwright test tests/mac-address.spec.ts -g "Validation & Error Handling"

# Only UI tests
npx playwright test tests/mac-address.spec.ts -g "UI Interactions"
```

### Manual Testing Checklist

```
Device Creation with MACs:
[ ] Create device without MACs
[ ] Create device with single MAC
[ ] Create device with multiple MACs (Ethernet + WiFi)
[ ] Verify MACs appear in device details

Device Editing:
[ ] Edit existing device, add new MAC
[ ] Edit existing device, modify MAC type
[ ] Edit existing device, modify MAC address
[ ] Edit existing device, delete MAC
[ ] Verify all changes persisted

Device Search:
[ ] Search device by serial number
[ ] Verify MACs included in search result
[ ] List devices with pagination
[ ] Verify MACs included in full device view

Error Handling:
[ ] Try adding invalid MAC format → should show error
[ ] Try updating non-existent device → 404
[ ] Try deleting non-existent MAC → 404
[ ] Try adding MAC without authentication → 401
[ ] Try adding MAC with requester role → 403
```

## Examples

### Example 1: Create Device with Multiple MACs via API

**Request**:
```bash
curl -X POST http://localhost:4000/api/devices \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "deviceType": "laptop",
    "model": "Dell XPS 15",
    "serialNumber": "SN-DELL-2026-001",
    "status": "Active",
    "assignedTo": "John Doe",
    "department": "Engineering",
    "purchaseDate": "2026-01-10",
    "warrantyExpiry": "2028-01-10",
    "notes": "Developer machine",
    "macAddresses": [
      {
        "macType": "Ethernet",
        "macAddress": "00:11:22:33:44:55"
      },
      {
        "macType": "WiFi",
        "macAddress": "AA:BB:CC:DD:EE:FF"
      }
    ]
  }'
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 15,
    "code": "ITA-2026-0015",
    "deviceType": "laptop",
    "model": "Dell XPS 15",
    "serialNumber": "SN-DELL-2026-001",
    "status": "Active",
    "assignedTo": "John Doe",
    "department": "Engineering",
    "purchaseDate": "2026-01-10",
    "warrantyExpiry": "2028-01-10",
    "notes": "Developer machine",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T10:30:00Z",
    "linkedTickets": [],
    "macAddresses": [
      {
        "id": 58,
        "deviceId": 15,
        "macType": "Ethernet",
        "macAddress": "00:11:22:33:44:55",
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-01-15T10:30:00Z"
      },
      {
        "id": 59,
        "deviceId": 15,
        "macType": "WiFi",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-01-15T10:30:00Z"
      }
    ]
  }
}
```

### Example 2: Update Device and Add MAC

**Request**:
```bash
# First, add a new Bluetooth MAC to the device
curl -X POST http://localhost:4000/api/devices/15/mac \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "macType": "Bluetooth",
    "macAddress": "11:22:33:44:55:66"
  }'
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 60,
    "deviceId": 15,
    "macType": "Bluetooth",
    "macAddress": "11:22:33:44:55:66",
    "createdAt": "2026-01-15T11:00:00Z",
    "updatedAt": "2026-01-15T11:00:00Z"
  }
}
```

### Example 3: Update Existing MAC

**Request**:
```bash
curl -X PUT http://localhost:4000/api/devices/15/mac/58 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "macType": "WiFi",
    "macAddress": "FF:EE:DD:CC:BB:AA"
  }'
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 58,
    "deviceId": 15,
    "macType": "WiFi",
    "macAddress": "FF:EE:DD:CC:BB:AA",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-01-15T11:05:00Z"
  }
}
```

### Example 4: Frontend - Create Device with MACs

```typescript
import { useState } from 'react';
import DeviceFormModal from './components/DeviceFormModal';

export default function DeviceManager() {
  const [isOpen, setIsOpen] = useState(false);
  const token = localStorage.getItem('authToken');

  const handleSaved = (device) => {
    console.log('Device saved:', device);
    // Refresh device list or navigate
  };

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Add Device</button>
      
      {isOpen && (
        <DeviceFormModal
          onClose={() => setIsOpen(false)}
          onSaved={handleSaved}
          authToken={token}
        />
      )}
    </div>
  );
}
```

User flow:
1. Click "Add Device"
2. Fill device details (type, model, serial, etc.)
3. Click "Add MAC Address"
4. Enter MAC type: "Ethernet", address: "00:11:22:33:44:55"
5. Click "Add" button (local state updated)
6. Click "Add MAC Address" again
7. Enter MAC type: "WiFi", address: "AA:BB:CC:DD:EE:FF"
8. Click "Add" button (local state updated)
9. Click "Create Device" to submit
10. Backend creates device and both MACs in atomic transaction
11. Success toast: "Device ITA-2026-XXXX created"

## Troubleshooting

### Issue: "Invalid MAC format" validation error

**Cause**: MAC address does not match pattern `XX:XX:XX:XX:XX:XX`

**Solutions**:
- Ensure colons (`:`) separate hex pairs
- Use uppercase or lowercase (mixed is OK)
- Exactly 6 pairs of 2-digit hex values
- No spaces or dashes

Valid examples:
```
00:11:22:33:44:55
AA:BB:CC:DD:EE:FF
aA:bB:cC:dD:eE:fF
```

Invalid examples:
```
AABBCCDDEEFF (no colons)
00-11-22-33-44-55 (dashes instead of colons)
00:11:22:33:44 (only 5 pairs)
00:11:22:33:44:GG (GG is not hex)
```

---

### Issue: "MAC address not found on this device" error when updating

**Cause**: The MAC ID provided does not belong to the specified device

**Solutions**:
- Verify device ID is correct
- Verify MAC ID is correct
- Check that MAC actually belongs to that device:

```bash
curl -X GET http://localhost:4000/api/devices/15 \
  -H "Authorization: Bearer <token>" \
  | jq '.data.macAddresses'
```

---

### Issue: Cannot add MAC due to 401 Unauthorized

**Cause**: Missing or invalid authentication token

**Solutions**:
- Verify token is passed in Authorization header: `Authorization: Bearer <token>`
- Token may have expired; re-authenticate
- Ensure token is correctly formatted (no extra spaces)

**Test authentication**:
```bash
curl -X GET http://localhost:4000/api/devices \
  -H "Authorization: Bearer <token>"
```

If this returns 401, token is invalid.

---

### Issue: Cannot add MAC due to 403 Forbidden

**Cause**: User role is not `it_support` or `admin`

**Solutions**:
- MAC management requires IT Support role or higher
- Contact administrator to upgrade your role
- Check your current role:

```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <token>" \
  | jq '.role'
```

---

### Issue: Device created but MACs not saved

**Cause**: MACs array was not included in device creation request

**Solutions**:
- Include `macAddresses` array in POST body:

```json
{
  "deviceType": "laptop",
  "model": "Dell XPS 15",
  "serialNumber": "SN-123",
  "status": "Active",
  "macAddresses": [
    {
      "macType": "Ethernet",
      "macAddress": "00:11:22:33:44:55"
    }
  ]
}
```

- If adding MACs after device creation, use separate POST to `/devices/:id/mac`

---

### Issue: Frontend modal does not show existing MACs

**Cause**: Device data not loaded or API call failed

**Solutions**:
- Check browser console for network errors
- Verify device ID is correct
- Ensure token is valid
- Check that GET `/devices/:id` returns `macAddresses` array

```bash
curl -X GET http://localhost:4000/api/devices/15 \
  -H "Authorization: Bearer <token>" \
  | jq '.data.macAddresses'
```

---

### Issue: MAC deleted from UI but persists in database

**Cause**: Delete request failed but UI state was cleared

**Solutions**:
- Check browser console Network tab for failed DELETE requests
- Verify device and MAC IDs are correct
- Verify authentication token is valid
- Reload page to sync UI with database state

---

### Issue: Performance slow when listing devices with many MACs

**Cause**: N+1 query problem (fetching MACs individually for each device)

**Solutions**:
- Use `GET /devices/:id` for full device details (includes MACs)
- Avoid repeatedly calling MAC endpoints in loops
- Consider pagination: `GET /devices?page=1&pageSize=20`

---

### Issue: Unable to differentiate between old and new MACs in edit mode

**Cause**: Frontend state not tracking edit history properly

**Solutions**:
- Look for status badges in MAC list:
  - `New` (green) = Not yet persisted
  - `Edited` (blue) = Modified from original
  - No badge = Unchanged
- Check browser console to inspect `macAddresses` state
- Check database directly to verify saved state

---

### Issue: Cannot delete device due to foreign key constraint

**Cause**: MAC addresses exist but DELETE cascade failed

**Solutions**:
- Should not occur if database schema is correct
- Verify cascade rule exists:

```sql
SHOW CREATE TABLE mac_addresses\G
```

Look for:
```
CONSTRAINT fk_macs_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
```

- If cascade rule missing, recreate table:

```bash
mysql -u root -p your_database < database/init/04_mac_addresses.sql
```

---

## API Contract Summary

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/devices` | it_support, admin | Create device (with optional MACs) |
| GET | `/devices/:id` | Any authenticated | Get device with MACs |
| GET | `/devices/search?serial=X` | Any authenticated | Search device with MACs |
| GET | `/devices?page=X` | Any authenticated | List devices |
| PUT | `/devices/:id` | it_support, admin | Update device fields |
| DELETE | `/devices/:id` | admin | Delete device (cascades to MACs) |
| **POST** | **`/devices/:id/mac`** | **it_support, admin** | **Add MAC to device** |
| **PUT** | **`/devices/:id/mac/:macId`** | **it_support, admin** | **Update MAC** |
| **DELETE** | **`/devices/:id/mac/:macId`** | **it_support, admin** | **Delete MAC** |

Bold indicates MAC-specific endpoints.

## Database Queries

### Get all MACs for a device

```sql
SELECT * FROM mac_addresses WHERE device_id = ? ORDER BY created_at DESC;
```

### Find device by MAC address

```sql
SELECT d.* FROM devices d
INNER JOIN mac_addresses m ON d.id = m.device_id
WHERE m.mac_address = ?;
```

### Get MAC statistics

```sql
SELECT
  m.mac_type,
  COUNT(*) as count
FROM mac_addresses m
GROUP BY m.mac_type;
```

### Find devices without any MACs

```sql
SELECT d.* FROM devices d
WHERE d.id NOT IN (SELECT DISTINCT device_id FROM mac_addresses);
```

### Audit: Show all MAC modifications in last 7 days

```sql
SELECT 
  m.id, 
  d.code,
  m.mac_address,
  m.mac_type,
  m.updated_at
FROM mac_addresses m
INNER JOIN devices d ON m.device_id = d.id
WHERE m.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY m.updated_at DESC;
```

---

**Documentation Version**: 1.0  
**Last Updated**: 2026-01-15  
**Feature Status**: Production Ready
