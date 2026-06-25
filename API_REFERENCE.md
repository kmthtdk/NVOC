# N-VOC System API Reference

Base URL: `http://localhost:4000/api` (direct) or `http://localhost:3000/api` (via Nginx proxy)

All endpoints except `/health` require a valid JWT token in the `Authorization` header.

---

## Authentication

### Login

```
POST /api/auth/login
```

**Rate Limit:** 10 requests per 15 minutes per IP

**Request Body:**

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "department": "IT",
    "title": "System Administrator"
  }
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Invalid request body (missing email or password) |
| 401  | Invalid credentials |
| 429  | Rate limit exceeded |

---

### Validate Token

```
GET /api/auth/validate
```

**Auth:** Required (any role)

**Response (200):**

```json
{
  "user": {
    "id": "1",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "department": "IT",
    "title": "System Administrator"
  }
}
```

---

## Health

### Health Check

```
GET /health
```

**Auth:** None required

**Response (200):**

```json
{
  "status": "ok",
  "db": "up"
}
```

**Response (503):**

```json
{
  "status": "degraded",
  "db": "down"
}
```

---

## Categories

### List Categories

```
GET /api/categories
```

**Auth:** Required (any role)

**Response (200):**

```json
[
  {
    "id": "hardware_request",
    "name": "Hardware Request",
    "icon": "laptop",
    "description": "Request new hardware or report hardware issues",
    "subcategories": [
      {
        "id": "new_device",
        "name": "New Device",
        "description": "Request a new device",
        "types": [
          {
            "id": "laptop_standard",
            "name": "Standard Laptop",
            "period": "Non Apply"
          }
        ]
      }
    ]
  }
]
```

---

## Tickets

### List Tickets

```
GET /api/tickets
```

**Auth:** Required (any role)

**Query Parameters:**

| Parameter  | Type   | Default   | Description                                    |
|------------|--------|-----------|------------------------------------------------|
| `status`   | string | _(all)_   | Filter: `submitted`, `waiting`, `resolved`, `rejected` |
| `category` | string | _(all)_   | Filter by category ID                          |
| `priority` | string | _(all)_   | Filter: `low`, `medium`, `high`, `urgent`      |
| `assignedTo` | string | _(all)_ | Filter by assignee name                        |
| `q`        | string | _(none)_  | Full-text search (max 200 chars)               |
| `page`     | int    | `1`       | Page number                                    |
| `pageSize` | int    | `20`      | Items per page (max 100)                       |
| `sort`     | string | `newest`  | Sort order: `newest` or `oldest`               |

**Response (200):**

```json
{
  "data": [
    {
      "id": "1",
      "code": "VOC-2026-0001",
      "title": "Request new laptop",
      "requesterName": "Alice Tan",
      "requesterEmail": "alice@example.com",
      "requesterDept": "Finance",
      "category": "hardware_request",
      "subcategory": "new_device",
      "type": "laptop_standard",
      "priority": "medium",
      "description": "Need a replacement laptop",
      "status": "submitted",
      "createdAt": "2026-06-20T10:00:00.000Z",
      "updatedAt": "2026-06-20T10:00:00.000Z",
      "assignedTo": "Unassigned",
      "periodFrom": null,
      "periodTo": null,
      "comments": [],
      "history": [],
      "details": {}
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 5
}
```

---

### Get Ticket

```
GET /api/tickets/:id
```

**Auth:** Required (any role)

**Response (200):**

