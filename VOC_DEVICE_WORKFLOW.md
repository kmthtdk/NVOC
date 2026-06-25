# VOC-Device Inventory Workflow Integration

## Overview
The system now synchronizes VOC (Service Request) tickets with IT Device Inventory. When users submit hardware-related VOC requests, the system automatically manages device records.

## Workflow Scenarios

### 1. **New Device Request** (`deviceAction='new'`)
**User Action:** Submits VOC request "Need new laptop"

**System Actions:**
- Creates device record in `it_devices` table
  - Status: `in_stock` (awaiting assignment)
  - Serial number: Temporary ID (`TEMP-<ticketId>-<timestamp>`)
  - Device type: Extracted from VOC subcategory
  - Department: Set from requester's department
  - Specifications: CPU, RAM, Storage, GPU, PSU saved from request
- Links ticket to device via `ticket_device_links` table with `action='new'`
- Adds history entry: "Device {ITA-CODE} created for this request"

**When Admin Resolves Ticket:**
- Admin assigns device to specific user (via modal)
- System updates device:
  - `assigned_to`: Set to selected user
  - `status`: Changes from `in_stock` → `active`
- Device appears in user's equipment list on dashboard

---

### 2. **Device Repair Request** (`deviceAction='repair'`)
**User Action:** Submits VOC "Laptop needs repair" with serial number

**System Actions:**
- Searches for device by serial number
- If found:
  - Links ticket to existing device via `ticket_device_links` with `action='repair'`
  - Updates device status: `active` → `in_repair`
  - Adds history: "Device {ITA-CODE} linked to this repair request"
