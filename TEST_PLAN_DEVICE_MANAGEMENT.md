# Device Management System - Comprehensive Test Plan

**Version:** 1.0  
**Date Created:** 2026-06-23  
**Project:** N-VOC System Service Portal  
**Checkpoint:** c7c12fd (Pre-Device-Management-System baseline)

---

## Overview

This test plan verifies the complete Device Management System implementation, including database schema, API endpoints, frontend forms, hardware request/return workflows, role-based access control, and rollback capability.

---

## 1. Database Test Scenarios

### 1.1 Device Table Structure
- [ ] `devices` table exists with correct columns
  - [ ] `id` (UUID primary key)
  - [ ] `serial_number` (VARCHAR, unique index)
  - [ ] `device_type` (ENUM: 'laptop', 'desktop', 'monitor', 'printer', 'other')
  - [ ] `brand` (VARCHAR)
  - [ ] `model` (VARCHAR)
  - [ ] `status` (ENUM: 'in_stock', 'active', 'retired', 'damaged')
  - [ ] `assigned_to` (UUID, foreign key to users table, nullable)
  - [ ] `purchase_date` (DATE)
  - [ ] `warranty_expiry` (DATE, nullable)
  - [ ] `origin_ticket_id` (UUID, foreign key to tickets table, nullable)
  - [ ] `created_at` (TIMESTAMP)
  - [ ] `updated_at` (TIMESTAMP)

