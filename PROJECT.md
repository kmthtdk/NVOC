# N-VOC Request System & IT Device Management Portal

## 📋 Project Overview

A comprehensive **Service Request Management System** with integrated **IT Device Inventory Management**. Enables organizations to:
- Submit and manage VOC (Voice of Customer) requests across multiple categories
- Assign IT support staff to requests
- Track device inventory with lifecycle management
- Link devices to service requests with automated workflows
- Generate inventory reports with multiple views

**Live URL:** http://localhost:3001

---

## 🏗️ Architecture

### Microservices Stack
```
├── Frontend (React/Vite/Tailwind)
│   └── Port: 3001 (Nginx reverse proxy)
│
├── Backend (Node.js/Express/TypeScript)
│   └── Port: 4000 (API server)
│
└── Database (MySQL 8.4)
    └── Port: 3306 (persisted volume)
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js 20, Express, TypeScript |
| Database | MySQL 8.4 |
| Authentication | JWT (Bearer tokens) |
| Containerization | Docker Compose |
| Package Manager | npm |

---

## 🎯 Key Features

### 1. VOC Request Management
- **Multiple Categories:**
  - General Request
  - Network Request / Security
  - Server Request
  - Hardware Request
  - Security Request
  
- **Workflow States:** Submitted → Processing → Awaiting Info → Resolved/Rejected
- **Request Tracking:** Comments, attachments, status history
- **Role-Based Access:** Admin, IT Support, Requester roles
- **AI Triage:** Gemini-powered smart categorization

### 2. Hardware Request + Device Assignment
- **Automatic Device Creation:** When hardware request submitted with "New Device"
- **Device Assignment Modal:** Appears when resolving "New Device" requests
- **Device Types:** Desktop, Laptop, Monitor, Phone, Tablet, Desk Phone, Removable Disk, Accessories
- **Device Lifecycle:** In Stock → Active → In Repair/Retired/Lost

### 3. IT Device Inventory
- **Device Tracking:** Asset code (ITA-YYYY-NNNN), serial number, specs
- **Hardware Specs:** CPU, RAM, Storage, GPU, PSU, custom specs
- **MAC Address Management:** Multi-MAC per device (Ethernet, WiFi, Bluetooth, Other)
- **Assignment Tracking:** Who has device, department, dates
- **Audit Trail:** Full history of device state changes

### 4. Reports & Analytics
- **Inventory Reports:**
  - Summary (total devices, status breakdown)
  - By Assignment (device → user mapping)
  - By Department (devices per department)
  - Warranty Aging (devices near expiry)
  - Availability Status

- **Device History Report:** Complete audit log of device actions
- **Ticket Analytics:** VOC submission trends, resolution rates

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20 (for local development)
- npm or yarn

### Installation

```bash
# Clone repository
cd n-voc-system-service-portal

# Start all services (auto-builds frontend/backend)
docker compose up -d

# Verify services are healthy
docker ps

# Access application
# Frontend: http://localhost:3001
# Backend API: http://localhost:4000
# Database: localhost:3306
```

### First-Time Setup

**Database initializes automatically** with:
- Schema (tickets, devices, MAC addresses, device history)
- Sample data (10 devices, 14 sample VOCs)
- Demo users for testing

---

## 👤 Demo User Accounts

| Role | Email | Password | Usage |
|------|-------|----------|-------|
| **Admin** | admin@company.com | Passw0rd! | Full system access, manage all requests/devices |
| **IT Support** | itsupport@company.com | Passw0rd! | Resolve requests, assign devices |
| **Requester** | alex@company.com | Passw0rd! | Submit VOC requests |

---

## 📊 Database Schema

### Core Tables

**`tickets`** - VOC request records
- Code (REQ-YYYY-NNNN format)
- Category, subcategory, type
- Status, priority, assignee
- Requester info (name, email, department)
- Description, details (JSON for category-specific data)
- Created/updated timestamps

**`devices`** - IT inventory
- Code (ITA-YYYY-NNNN format)
- Type (enum), model, serial number
- Status (In Stock/Active/In Repair/Retired/Lost)
- Assigned to user/department
- Purchase date, warranty expiry
- Hardware specs (CPU, RAM, storage, GPU, PSU)

**`device_history`** - Audit trail
- Device ID, ticket ID
- Action type (assigned, returned, retired, lost, repaired, created)
- Assigned to, department, reason
- Created by, timestamp

**`mac_addresses`** - Device network interfaces
- Device ID
- MAC type (Ethernet/WiFi/Bluetooth/Other)
- Address (AA:BB:CC:DD:EE:FF format)

**`ticket_comments`** - Discussion threads
- Ticket ID
- Author (name, role)
- Content, timestamp

**`attachments`** - File storage
- Ticket ID
- Original filename, file size
- Storage reference

**`ticket_history`** - Status change log
- Ticket ID
- Old/new status
- Changed by, notes, timestamp

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/login              - User login, returns JWT token
GET    /api/auth/validate           - Validate current token
```