- If not found:
  - Logs warning but still creates ticket (doesn't fail)
  - Admin can link manually later

**When Admin Resolves Ticket:**
- Admin marks ticket as resolved
- Can update device condition (good/fair/poor)
- Device status returns to: `active` (if fully repaired) or `retired` (if unrepairable)

---

### 3. **Device Return Request** (`deviceAction='return'`)
**User Action:** Submits VOC "Return device" with serial number

**System Actions:**
- Searches for device by serial number
- If found:
  - Links ticket to device with `action='return'`
  - Updates device status: `active` → `in_repair` (preparing for return)
  - Adds history: "Device {ITA-CODE} marked for return"

**When Admin Resolves Ticket:**
- Admin marks device as returned with condition assessment
- Device status updates: `in_repair` → `retired`
- `assigned_to` cleared (unassigned from user)
- Device available for:
  - Refurbishment and reassignment
  - Donation or recycling
  - Inventory purge

---

## Database Schema

### ticket_device_links Table
Links VOC requests to device inventory records:
```sql
CREATE TABLE ticket_device_links (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id      BIGINT UNSIGNED NOT NULL,
  device_id      INT UNSIGNED NOT NULL,
  action_type    ENUM('new', 'repair', 'return', 'replace') NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Device Status Transitions
```
NEW DEVICE:
in_stock → active (when assigned to user)
         → retired (if canceled)

REPAIR REQUEST:
active → in_repair (when repair request submitted)
       → active (when resolved as repaired)
       → retired (when resolved as unrepairable)

RETURN REQUEST:
active → in_repair (when return request submitted)
       → retired (when actually returned)
```

---

## API Integration

### Create VOC with Device
**Endpoint:** `POST /api/tickets`

**Payload Example:**
```json
{
  "title": "Need new laptop",
  "description": "Developer needs MacBook Pro",
  "category": "hardware_request",
  "subcategory": "laptop",
  "requesterName": "John Doe",
  "requesterEmail": "john@company.com",
  "requesterDept": "Engineering",
  "deviceAction": "new",
  "deviceType": "laptop",
  "deviceModel": "MacBook Pro 14-inch",
  "specifications": {
    "cpu": "Apple M3 Pro",
    "ramGb": 16,
    "storageGb": 512,
    "gpu": "Integrated",
    "psuWatts": null
  }
}
```

### Link Existing Device to VOC
**Endpoint:** `POST /api/tickets`

**Payload for Repair:**
```json
{
  "title": "Laptop screen replacement",
  "description": "Screen cracked, needs replacement",
  "category": "hardware_request",
  "subcategory": "repair",
  "deviceAction": "repair",
  "deviceSerialNumber": "SN-DL-XPS-0041"
}
```

### Device Assignment
**Endpoint:** `PUT /api/devices/{deviceId}`

**Payload:**
```json
{
  "assignedTo": "jane.smith@company.com",
  "status": "active"
}
```

---

## Frontend Integration (RequestForm Component)

The `RequestForm.tsx` component includes:

1. **Hardware Category Detection**
   - When category="hardware_request", show additional device fields

2. **Device Action Selection**
   - Dropdown: New Device / Repair / Return / Replace

3. **Conditional Fields**
   - **For New Device:**
     - Device Model, Brand, CPU, RAM, Storage, GPU, PSU inputs
   - **For Repair/Return:**
     - Serial Number search with auto-fill
     - Device condition dropdown
     - Reason for change textarea

4. **Device Search**
   - `handleSerialSearch()` function
   - Calls `GET /api/devices/serial/{serialNumber}`
   - Auto-fills device details if found

---

## Admin Device Assignment Workflow

When resolving a hardware request VOC:

1. **DeviceAssignmentModal** appears if ticket has linked device
2. Admin selects:
   - User to assign device to (dropdown)
   - Device condition (optional)
   - Delivery location (optional notes)
3. System updates:
   - `device.assigned_to` = selected user
   - `device.status` = 'active'
   - `ticket_history` entry logged
   - `ticket.status` = 'resolved'

---

## Data Synchronization Points

| Trigger | Action | Result |
|---------|--------|--------|
| VOC submitted (new device) | Create device record | Device appears in inventory as `in_stock` |
| VOC submitted (repair) | Link & update device | Device status set to `in_repair` |
| VOC submitted (return) | Link & update device | Device status set to `in_repair` |
| VOC resolved (assignment) | Update device fields | Device status → `active`, assigned_to set |
| VOC resolved (return accepted) | Update device fields | Device status → `retired`, assigned_to cleared |

---

## Testing the Integration

### Test Case 1: New Device Request
1. Login to admin portal
2. Go to Ticket Queue
3. Create VOC: "Need new laptop"
   - Category: Hardware Request
   - Device Action: New Device
   - Model: "Dell XPS 15"
   - CPU: "Intel i9", RAM: 32GB, Storage: 1024GB
4. Verify:
   - Ticket created (REQ-2026-XXXX)
   - Device created (ITA-2026-XXXX) in Device Inventory
   - Device status: "in_stock"
5. Resolve ticket, assign to user
6. Verify:
   - Device status changed to "active"
   - Device assigned_to: selected user
   - History shows assignment action

### Test Case 2: Repair Request
1. Note a device serial: "SN-DL-XPS-0041"
2. Create VOC: "Laptop repair needed"
   - Category: Hardware Request
   - Device Action: Repair
   - Serial: "SN-DL-XPS-0041"
3. Verify:
   - Ticket created
   - Device linked to ticket
   - Device status changed from "active" → "in_repair"
4. Resolve ticket
5. Verify:
   - Device status returns to "active"
   - Ticket history shows repair completion

### Test Case 3: Device Return
1. Select an assigned device
2. Create VOC: "Return laptop"
   - Category: Hardware Request
   - Device Action: Return
   - Serial: "SN-DL-XPS-0041"
3. Verify:
   - Device status: "in_repair" (preparing for return)
4. Mark VOC as resolved
5. Verify:
   - Device status: "retired"
   - Device assigned_to: NULL (unassigned)
   - Available for new allocation

---

## Key Features

✅ **Automatic Device Creation** - New devices created when "new device" VOCs submitted
✅ **Device Linking** - Repair/return requests automatically linked to existing devices
✅ **Status Synchronization** - Device status reflects VOC lifecycle
✅ **Assignment Workflow** - Admins assign devices to users when resolving VOCs
✅ **Inventory Tracking** - All device movements logged and queryable
✅ **Specifications Stored** - Hardware specs (CPU, RAM, storage) captured with request
✅ **Serial Number Tracking** - Devices tracked by unique identifier
✅ **User Assignment** - Devices assigned to department and individual users
✅ **Status History** - All status changes logged with timestamp and actor
✅ **Workflow Integration** - Complete end-to-end VOC → Device → User assignment flow

---

## Implementation Details

### Modified Files

1. **backend/src/models/ticket.repo.ts**
   - Added deviceRepo import
   - Extended CreateTicketInput interface with device fields
   - Added device creation/linking logic in create() method

2. **backend/src/controllers/ticket.controller.ts**
   - Extended createTicketSchema with device fields
   - Updated create handler to pass device fields to ticketRepo

3. **backend/src/models/device.repo.ts**
   - Supports device creation with specifications
   - Implements device-to-ticket linking
   - Provides device lookup by serial number

4. **database/init/03_it_devices.sql**
   - Defines device tables with specifications columns
   - Creates ticket_device_links junction table
   - Seeds demo devices

---

## Future Enhancements

- [ ] Bulk device import via CSV with VOC linking
- [ ] Device lifecycle reports (new → active → retired)
- [ ] Automated warranty expiry notifications
- [ ] Device assignment approval workflows
- [ ] Asset depreciation tracking
- [ ] Equipment checkout/return system
- [ ] Department equipment budget tracking
- [ ] Integration with procurement system