### 1.2 Device Sequence Generation
- [ ] `device_sequence` table exists or equivalent (for transaction-safe ID generation)
- [ ] Sequence generates IDs in format: `ITA-YYYY-XXXX` (e.g., ITA-2026-0001)
- [ ] First device generated has ID: `ITA-2026-0001`
- [ ] Second device generated has ID: `ITA-2026-0002`
- [ ] Sequence increments sequentially without gaps
- [ ] Sequence is transaction-safe (concurrent inserts don't cause duplicates)

### 1.3 Demo Data Seeding
- [ ] Seed script creates exactly 5 demo devices
- [ ] Demo device 1: Brand=Dell, Model=XPS 13, Serial=SN-DL-XPS-0041, Status=in_stock
- [ ] Demo device 2: Brand=HP, Model=ProBook 450, Status=in_stock
- [ ] Demo device 3: Brand=Lenovo, Model=ThinkPad E15, Status=active
- [ ] Demo device 4: Brand=Apple, Model=MacBook Pro, Status=in_stock
- [ ] Demo device 5: Brand=Dell, Model=Monitor U2723DE, Status=in_stock

### 1.4 Device-Ticket Relationship
- [ ] Seed creates link between ticket#4 and device#1 (via `origin_ticket_id`)
- [ ] Ticket#4 references device#1 as origin
- [ ] Device#1 has `origin_ticket_id` pointing to ticket#4
- [ ] Referential integrity enforced: cannot delete ticket#4 while device#1 references it

### 1.5 Indexes and Constraints
- [ ] Unique index on `serial_number` column
- [ ] Index on `status` column for filtering
- [ ] Index on `assigned_to` column for user device queries
- [ ] Index on `origin_ticket_id` for ticket-device correlation
- [ ] NOT NULL constraints on required fields

---

## 2. Backend API Test Scenarios

### 2.1 GET /api/devices - List Devices
- [ ] Returns HTTP 200 with paginated device list
- [ ] Response includes pagination metadata (page, limit, total, hasMore)
- [ ] Default page size is 10 devices
- [ ] Supports `?page=2` query parameter
- [ ] Supports `?limit=20` query parameter
- [ ] Returns all device fields (id, serial_number, device_type, brand, model, status, assigned_to, etc.)
- [ ] Includes user info for `assigned_to` field (username, email) via join
- [ ] Devices ordered by `created_at DESC` (newest first)
- [ ] Empty result returns `[]` with total=0

### 2.2 GET /api/devices/search - Search by Serial
- [ ] GET /api/devices/search?serial=SN-DL-XPS-0041 returns matching device
- [ ] Returns HTTP 200 with device object (not array)
- [ ] Serial number search is case-insensitive
- [ ] Partial serial search works (e.g., ?serial=DL-XPS returns SN-DL-XPS-0041)
- [ ] Non-existent serial returns HTTP 404
- [ ] Search returns all device fields including assignment info

### 2.3 GET /api/devices/:id - Get Single Device
- [ ] Returns HTTP 200 with device details
- [ ] Includes linked user info (assigned_to)
- [ ] Includes origin ticket reference
- [ ] Non-existent ID returns HTTP 404
- [ ] Invalid UUID format returns HTTP 400

### 2.4 POST /api/devices - Create Device
- [ ] Returns HTTP 201 with created device object
- [ ] Requires authentication (JWT token)
- [ ] Requires `it_support` role (tested in role-based access section)
- [ ] Auto-generates device ID in format ITA-YYYY-XXXX
- [ ] Request body fields:
  - [ ] `serial_number` (required, must be unique)
  - [ ] `device_type` (required, validates against ENUM)
  - [ ] `brand` (required)
  - [ ] `model` (required)
  - [ ] `purchase_date` (optional)
  - [ ] `warranty_expiry` (optional)
- [ ] Auto-sets `status='in_stock'` if not provided
- [ ] Returns error if `serial_number` already exists (HTTP 409)
- [ ] Returns error if required fields missing (HTTP 400)
- [ ] Returns error if invalid `device_type` (HTTP 400)
- [ ] Sets `created_at` and `updated_at` to current timestamp
- [ ] Sets `assigned_to=NULL` and `origin_ticket_id=NULL` on creation

### 2.5 PUT /api/devices/:id - Update Device
- [ ] Returns HTTP 200 with updated device
- [ ] Requires authentication
- [ ] Requires `it_support` role
- [ ] Can update: serial_number, device_type, brand, model, status, purchase_date, warranty_expiry
- [ ] Cannot update: id, created_at, origin_ticket_id (server-managed)
- [ ] Can update: assigned_to (for assignment operations)
- [ ] Validates new serial_number uniqueness (except for same device)
- [ ] Validates device_type against ENUM
- [ ] Updates `updated_at` timestamp
- [ ] Non-existent ID returns HTTP 404
- [ ] Returns error on duplicate serial_number (HTTP 409)

### 2.6 PATCH /api/devices/:id/assign - Assign to User
- [ ] Returns HTTP 200 with updated device
- [ ] Requires authentication
- [ ] Requires `it_support` role
- [ ] Request body: `{ assigned_to: "user-uuid" }`
- [ ] Sets `status='active'` when assigning
- [ ] Updates `assigned_to` field
- [ ] Updates `updated_at` timestamp
- [ ] Invalid user UUID returns HTTP 400
- [ ] Non-existent device ID returns HTTP 404

### 2.7 PATCH /api/devices/:id/return - Return Device
- [ ] Returns HTTP 200 with updated device
- [ ] Requires authentication
- [ ] Requires `admin` role
- [ ] Sets `status='retired'`
- [ ] Sets `assigned_to=NULL`
- [ ] Updates `updated_at` timestamp
- [ ] Non-existent device ID returns HTTP 404

### 2.8 DELETE /api/devices/:id - Delete Device
- [ ] Returns HTTP 204 (No Content) on success
- [ ] Requires authentication
- [ ] Requires `admin` role (tested in role-based access section)
- [ ] Device no longer retrievable after deletion
- [ ] Non-existent ID returns HTTP 404
- [ ] Cannot delete device with active assignments (returns HTTP 409 or performs cascade)

---

## 3. Frontend Form Test Scenarios

### 3.1 DeviceManagement Page
- [ ] Page loads at `/dashboard/device-management` (or configured route)
- [ ] Page displays list of devices in table format
- [ ] Table columns: ID, Serial Number, Device Type, Brand, Model, Status, Assigned To, Actions
- [ ] Page is accessible only to authenticated users
- [ ] Page redirects to login if not authenticated
- [ ] Loading state displays spinner/skeleton while fetching devices
- [ ] Error state displays error message if fetch fails
- [ ] Empty state displays "No devices" message when list is empty
- [ ] Pagination controls visible for >10 devices

### 3.2 Device List Display
- [ ] Displays all 5 demo devices in table
- [ ] Serial numbers displayed correctly (e.g., SN-DL-XPS-0041)
- [ ] Device types displayed (laptop, desktop, monitor, etc.)
- [ ] Status color-coded: in_stock=green, active=blue, retired=gray, damaged=red
- [ ] Assigned user name displays if device is assigned
- [ ] "Unassigned" label displays if assigned_to=NULL
- [ ] Click on device row opens detail view or edit modal

### 3.3 Add Device Modal
- [ ] "Add Device" button visible on page
- [ ] Clicking button opens modal with form
- [ ] Modal title: "Add New Device"
- [ ] Modal has Cancel and Save buttons
- [ ] Clicking Cancel closes modal without saving
- [ ] Form fields present:
  - [ ] Serial Number (text input, required)
  - [ ] Device Type (dropdown, required)
  - [ ] Brand (text input, required)
  - [ ] Model (text input, required)
  - [ ] Purchase Date (date picker, optional)
  - [ ] Warranty Expiry (date picker, optional)
- [ ] Form validates before submit
- [ ] Error message for duplicate serial number
- [ ] Error message for missing required fields
- [ ] Success notification displays after creation
- [ ] Modal closes after successful creation
- [ ] New device appears in list after creation
- [ ] API call uses POST /api/devices

### 3.4 Edit Device Modal
- [ ] Click "Edit" action on device row opens edit modal
- [ ] Modal title: "Edit Device"
- [ ] Form fields pre-filled with current device data
- [ ] Serial Number field pre-filled with SN-DL-XPS-0041 for device#1
- [ ] Device Type dropdown pre-selected
- [ ] Brand field pre-filled
- [ ] Model field pre-filled
- [ ] Purchase Date pre-filled if exists
- [ ] Warranty Expiry pre-filled if exists
- [ ] Status field displays but may be read-only or dropdown
- [ ] Can edit and save changes
- [ ] Success notification displays after update
- [ ] Modal closes after successful save
- [ ] Device list refreshes with updated data
- [ ] API call uses PUT /api/devices/:id

### 3.5 Delete Device Action
- [ ] Click "Delete" action on device row shows confirmation
- [ ] Confirmation dialog: "Delete device SN-XXXX? This action cannot be undone."
- [ ] Clicking "Cancel" closes dialog
- [ ] Clicking "Confirm" sends DELETE request
- [ ] API call uses DELETE /api/devices/:id
- [ ] Device removed from list after deletion
- [ ] Success notification displays
- [ ] Deleted device no longer retrievable via API

### 3.6 Import CSV Modal
- [ ] "Import CSV" button visible on page
- [ ] Clicking button opens import modal
- [ ] Modal allows file selection (drag-drop or file picker)
- [ ] CSV template downloadable from modal
- [ ] CSV columns: serial_number, device_type, brand, model, purchase_date (optional), warranty_expiry (optional)
- [ ] Validates CSV format before upload
- [ ] Shows preview of devices to import
- [ ] Shows count: "Importing X devices"
- [ ] Cancel button closes modal
- [ ] Import button sends batch create request
- [ ] Success message shows "Imported X devices"
- [ ] Handles partial failures gracefully with row-level errors
- [ ] Modal closes after import
- [ ] New devices appear in list

---

## 4. Hardware Request Workflow Test Scenarios

### 4.1 Submit "New Laptop" Request
- [ ] User submits ticket with category="Hardware Request" and type="New Laptop"
- [ ] Request form captured in ticket description or custom fields
- [ ] Ticket created with status='open'
- [ ] Ticket#4 (or next available) created successfully

### 4.2 Device Creation from Request
- [ ] Device created automatically or via admin action
- [ ] Device receives auto-generated ID (e.g., ITA-2026-0003)
- [ ] Device.device_type set to 'laptop'
- [ ] Device.status set to 'in_stock'
- [ ] Device.origin_ticket_id set to ticket ID
- [ ] Device.assigned_to is NULL initially
- [ ] Serial number assigned (either from import or generated as SN-DL-XPS-00XX)

### 4.3 Admin Resolves Ticket - Assignment Modal Appears
- [ ] Admin views ticket details
- [ ] System detects origin_ticket_id has linked device
- [ ] DeviceAssignmentModal appears automatically or via button
- [ ] Modal shows: "Assign Device SN-XXXX to User"
- [ ] Modal displays device details (serial, type, brand, model)
- [ ] User selection dropdown populated with active users
- [ ] Current user filters out or indicates "Self"

### 4.4 Admin Selects User for Assignment
- [ ] Admin selects target user from dropdown
- [ ] Clicking "Assign" sends request to assign device
- [ ] API call: PATCH /api/devices/:id/assign with { assigned_to: user-uuid }
- [ ] Device.status changes from 'in_stock' to 'active'
- [ ] Device.assigned_to updated with selected user UUID
- [ ] Notification sent to assigned user (email/in-app)

### 4.5 Ticket Marked Resolved
- [ ] Ticket status changed to 'resolved' after device assignment
- [ ] Ticket updated_at timestamp updated
- [ ] Resolution recorded in ticket history/comments
- [ ] Hardware request workflow marked complete

### 4.6 Full Workflow Verification
- [ ] Create ticket "New Dell XPS" → device created → assigned → ticket resolved
- [ ] Device visible in DeviceManagement with active status and assigned user
- [ ] User can see assigned device in their profile/dashboard
- [ ] All timestamps and references consistent

---

## 5. Device Return Workflow Test Scenarios

### 5.1 Submit "Return Device" Request
- [ ] User submits ticket with category="Hardware Request" and type="Return Device"
- [ ] Request includes serial number of device to return (SN-XXXX)
- [ ] Ticket created with status='open'

### 5.2 Link Device to Return Ticket
- [ ] System searches for device by serial number
- [ ] Device found: SN-DL-XPS-0041
- [ ] Device linked to return ticket (updates device or creates relationship)
- [ ] Device.origin_ticket_id updated or new return_ticket_id field used
- [ ] System shows linked device in ticket details

### 5.3 Admin Resolves Return Ticket - Checkout Modal Appears
- [ ] Admin views return ticket
- [ ] System detects linked device
- [ ] DeviceCheckoutModal appears showing device details
- [ ] Modal displays: "Confirm Return of Device SN-XXXX"
- [ ] Shows current assignment info (who has it, since when)
- [ ] Shows condition options (Good, Damaged, Missing Components) or notes field
- [ ] Modal has "Confirm Return" and "Cancel" buttons

### 5.4 Admin Confirms Return
- [ ] Admin clicks "Confirm Return"
- [ ] API call: PATCH /api/devices/:id/return with optional { condition: "good" }
- [ ] Device.status changes from 'active' to 'retired'
- [ ] Device.assigned_to set to NULL
- [ ] Device.updated_at timestamp updated

### 5.5 Ticket Marked Resolved
- [ ] Ticket status changed to 'resolved'
- [ ] Return recorded in ticket history
- [ ] Resolution notes captured (if provided)
- [ ] Notification sent to original requester

### 5.6 Full Return Workflow Verification
- [ ] Device starts as 'active' with assigned_to set
- [ ] Return request created with serial number
- [ ] Admin confirms return
- [ ] Device status becomes 'retired'
- [ ] Device no longer appears in "Active Devices" list
- [ ] Device appears in "Retired Devices" or archive view

---

## 6. Role-Based Access Control Test Scenarios

### 6.1 Requester Role - Create Device (403 Forbidden)
- [ ] User with role='requester' attempts POST /api/devices
- [ ] Request includes valid device data
- [ ] API returns HTTP 403 Forbidden
- [ ] Error message: "Insufficient permissions to create device"
- [ ] Device not created
- [ ] No device appears in list

### 6.2 IT Support Role - Create Device (201 Created)
- [ ] User with role='it_support' attempts POST /api/devices
- [ ] Request includes valid device data
- [ ] API returns HTTP 201 Created
- [ ] Device successfully created with auto-generated ID
- [ ] Device appears in list
- [ ] Device can be retrieved via GET /api/devices/:id

### 6.3 Requester Role - Update Device (403 Forbidden)
- [ ] User with role='requester' attempts PUT /api/devices/:id
- [ ] Request includes valid update data (e.g., serial number change)
- [ ] API returns HTTP 403 Forbidden
- [ ] Device not updated
- [ ] Original data unchanged

### 6.4 IT Support Role - Update Device (200 OK)
- [ ] User with role='it_support' attempts PUT /api/devices/:id
- [ ] Request includes valid update data
- [ ] API returns HTTP 200 OK
- [ ] Device successfully updated
- [ ] Updated data persists in database

### 6.5 Requester Role - Delete Device (403 Forbidden)
- [ ] User with role='requester' attempts DELETE /api/devices/:id
- [ ] API returns HTTP 403 Forbidden
- [ ] Error message: "Insufficient permissions to delete device"
- [ ] Device not deleted
- [ ] Device still retrievable via GET /api/devices/:id

### 6.6 Admin Role - Delete Device (204 No Content)
- [ ] User with role='admin' attempts DELETE /api/devices/:id
- [ ] API returns HTTP 204 No Content
- [ ] Device successfully deleted
- [ ] Device no longer retrievable (returns 404 on GET)
- [ ] Device removed from list

### 6.7 IT Support Role - Delete Device
- [ ] User with role='it_support' attempts DELETE /api/devices/:id
- [ ] Behavior: Check if it_support can delete (permission may be admin-only)
- [ ] Document actual behavior (should be 403 if admin-only)

### 6.8 Anonymous User - All Endpoints (401 Unauthorized)
- [ ] Unauthenticated user attempts GET /api/devices
- [ ] API returns HTTP 401 Unauthorized
- [ ] Unauthenticated user attempts POST /api/devices
- [ ] API returns HTTP 401 Unauthorized
- [ ] Unauthenticated user attempts DELETE /api/devices/:id
- [ ] API returns HTTP 401 Unauthorized

---

## 7. Rollback Capability Test Scenarios

### 7.1 Identify Checkpoint
- [ ] Git log shows commit c7c12fd with message "CHECKPOINT: Pre-Device-Management-System baseline"
- [ ] Checkpoint is tagged or clearly marked
- [ ] Checkpoint is reachable in git history

### 7.2 State Before Rollback
- [ ] git status shows current working tree state
- [ ] Verify any uncommitted changes (should be minimal)
- [ ] Current branch contains Device Management System implementation
- [ ] Database includes device-related changes from implementation

### 7.3 Perform Git Reset
- [ ] Execute: `git reset --hard c7c12fd`
- [ ] Command completes successfully
- [ ] No errors in output
- [ ] Command returns exit code 0

### 7.4 Verify Rollback Success
- [ ] Working tree matches checkpoint state
- [ ] `git log --oneline` shows c7c12fd as HEAD
- [ ] All Device Management System code reverted
- [ ] No files in uncommitted state
- [ ] `git status` shows "working tree clean"

### 7.5 Database State After Rollback
- [ ] `devices` table removed from database schema
- [ ] `device_sequence` table removed (if created)
- [ ] Device-related migrations removed or undone
- [ ] No demo device data present
- [ ] System returns to VOC-only state

### 7.6 No Orphaned Changes
- [ ] git diff shows no changes
- [ ] git status shows no untracked files (except .env, node_modules, etc.)
- [ ] No merge conflicts
- [ ] No stashed changes left behind

---

## 8. Data Integrity and Edge Cases

### 8.1 Concurrent Device Creation
- [ ] Multiple simultaneous POST /api/devices requests
- [ ] Sequence generates non-duplicating IDs
- [ ] All devices successfully created
- [ ] IDs sequential without gaps

### 8.2 Device with Special Characters in Serial
- [ ] Serial number contains: SN-DL-@#$%-XPS
- [ ] API accepts and stores correctly
- [ ] Search by serial works with special characters
- [ ] No SQL injection vulnerabilities

### 8.3 Device Assignment Chain
- [ ] Device assigned to User A
- [ ] Admin reassigns device to User B
- [ ] Device.assigned_to updated to User B
- [ ] Device still points to original origin_ticket_id

### 8.4 Soft Delete vs Hard Delete
- [ ] Clarify if DELETE is soft (mark archived) or hard (remove)
- [ ] If soft delete: archived devices not appear in default list
- [ ] If hard delete: device removed from database
- [ ] Document behavior for audit trail

### 8.5 Orphaned Device References
- [ ] If linked ticket is deleted, device behavior defined
- [ ] If linked user is deleted, device assigned_to handling
- [ ] Referential integrity constraints enforced

---

## 9. API Response Validation

### 9.1 POST /api/devices Response Structure
```json
{
  "id": "ITA-2026-0001",
  "serial_number": "SN-DL-XPS-0041",
  "device_type": "laptop",
  "brand": "Dell",
  "model": "XPS 13",
  "status": "in_stock",
  "assigned_to": null,
  "purchase_date": "2026-01-15",
  "warranty_expiry": "2028-01-15",
  "origin_ticket_id": null,
  "created_at": "2026-06-23T10:30:00Z",
  "updated_at": "2026-06-23T10:30:00Z"
}
```

### 9.2 GET /api/devices Response Structure
```json
{
  "data": [
    {
      "id": "ITA-2026-0001",
      "serial_number": "SN-DL-XPS-0041",
      ...
      "assigned_user": {
        "id": "user-uuid",
        "username": "john.doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "hasMore": false
  }
}
```

### 9.3 GET /api/devices/search Response Structure
```json
{
  "id": "ITA-2026-0001",
  "serial_number": "SN-DL-XPS-0041",
  ...
}
```

---

## 10. Performance and Load Testing

### 10.1 Response Time
- [ ] GET /api/devices with 1000 devices: <500ms
- [ ] GET /api/devices/search by serial: <100ms
- [ ] POST /api/devices: <200ms
- [ ] PUT /api/devices/:id: <200ms
- [ ] DELETE /api/devices/:id: <150ms

### 10.2 Pagination Performance
- [ ] Page 1 (limit 10): <100ms
- [ ] Page 100 (offset 990): <200ms (no N+1 queries)
- [ ] Limit 100 devices per page: <300ms

### 10.3 Search Performance
- [ ] Search by partial serial across 1000 devices: <150ms
- [ ] Case-insensitive search: no performance degradation

---

## Test Execution Summary

| Test Category | Total Tests | Pass | Fail | Blocked |
|---|---|---|---|---|
| Database Schema | 18 | - | - | - |
| API Endpoints | 45 | - | - | - |
| Frontend Forms | 40 | - | - | - |
| Hardware Request Workflow | 15 | - | - | - |
| Device Return Workflow | 12 | - | - | - |
| Role-Based Access | 16 | - | - | - |
| Rollback Capability | 18 | - | - | - |
| Data Integrity | 10 | - | - | - |
| **TOTAL** | **174** | - | - | - |

---

## Notes

- **Checkpoint Revert:** The system can be reverted to c7c12fd state by running `git reset --hard c7c12fd`, returning to the pre-Device-Management state.
- **Demo Devices:** Seed 5 devices with serial numbers starting with SN-DL-XPS-0041.
- **ID Format:** Device IDs follow ITA-YYYY-XXXX format (e.g., ITA-2026-0001).
- **Workflows:** Both hardware request and return workflows must be end-to-end testable with ticket integration.
- **Role Hierarchy:** admin > it_support > requester (for permission levels).

---

## Appendix: Test Environment Requirements

- **Database:** PostgreSQL with migration system
- **Backend:** Node.js/Express or equivalent REST framework
- **Frontend:** React with form validation and modal components
- **Authentication:** JWT-based with role claims
- **Testing Tools:** Postman/Thunder Client for API, Playwright/Cypress for UI
- **Git:** Access to historical commits for rollback testing