### Tickets
```
GET    /api/tickets                 - List tickets (paginated, filtered)
GET    /api/tickets/:id             - Get ticket details
POST   /api/tickets                 - Create new VOC request
PUT    /api/tickets/:id             - Update ticket status/assignment
DELETE /api/tickets/:id             - Delete ticket (admin only)
POST   /api/tickets/:id/comments    - Add comment to ticket
GET    /api/tickets/:id/attachments - List attachments
POST   /api/tickets/:id/attachments - Upload attachments
```

### Devices
```
GET    /api/devices                 - List devices (paginated)
GET    /api/devices/:id             - Get device details
POST   /api/devices                 - Create new device
PUT    /api/devices/:id             - Update device info
DELETE /api/devices/:id             - Delete device (admin only)
POST   /api/devices/:id/assign      - Assign device to user
POST   /api/devices/:id/mac         - Add MAC address
PUT    /api/devices/:id/mac/:macId  - Edit MAC address
DELETE /api/devices/:id/mac/:macId  - Delete MAC address
```

### Reports
```
GET    /api/devices/reports/history - Device history audit log
GET    /api/tickets/analytics       - Ticket trends & metrics
```

---

## 🎨 Frontend Components

### Main Pages
- **Admin Dashboard** - VOC metrics, quick actions
- **Ticket Queue** - List and manage open requests
- **Device Inventory** - Device list, search, filter, add new
- **Reports & Analytics** - Multiple report tabs

### Key Modals
- **TicketDetailModal** - Full ticket view, status management, comments
- **DeviceAssignmentModal** - Assign device to user when resolving requests
- **DeviceFormModal** - Add/edit device with specs and MAC addresses
- **DeviceCheckoutModal** - Handle device return/repair workflows

### Reusable Components
- Status badges (color-coded by state)
- Priority indicators
- Search & filter panels
- Data tables with sorting
- Form validation

---

## 🔧 Backend Controllers & Models

### Device Management
**`device.controller.ts`**
- List devices with pagination/filtering
- Create, update, delete devices
- Assign device to user
- Manage MAC addresses

**`device.repo.ts`**
- Database operations for devices
- Asset code generation (ITA-YYYY-NNNN)
- Device history logging
- MAC address queries

### Ticket Management
**`ticket.controller.ts`**
- VOC CRUD operations
- Status transitions
- Comment management
- File attachments
- Hardware device linking

**`ticket.repo.ts`**
- Atomic transactions for request creation
- Auto-create devices for "new hardware" requests
- History/audit trail logging

---

## 🐛 Recent Fixes & Improvements

### Fixed Issues
1. ✅ **Device Assignment Modal Not Appearing**
   - Fixed: Changed `ticket.categoryId` to `ticket.category` in condition check
   - Root cause: API returns `category` field, not `categoryId`

2. ✅ **Internal Server Error on Device Assignment**
   - Fixed: Recreated database volume to include `device_history` table
   - Root cause: Missing table from initialization

3. ✅ **Add Device Button Missing**
   - Fixed: Added "Add Device" button with modal integration
   - Added device form with full validation

4. ✅ **Add MAC Address Non-Functional**
   - Fixed: Added `showNewMacForm` state toggle
   - Root cause: Form was hidden by default, no way to show it

5. ✅ **Modal Auto-Closing & Focus Jumping**
   - Fixed: Split focus effect to run only on mount
   - Fixed: Added `preventScroll: true` to focus calls
   - Root cause: System clock timer causing per-second re-renders
   - Also memoized callbacks with `useCallback` in parent

---

## 📋 Testing Credentials

### Create Test VOC Request
1. Login as **Requester** (alex@company.com)
2. Select **Hardware Request** category
3. Fill: Device Type, Model Name, Serial Number, Reason
4. Submit → Get REQ code

### Assign Device to Request
1. Login as **Admin** (admin@company.com)
2. Go to **Ticket Queue**
3. Find your request (REQ-XXXX)
4. Click to open → Click **Manage**
5. Change status to **Resolved**
6. **Device Assignment Modal** appears automatically
7. Select device → Click **Confirm**
8. Device assigned with history logged