```json
{
  "ticket": {
    "id": "1",
    "code": "VOC-2026-0001",
    "title": "Request new laptop",
    "requesterName": "Alice Tan",
    "requesterEmail": "alice@example.com",
    "requesterDept": "Finance",
    "category": "hardware_request",
    "subcategory": "new_device",
    "type": "laptop_standard",
    "priority": "medium",
    "description": "Need a replacement laptop",
    "status": "submitted",
    "createdAt": "2026-06-20T10:00:00.000Z",
    "updatedAt": "2026-06-20T10:00:00.000Z",
    "assignedTo": "Unassigned",
    "periodFrom": null,
    "periodTo": null,
    "comments": [],
    "history": [],
    "attachments": [],
    "linkedDevices": [],
    "details": {}
  }
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Invalid ticket ID |
| 404  | Ticket not found |

---

### Create Ticket

```
POST /api/tickets
```

**Auth:** Required (any role)
**Rate Limit:** 30 requests per 15 minutes per IP

**Request Body:**

```json
{
  "title": "Request new laptop",
  "description": "Need a replacement for my current device",
  "requesterName": "Alice Tan",
  "requesterEmail": "alice@example.com",
  "requesterDept": "Finance",
  "category": "hardware_request",
  "subcategory": "new_device",
  "type": "laptop_standard",
  "priority": "medium",
  "assignedTo": "Unassigned",
  "periodFrom": null,
  "periodTo": null,
  "details": {},
  "deviceAction": "new",
  "deviceType": "laptop",
  "deviceModel": "Dell Latitude 7440",
  "specifications": {
    "cpu": "Intel i7",
    "ramGb": 16,
    "storageGb": 512
  }
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `title` | Yes | string | 3-255 chars |
| `description` | Yes | string | Min 1 char |
| `requesterName` | Yes | string | 1-150 chars |
| `requesterEmail` | Yes | string | Valid email |
| `requesterDept` | Yes | string | 1-150 chars |
| `category` | Yes | string | 1-50 chars |
| `subcategory` | Yes | string | 1-60 chars |
| `type` | No | string | Max 60 chars |
| `priority` | No | enum | `low`, `medium` (default), `high`, `urgent` |
| `assignedTo` | No | string | Max 150 chars, default `"Unassigned"` |
| `periodFrom` | No | string | `YYYY-MM-DD` format |
| `periodTo` | No | string | `YYYY-MM-DD` format |
| `details` | No | object | Arbitrary key-value pairs |
| `deviceAction` | No | enum | `new`, `repair`, `return`, `replace` |
| `deviceType` | No | string | Max 50 chars |
| `deviceSerialNumber` | No | string | Max 100 chars |
| `deviceModel` | No | string | Max 150 chars |
| `specifications` | No | object | CPU, RAM, storage, GPU, PSU |

**Response (201):**

```json
{
  "ticket": { "...full ticket object..." }
}
```

---

### Update Ticket

```
PUT /api/tickets/:id
```

**Auth:** Required, role `it_support` or `admin`

**Request Body (at least one field required):**

```json
{
  "status": "waiting",
  "priority": "high",
  "assignedTo": "IT Support Team",
  "notes": "Assigned to support team for processing"
}
```

**Status transition rules:**

| Current Status | Allowed Transitions |
|----------------|---------------------|
| `submitted`    | `waiting`, `rejected` |
| `waiting`      | `resolved`, `rejected` |
| `resolved`     | _(none -- terminal)_ |
| `rejected`     | _(none -- terminal)_ |

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Invalid status transition or missing required fields |
| 403  | Insufficient role (must be it_support or admin) |
| 404  | Ticket not found |

---

### Delete Ticket

```
DELETE /api/tickets/:id
```

**Auth:** Required, role `admin` only

**Response (204):** No content

**Errors:**

| Code | Meaning |
|------|---------|
| 403  | Insufficient role (must be admin) |
| 404  | Ticket not found |

---

### Add Comment

```
POST /api/tickets/:id/comments
```

**Auth:** Required (any role)
**Rate Limit:** 50 requests per 15 minutes per IP

**Request Body:**

```json
{
  "content": "We have approved your request and will begin processing."
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `content` | Yes | string | 1-5000 chars |

**Response (201):**

```json
{
  "comment": {
    "id": "10",
    "author": "IT Support",
    "role": "it_support",
    "content": "We have approved your request...",
    "createdAt": "2026-06-20T14:00:00.000Z"
  }
}
```

---

### Link Device to Ticket

```
POST /api/tickets/:id/link-device
```

**Auth:** Required, role `it_support` or `admin`

**Request Body:**

```json
{
  "deviceId": 5,
  "actionType": "new"
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `deviceId` | Yes | int | Positive integer |
| `actionType` | No | enum | `new`, `related` (default), `resolved`, `affected` |

**Response (201):**

```json
{
  "success": true,
  "ticketId": 1,
  "deviceId": 5
}
```

---

### Upload Attachments

```
POST /api/tickets/:id/attachments
```

**Auth:** Required (any role)
**Rate Limit:** 30 requests per 15 minutes per IP
**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `files` | File[] | Up to 10 files, max 10 MB each |

**Response (201):**

```json
{
  "attachments": [
    {
      "id": "1",
      "originalName": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 245000,
      "uploadedBy": "Alice Tan",
      "createdAt": "2026-06-20T14:00:00.000Z"
    }
  ]
}
```

---

### Download Attachment

```
GET /api/attachments/:id
```

**Auth:** Required (any role)

**Response:** File download with appropriate `Content-Type` and `Content-Disposition` headers

---

## Ticket Reports

All ticket report endpoints require authentication and role `it_support` or `admin`.

### Stats Summary

```
GET /api/tickets/stats/summary
```

**Auth:** Required (any role)

**Response (200):**

```json
{
  "period": "current_month",
  "summary": {
    "total": 25,
    "submitted": 5,
    "waiting": 8,
    "resolved": 10,
    "rejected": 2,
    "pending": 13,
    "resolutionRate": 40
  },
  "categories": {
    "hardware_request": 10,
    "software_request": 8,
    "network_issue": 7
  },
  "priorities": {
    "low": 5,
    "medium": 12,
    "high": 6,
    "urgent": 2
  },
  "lastUpdated": "2026-06-25T10:00:00.000Z"
}
```

---

### Recent Activity

```
GET /api/tickets/stats/recent
```

**Auth:** Required (any role)

**Response (200):**

```json
{
  "recent_submitted": [ "...up to 5 recent submitted tickets..." ],
  "recent_resolved": [ "...up to 5 recently resolved tickets..." ],
  "unassigned_pending": [ "...up to 5 unassigned submitted tickets..." ]
}
```

---

### Pending Hardware Requests

```
GET /api/tickets/reports/pending-hardware
```

**Auth:** Required, role `it_support` or `admin`

**Response (200):**

```json
{
  "pendingRequests": [
    {
      "id": 1,
      "code": "VOC-2026-0001",
      "title": "Request new laptop",
      "created_at": "2026-06-20T10:00:00.000Z",
      "priority": "medium",
      "requester_name": "Alice Tan",
      "assigned_to": "Unassigned",
      "status": "submitted",
      "category_id": "hardware_request",
      "subcategory_id": "new_device"
    }
  ]
}
```

---

### Fulfillment Time

```
GET /api/tickets/reports/fulfillment-time
```

**Auth:** Required, role `it_support` or `admin`

**Response (200):**

```json
{
  "fulfillmentStats": [
    {
      "category_id": "hardware_request",
      "total_resolved": 15,
      "avg_hours": 72,
      "min_hours": 2,
      "max_hours": 240
    }
  ]
}
```

---

### Age Buckets

```
GET /api/tickets/reports/age-buckets
```

**Auth:** Required, role `it_support` or `admin`

**Response (200):**

```json
{
  "ageBuckets": {
    "0-3 days": { "submitted": 3, "waiting": 1 },
    "4-7 days": { "submitted": 1, "waiting": 2 },
    "8-14 days": {},
    "15-30 days": { "waiting": 1 },
    "30+ days": {}
  }
}
```

---

### Category Trend

```
GET /api/tickets/reports/category-trend
```

**Auth:** Required, role `it_support` or `admin`

**Response (200):**

```json
{
  "categoryTrend": [
    { "month": "2026-06", "category_id": "hardware_request", "count": 10 },
    { "month": "2026-06", "category_id": "software_request", "count": 8 },
    { "month": "2026-05", "category_id": "hardware_request", "count": 12 }
  ]
}
```

---

## Devices

### List Devices

```
GET /api/devices
```

**Auth:** Required (any role)

**Query Parameters:**

| Parameter    | Type   | Default   | Description                                         |
|--------------|--------|-----------|-----------------------------------------------------|
| `deviceType` | string | _(all)_   | Filter by device type                               |
| `status`     | string | _(all)_   | Filter: `Active`, `In Stock`, `In Repair`, `Retired`, `Lost` |
| `assignedTo` | string | _(all)_   | Filter by assigned user                             |
| `department` | string | _(all)_   | Filter by department                                |
| `q`          | string | _(none)_  | Full-text search on code, model, serial number      |
| `page`       | int    | `1`       | Page number                                         |
| `pageSize`   | int    | `20`      | Items per page (max 100)                            |
| `sort`       | string | `newest`  | Sort order: `newest` or `oldest`                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": 1,
      "code": "ITA-2026-0001",
      "deviceType": "laptop",
      "model": "Dell Latitude 7440",
      "serialNumber": "SN-DL7440-0001",
      "status": "Active",
      "assignedTo": "Alice Tan",
      "department": "Finance",
      "purchaseDate": "2026-01-15",
      "warrantyExpiry": "2029-01-15",
      "notes": "Primary work laptop",
      "createdAt": "2026-06-20T10:00:00.000Z",
      "updatedAt": "2026-06-20T10:00:00.000Z",
      "linkedTickets": [],
      "macAddresses": [],
      "specifications": {
        "cpu": "Intel i7-10700K, 8 cores, 3.8 GHz",
        "ramGb": 16,
        "storageGb": 512,
        "gpu": "Integrated Intel UHD Graphics",
        "psuWatts": 130,
        "additionalSpecs": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 10,
    "totalPages": 1
  }
}
```

---

### Search Device by Serial

```
GET /api/devices/search?serial=SN-DL7440-0001
```

**Auth:** Required (any role)

**Query Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `serial`  | string | Yes      | Serial number to look up |

**Response (200):**

```json
{
  "data": { "...full device object..." }
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Missing `serial` query parameter |
| 404  | No device with that serial number |

---

### Get Device

```
GET /api/devices/:id
```

**Auth:** Required (any role)

**Response (200):**

```json
{
  "data": { "...full device object with linkedTickets, macAddresses, specifications..." }
}
```

---

### Create Device

```
POST /api/devices
```

**Auth:** Required, role `it_support` or `admin`

**Request Body:**

```json
{
  "deviceType": "laptop",
  "model": "Dell Latitude 7440",
  "serialNumber": "SN-NEW-001",
  "status": "In Stock",
  "assignedTo": null,
  "department": null,
  "purchaseDate": "2026-06-20",
  "warrantyExpiry": "2029-06-20",
  "notes": "New procurement",
  "macAddresses": [
    { "macType": "WiFi", "macAddress": "AA:BB:CC:DD:EE:FF" }
  ],
  "specifications": {
    "cpu": "Intel i7-13700",
    "ramGb": 32,
    "storageGb": 1024,
    "gpu": "NVIDIA RTX 4060",
    "psuWatts": 100,
    "additionalSpecs": { "display_size": "14 inch" }
  }
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `deviceType` | Yes | string | 1-50 chars |
| `model` | Yes | string | 1-150 chars |
| `serialNumber` | Yes | string | 1-100 chars, must be unique |
| `status` | No | enum | `In Stock` (default), `Active`, `In Repair`, `Retired`, `Lost` |
| `assignedTo` | No | string | Max 150 chars |
| `department` | No | string | Max 100 chars |
| `purchaseDate` | No | string | `YYYY-MM-DD` format |
| `warrantyExpiry` | No | string | `YYYY-MM-DD` format |
| `notes` | No | string | Max 2000 chars |
| `macAddresses` | No | array | Array of `{macType, macAddress}` |
| `specifications` | No | object | `{cpu, ramGb, storageGb, gpu, psuWatts, additionalSpecs}` |

**MAC Address Types:** `Ethernet`, `WiFi`, `Bluetooth`, `Other`
**MAC Address Format:** `XX:XX:XX:XX:XX:XX` (colon-separated hex pairs)

**Response (201):**

```json
{
  "data": { "...full device object..." }
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Validation error (missing required fields, invalid format) |
| 403  | Insufficient role |
| 409  | Duplicate serial number |

---

### Update Device

```
PUT /api/devices/:id
```

**Auth:** Required, role `it_support` or `admin`

**Request Body (all fields optional):**

```json
{
  "status": "Active",
  "assignedTo": "Bob Lee",
  "department": "Engineering"
}
```

**Response (200):**

```json
{
  "data": { "...updated device object..." }
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| 400  | Validation error |
| 403  | Insufficient role |
| 404  | Device not found |
| 409  | Duplicate serial number (if changing serial) |

---

### Delete Device

```
DELETE /api/devices/:id
```

**Auth:** Required, role `admin` only

**Response (204):** No content

**Errors:**

| Code | Meaning |
|------|---------|
| 403  | Insufficient role (must be admin) |
| 404  | Device not found |

---

### Assign Device to User

```
POST /api/devices/:id/assign
```

**Auth:** Required, role `it_support` or `admin`
**Rate Limit:** 30 requests per 15 minutes per IP

**Request Body:**

```json
{
  "userName": "Alice Tan",
  "userEmail": "alice@example.com",
  "userDept": "Finance",
  "userId": 1,
  "ticketId": "VOC-2026-0001",
  "reason": "New hire equipment"
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `userName` | Yes | string | 1-150 chars |
| `userEmail` | Yes | string | Valid email |
| `userDept` | No | string | Max 100 chars |
| `userId` | No | int | Positive integer |
| `ticketId` | No | string | Max 50 chars |
| `reason` | No | string | Max 500 chars |

**Response (200):**

```json
{
  "device": { "...updated device with new assignment..." }
}
```

---

### Checkout / Return Device

```
POST /api/devices/:id/checkout
```

**Auth:** Required, role `it_support` or `admin`
**Rate Limit:** 30 requests per 15 minutes per IP

**Request Body:**

```json
{
  "condition": "good",
  "notes": "Returned in good condition",
  "actionType": "return"
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `condition` | No | enum | `good` (default), `damaged`, `unknown` |
| `notes` | No | string | Max 500 chars |
| `actionType` | No | enum | `return` (default, sets status to `In Stock`), `replace` (sets status to `In Repair`) |

**Precondition:** Device must have status `Active`. Returns 400 otherwise.

**Response (200):**

```json
{
  "device": { "...updated device..." }
}
```

---

## MAC Address Management

### Add MAC Address

```
POST /api/devices/:id/mac
```

**Auth:** Required, role `it_support` or `admin`

**Request Body:**

```json
{
  "macType": "WiFi",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `macType` | Yes | enum | `Ethernet`, `WiFi`, `Bluetooth`, `Other` |
| `macAddress` | Yes | string | Format `XX:XX:XX:XX:XX:XX` |

**Response (201):**

```json
{
  "data": {
    "id": 6,
    "deviceId": 1,
    "macType": "WiFi",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "createdAt": "2026-06-25T10:00:00.000Z",
    "updatedAt": "2026-06-25T10:00:00.000Z"
  }
}
```

---

### Update MAC Address

```
PUT /api/devices/:id/mac/:macId
```

**Auth:** Required, role `it_support` or `admin`

**Request Body (all fields optional):**

```json
{
  "macType": "Ethernet",
  "macAddress": "11:22:33:44:55:66"
}
```

**Response (200):**

```json
{
  "data": { "...updated MAC address object..." }
}
```

---

### Delete MAC Address

```
DELETE /api/devices/:id/mac/:macId
```

**Auth:** Required, role `it_support` or `admin`

**Response (204):** No content

**Errors:**

| Code | Meaning |
|------|---------|
| 403  | Insufficient role |
| 404  | Device not found or MAC address not found on this device |

---

## Device Reports

All device report endpoints require authentication and role `it_support` or `admin`.

### Summary Report

```
GET /api/devices/reports/summary
```

**Response (200):**

```json
{
  "summary": {
    "total": 10,
    "byStatus": { "Active": 3, "In Stock": 5, "In Repair": 1, "Retired": 1 },
    "byType": { "laptop": 4, "desktop": 2, "monitor": 2, "phone": 2 }
  }
}
```

---

### Assignment History Report

```
GET /api/devices/reports/history
```

**Response (200):**

```json
{
  "history": [
    {
      "id": 1,
      "deviceId": 1,
      "deviceCode": "ITA-2026-0001",
      "actionType": "assigned",
      "assignedTo": "Alice Tan",
      "department": "Finance",
      "reason": "Initial assignment",
      "createdBy": "System",
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  ]
}
```

---

### Current Assignments Report

```
GET /api/devices/reports/assignments
```

**Response (200):**

```json
{
  "assignments": [
    {
      "id": 1,
      "code": "ITA-2026-0001",
      "deviceType": "laptop",
      "model": "Dell Latitude 7440",
      "assignedTo": "Alice Tan",
      "department": "Finance"
    }
  ]
}
```

---

### Aging Report (Warranty Expiry)

```
GET /api/devices/reports/aging
```

**Response (200):**

```json
{
  "aging": [
    {
      "id": 4,
      "code": "ITA-2026-0004",
      "model": "iPhone 15",
      "warrantyExpiry": "2027-03-10",
      "daysUntilExpiry": 258
    }
  ]
}
```

---

### Department Report

```
GET /api/devices/reports/department
```

**Response (200):**

```json
{
  "departments": [
    {
      "department": "Finance",
      "deviceCount": 1,
      "devices": [{ "id": 1, "code": "ITA-2026-0001", "model": "Dell Latitude 7440" }]
    }
  ]
}
```

---

### Availability Report

```
GET /api/devices/reports/availability
```

**Response (200):**

```json
{
  "availability": {
    "available": 6,
    "assigned": 3,
    "inRepair": 1,
    "retired": 0,
    "lost": 0
  }
}
```

---

### Stock Movement Report

```
GET /api/devices/reports/stock-movement
```

**Response (200):**

```json
{
  "movement": [
    {
      "date": "2026-06-20",
      "assigned": 2,
      "returned": 0,
      "created": 3
    }
  ]
}
```

---

### Stock by Type Report

```
GET /api/devices/reports/stock-by-type
```

**Response (200):**

```json
{
  "stockByType": [
    {
      "deviceType": "laptop",
      "total": 4,
      "inStock": 2,
      "active": 1,
      "inRepair": 0,
      "retired": 0,
      "lost": 0
    }
  ]
}
```

---

### Unassigned Devices Report

```
GET /api/devices/reports/unassigned
```

**Response (200):**

```json
{
  "unassigned": [
    {
      "id": 5,
      "code": "ITA-2026-0005",
      "deviceType": "laptop",
      "model": "Lenovo ThinkPad X1",
      "status": "In Stock",
      "purchaseDate": "2026-04-05"
    }
  ]
}
```

---

### Devices by User Report

```
GET /api/devices/reports/by-user
```

**Response (200):**

```json
{
  "byUser": [
    {
      "userName": "Alice Tan",
      "department": "Finance",
      "deviceCount": 1,
      "devices": [{ "id": 1, "code": "ITA-2026-0001", "model": "Dell Latitude 7440" }]
    }
  ]
}
```

---

## AI Triage

### Triage Ticket

```
POST /api/ai/triage
```

**Auth:** Required (any role)
**Rate Limit:** 10 requests per 15 minutes per IP
**Requires:** `GEMINI_API_KEY` configured in environment

**Request Body:** (Zod-validated, schema defined in `ai.controller.ts`)

**Response (200):** AI-generated triage suggestions

**Note:** This endpoint calls the external Gemini API. If `GEMINI_API_KEY` is not configured, the endpoint will return an error.

---

## Common Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| 400  | Bad Request -- invalid input, validation failure, or invalid state transition |
| 401  | Unauthorized -- missing or invalid JWT token |
| 403  | Forbidden -- valid token but insufficient role for this endpoint |
| 404  | Not Found -- resource does not exist |
| 409  | Conflict -- duplicate unique constraint (e.g., serial number) |
| 429  | Too Many Requests -- rate limit exceeded |
| 500  | Internal Server Error -- unexpected server error |
| 503  | Service Unavailable -- database connection lost (health endpoint) |

---

## Rate Limit Headers

Rate-limited endpoints return these standard headers:

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Maximum requests allowed in the window |
| `RateLimit-Remaining` | Requests remaining in the current window |
| `RateLimit-Reset` | Seconds until the window resets |

When the limit is exceeded, the response is:

```
HTTP/1.1 429 Too Many Requests
Content-Type: text/html

Too many requests. Please try again later.
```

---

## Authorization Matrix

| Endpoint | requester | it_support | admin |
|----------|-----------|------------|-------|
| `GET /api/categories` | Yes | Yes | Yes |
| `GET /api/tickets` | Yes | Yes | Yes |
| `GET /api/tickets/:id` | Yes | Yes | Yes |
| `POST /api/tickets` | Yes | Yes | Yes |
| `PUT /api/tickets/:id` | No | Yes | Yes |
| `DELETE /api/tickets/:id` | No | No | Yes |
| `POST /api/tickets/:id/comments` | Yes | Yes | Yes |
| `POST /api/tickets/:id/link-device` | No | Yes | Yes |
| `POST /api/tickets/:id/attachments` | Yes | Yes | Yes |
| `GET /api/tickets/stats/summary` | Yes | Yes | Yes |
| `GET /api/tickets/stats/recent` | Yes | Yes | Yes |
| `GET /api/tickets/reports/*` | No | Yes | Yes |
| `GET /api/devices` | Yes | Yes | Yes |
| `GET /api/devices/:id` | Yes | Yes | Yes |
| `GET /api/devices/search` | Yes | Yes | Yes |
| `POST /api/devices` | No | Yes | Yes |
| `PUT /api/devices/:id` | No | Yes | Yes |
| `DELETE /api/devices/:id` | No | No | Yes |
| `POST /api/devices/:id/assign` | No | Yes | Yes |
| `POST /api/devices/:id/checkout` | No | Yes | Yes |
| `GET /api/devices/reports/*` | No | Yes | Yes |
| `POST/PUT/DELETE /api/devices/:id/mac/*` | No | Yes | Yes |
| `POST /api/ai/triage` | Yes | Yes | Yes |
| `GET /api/attachments/:id` | Yes | Yes | Yes |