### Add Device Manually
1. Go to **Device Inventory** tab
2. Click **"Add Device"** button
3. Fill form:
   - Device Type, Model, Serial Number
   - Status, Assignment details
   - Purchase/Warranty dates
   - Specs (CPU, RAM, etc.)
4. **Add MAC Address:**
   - Click "Add MAC Address"
   - Select type (Ethernet/WiFi/etc.)
   - Enter MAC (format: AA:BB:CC:DD:EE:FF)
   - Click "Add"
5. Submit → Device added to inventory

---

## 📈 Performance & Limits

| Metric | Value |
|--------|-------|
| Max devices per list | 100 (paginated) |
| Max attachments per request | 10 |
| Max file size per attachment | 10 MB |
| Device history retention | Unlimited |
| Concurrent connections | 10 (configurable) |

---

## 🔒 Security Features

- **JWT Authentication:** Stateless, no sessions
- **Role-Based Access Control:** Admin, IT Support, Requester
- **Input Validation:** All forms validate before submission
- **SQL Injection Prevention:** Parameterized queries via Node.js drivers
- **XSS Prevention:** React auto-escaping, sanitized HTML
- **CORS:** Configured for localhost:3001 ↔ localhost:4001
- **Password Storage:** Bcrypt hashing (backend)

---

## 🛠️ Development

### Running Locally Without Docker
```bash
# Terminal 1: Start database
docker run -d \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=voc_system \
  mysql:8.4

# Terminal 2: Start backend
cd backend
npm install
npm run dev  # Runs on :4000

# Terminal 3: Start frontend
npm install
npm run dev  # Runs on :5173
```

### Building Docker Images
```bash
# Rebuild all
docker compose build

# Rebuild specific service
docker compose build voc-backend
docker compose build voc-frontend
```

### Database Migrations
```bash
# Add new migration (auto-runs on container start)
vi database/init/05_new_migration.sql
docker compose down -v  # Clear volume to re-init
docker compose up -d
```

---

## 📚 Directory Structure

```
n-voc-system-service-portal/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeviceManagement.tsx
│   │   │   ├── DeviceFormModal.tsx
│   │   │   ├── TicketDetailModal.tsx
│   │   │   └── ... (other components)
│   │   ├── pages/
│   │   ├── api/
│   │   │   └── client.ts (API client)
│   │   ├── types.ts (TypeScript types)
│   │   └── App.tsx
│   ├── Dockerfile.frontend
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── device.controller.ts
│   │   │   ├── ticket.controller.ts
│   │   │   └── auth.controller.ts
│   │   ├── models/
│   │   │   ├── device.repo.ts
│   │   │   ├── ticket.repo.ts
│   │   │   └── rows.ts
│   │   ├── routes/
│   │   │   ├── device.routes.ts
│   │   │   ├── ticket.routes.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   └── server.ts
│   ├── Dockerfile
│   └── package.json
│
├── database/
│   └── init/
│       ├── 01_schema.sql
│       ├── 02_seed.sql
│       └── 03_it_devices.sql
│
├── docker-compose.yml
├── .env
└── PROJECT.md (this file)
```

---

## 🚨 Troubleshooting

### Frontend not loading
```bash
# Clear browser cache
Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

# Check container logs
docker logs voc-frontend
```

### Backend API errors
```bash
# Check backend logs
docker logs voc-backend

# Verify database connection
docker logs voc-db
```

### Database issues
```bash
# Reset database (WARNING: loses all data)
docker compose down -v
docker compose up -d

# Verify tables created
docker exec voc-db mysql -u root -pvocRootSecret2026! voc_system -e "SHOW TABLES;"
```

### Port conflicts
- Frontend: 3001
- Backend: 4000
- Database: 3306

If ports are in use, update `.env` and `docker-compose.yml`

---

## 📞 Support & Issues

| Component | Issue | Solution |
|-----------|-------|----------|
| Device type dropdown closes | Modal focus effect re-running | Fixed in v5dc5f87 |
| Cannot add MAC address | Form hidden by default | Fixed in v bff0e04 |
| Modal scrolls to top | Per-second timer re-renders | Fixed in v5dc5f87 |
| Device assignment not appearing | Wrong field name check | Fixed in v147fa6c |
| Internal server error | Missing database table | Fixed by DB reset |

---

## 📝 License

Internal project - Not for external distribution

---

**Last Updated:** June 25, 2026  
**Status:** ✅ Production Ready
