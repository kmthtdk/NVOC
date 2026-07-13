# ✅ BLOCKING ISSUES - FIX CHECKLIST

**Target Date:** Complete Phase 1 by June 27, 2026 (48 hours)  
**Team:** Backend Dev + Frontend Dev + Security Eng (parallel)

---

## 🔴 CRITICAL ISSUES (4 Code Bugs)

### BUG-1: Device Checkout Modal Fake API ⏱️ 1 hour
**Status:** ⬜ TODO  
**Assigned to:** [Frontend Dev]  
**File:** `src/components/DeviceCheckoutModal.tsx:56-64`

**What's broken:**
```javascript
// Current (BROKEN)
const nextStatus = isReturn ? 'In Stock' : 'In Repair';
const auditNote = isReturn ? `Device returned…` : `…`;
await new Promise((resolve) => setTimeout(resolve, 800)); // FAKE DELAY
await onComplete(); // Resolves without updating DB
```

**Fix required:**
- [ ] Replace `setTimeout` with real API call: `api.updateDevice(deviceId, { status: nextStatus })`
- [ ] Add error handling + toast notification on failure
- [ ] Test: Unit test for status update, E2E for checkout flow
- [ ] Commit with message: `fix: implement device checkout API`

**Acceptance:** Device status actually updates in database

---

### BUG-2: ENUM Mismatch in action_type ⏱️ 30 min
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**Files:** 
- `backend/src/models/ticket.repo.ts:208,221`
- `database/init/03_it_devices.sql:65`

**What's broken:**
```sql
-- DB schema (line 65 of 03_it_devices.sql)
action_type ENUM('related','resolved','affected') NOT NULL DEFAULT 'related',

-- Application code (line 208 of ticket.repo.ts)
await deviceRepo.createLink(conn, ticketId, newDevice.id, 'new'); // INVALID!
```

**Fix required (choose one):**

**Option A (Simpler - Recommended):**
- [ ] Expand DB ENUM to include all valid values:
```sql
ALTER TABLE ticket_device_links MODIFY action_type 
  ENUM('related','resolved','affected','new','repair','return','replace') 
  NOT NULL DEFAULT 'related';
```

**Option B (Better architecture):**
- [ ] Add mapping function in `ticket.repo.ts`:
```typescript
const actionTypeToLinkType = (action: DeviceActionType): string => {
  const map: Record<DeviceActionType, string> = {
    'new': 'related',
    'repair': 'resolved',
    'return': 'affected',
    'replace': 'affected',
  };
  return map[action];
};
```
- [ ] Use in createLink call: `await deviceRepo.createLink(conn, ticketId, newDevice.id, actionTypeToLinkType(input.deviceAction))`

**Test:** Hardware ticket creation should link device successfully  
**Commit message:** `fix: resolve action_type ENUM mismatch`

**Acceptance:** Hardware request tickets successfully link devices

---

### BUG-3: Field Names Wrong in DeviceAssignmentModal ⏱️ 30 min
**Status:** ⬜ TODO  
**Assigned to:** [Frontend Dev]  
**File:** `src/components/DeviceAssignmentModal.tsx:14-21`

**What's broken:**
```typescript
// Current interface (WRONG - snake_case)
interface Device {
  serial_number: string; // Backend sends: serialNumber
  device_type: string;   // Backend sends: deviceType
  // ... other fields
}

// Result on line 190:
{device.serial_number || 'N/A'} // Always "N/A" because property is undefined!
```

**Fix required:**
- [ ] Change interface to match API contract:
```typescript
// Use shared types instead of duplicating
import type { Device } from '../types';

// OR manually fix the interface:
interface Device {
  serialNumber: string;  // Matches API
  deviceType: string;    // Matches API
  // ... other fields
}
```
- [ ] Update JSX references:
  - Line 190: `{device.serialNumber || 'N/A'}`
  - Line 192: `{device.deviceType}`
- [ ] Verify device list now shows real serial numbers

**Test:** Unit test that props map correctly from API response  
**Commit message:** `fix: correct field names in DeviceAssignmentModal`

**Acceptance:** Serial numbers display correctly in device list

---

### BUG-4: Stats Query Memory Bomb ⏱️ 1 hour
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/controllers/ticket.controller.ts:177-238`

**What's broken:**
```typescript
// Current - Loads 10,000 full objects into memory
const { data: allTickets } = await ticketRepo.list({
  page: 1,
  pageSize: 10000, // WRONG - loads entire dataset
  sort: 'newest',
});

// Then filters in JavaScript
const monthTickets = allTickets.filter(t => 
  new Date(t.createdAt) >= startOfMonth
);
```

**Fix required:**
- [ ] Replace `getStatsSummary()` with SQL aggregation:
```typescript
// New implementation
async getStatsSummary(req: Request, res: Response): Promise<void> {
  const year = req.query.year as string | undefined;
  const month = req.query.month as string | undefined;
  
  const startDate = month && year 
    ? new Date(parseInt(year), parseInt(month) - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  
  // Single SQL query - no application filtering
  const summary = await ticketRepo.getStatusCountsByMonth(startDate, endDate);
  
  res.json({ summary });
}
```
- [ ] Add to `ticket.repo.ts`:
```typescript
async getStatusCountsByMonth(startDate: Date, endDate: Date): Promise<Record<string, number>> {
  const rows = await pool.query(
    `SELECT status, COUNT(*) as count FROM tickets 
     WHERE created_at BETWEEN ? AND ?
     GROUP BY status`,
    [startDate, endDate]
  );
  
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}
```

**Test:** Performance test with 10K+ tickets - should complete in <100ms  
**Commit message:** `perf: optimize stats aggregation with SQL GROUP BY`

**Acceptance:** Stats endpoint completes quickly regardless of ticket volume

---

## 🔴 CRITICAL ISSUES (2 Security Vulnerabilities)

### SEC-1: No Rate Limiting on Login ⏱️ 30 min
**Status:** ⬜ TODO  
**Assigned to:** [Security Eng / Backend Dev]  
**File:** `backend/src/routes/auth.routes.ts`

**What's vulnerable:**
```
/api/auth/login accepts unlimited requests
→ Attacker can brute-force password with no throttling
→ Risk: Account takeover
```

**Fix required:**
- [ ] Install dependency (if not already installed):
  ```bash
  npm install express-rate-limit
  ```
- [ ] Add to `backend/src/routes/auth.routes.ts`:
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: { 
      code: 'TOO_MANY_REQUESTS', 
      message: 'Too many login attempts. Try again in 15 minutes.' 
    } 
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Apply to login route
authRoutes.post(
  '/login',
  loginLimiter, // ADD THIS
  validateBody(loginSchema),
  asyncHandler(authController.login)
);
```

- [ ] Add general API rate limiter in `backend/src/app.ts`:
```typescript
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per window
});
app.use('/api/', apiLimiter);
```

**Test:** Manual test - try login 11 times, should get rate limit error  
**Commit message:** `security: add rate limiting to auth endpoints`

**Acceptance:** Login endpoint returns 429 after 10 attempts in 15 min

---

### SEC-2: Comment Author Spoofing ⏱️ 20 min
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/controllers/ticket.controller.ts:162-173`

**What's vulnerable:**
```typescript
// Current - VULNERABLE (client-supplied)
const body = req.body as z.infer<typeof createCommentSchema>;
const comment = await commentRepo.create({
  author: body.author,  // CLIENT CONTROLS
  role: body.role,      // CLIENT CONTROLS
  content: body.content,
});

// Exploit: User sends:
// { author: "IT Manager", role: "it_support", content: "Your device is fixed" }
// Audit trail shows IT support resolved it, but it was a regular user
```

**Fix required:**
- [ ] Update `createCommentSchema` to remove author/role:
```typescript
const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  // Remove: author, role
});
```

- [ ] Update controller to use JWT:
```typescript
async create(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as z.infer<typeof createCommentSchema>;
  
  // Derive from JWT (req.user is verified JWT payload)
  const author = req.user?.name ?? 'Unknown User';
  const role: 'requester' | 'it_support' = 
    (req.user?.role === 'admin' || req.user?.role === 'it_support') 
      ? 'it_support' 
      : 'requester';
  
  const comment = await commentRepo.create(id, {
    content: body.content,
    author,    // from JWT
    role,      // from JWT
  });
  
  res.json({ comment });
}
```

**Test:** Unit test - verify comment author matches authenticated user  
**Commit message:** `security: fix comment author spoofing via JWT`

**Acceptance:** Comments always show correct author/role from authentication

---

## ⚠️ HIGH ISSUES (4 Security)

### HIGH-SEC-1: IDOR on Ticket Details ⏱️ 1 hour
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/controllers/ticket.controller.ts:57-63` (GET endpoint)

**What's vulnerable:**
```
GET /tickets/:id only checks authentication
→ Any user can read any other user's ticket + PII (email, dept, phone)
→ Also affects GET /tickets (list endpoint - returns all tickets to any user)
```

**Fix required:**
- [ ] Add ownership/role check in `ticketController.get()`:
```typescript
async get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const ticket = await ticketRepo.getByIdFull(id);
  
  if (!ticket) throw AppError.notFound('Ticket not found');
  
  // ADD THIS - Check access permission
  const isOwner = Number(req.user?.sub) === ticket.requesterId;
  const isStaff = ['it_support', 'admin'].includes(req.user?.role);
  
  if (!isOwner && !isStaff) {
    throw AppError.forbidden('Access denied');
  }
  
  res.json({ ticket });
}
```

- [ ] Also apply to `list()` endpoint (return only own + staff-visible tickets)

**Test:** Unit test - requester can read own, cannot read others' tickets  
**Commit message:** `security: add IDOR checks to ticket endpoints`

**Acceptance:** Users can only read their own tickets (unless IT staff)

---

### HIGH-SEC-2: IDOR on Attachment Download ⏱️ 1 hour
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/controllers/attachment.controller.ts:44-61`

**What's vulnerable:**
```
GET /attachments/:id only checks authentication
→ Any user can download any file from any ticket
→ Risk: Confidential document exposure
```

**Fix required:**
- [ ] Add ownership/role check:
```typescript
async get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const attachment = await attachmentRepo.findById(id);
  
  if (!attachment) throw AppError.notFound('Attachment not found');
  
  // ADD THIS - Verify access
  const ticket = await ticketRepo.getByIdFull(attachment.ticket_id);
  
  if (!ticket) throw AppError.notFound('Ticket not found');
  
  const isOwner = Number(req.user?.sub) === ticket.requesterId;
  const isStaff = ['it_support', 'admin'].includes(req.user?.role);
  
  if (!isOwner && !isStaff) {
    throw AppError.forbidden('Access denied');
  }
  
  // Proceed with file download...
}
```

**Test:** Unit test - verify access check blocks unauthorized downloads  
**Commit message:** `security: add IDOR protection to attachment downloads`

**Acceptance:** Users can only download attachments from their own tickets

---

### HIGH-SEC-3: Device Assign Endpoint Missing Validation ⏱️ 30 min
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/routes/device.routes.ts:44-50`

**What's vulnerable:**
```
POST /devices/:id/assign skips validateBody middleware
→ No length limits, no format validation on input fields
→ Risk: Injection, constraint violations, audit trail corruption
```

**Fix required:**
- [ ] Create Zod schema in device controller:
```typescript
const assignDeviceSchema = z.object({
  userName: z.string().trim().min(1).max(100),
  userEmail: z.string().email(),
  userDept: z.string().min(1).max(50),
  ticketId: z.coerce.number().positive(),
  reason: z.string().max(500),
});
```

- [ ] Add middleware to route:
```typescript
deviceRoutes.post(
  '/:id/assign',
  authenticate,
  requireRole('it_support', 'admin'),
  validateBody(assignDeviceSchema), // ADD THIS
  asyncHandler(deviceController.assignToUser)
);
```

**Test:** Unit test - invalid input should fail validation  
**Commit message:** `security: add input validation to device assign`

**Acceptance:** Route rejects invalid/oversized input

---

### HIGH-SEC-4: File MIME Type Check Bypassed ⏱️ 1 hour
**Status:** ⬜ TODO  
**Assigned to:** [Backend Dev]  
**File:** `backend/src/middleware/upload.ts:41-44`

**What's vulnerable:**
```
Multer's file.mimetype comes from client Content-Type header
→ Attacker can upload executable by lying about file type
→ Risk: Code injection, malware upload
```

**Fix required:**
- [ ] Add magic-byte validation after multer writes file:
```bash
npm install file-type
```

- [ ] Update middleware:
```typescript
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';

// After multer writes file to disk
export const validateFileType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) return next();
  
  try {
    const fileBuffer = await fs.readFile(req.file.path);
    const detectedType = await fileTypeFromBuffer(fileBuffer);
    
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    
    if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
      // Delete malicious file
      await fs.unlink(req.file.path);
      return res.status(400).json({
        error: { code: 'INVALID_FILE_TYPE', message: 'Invalid file type' }
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: { code: 'FILE_VALIDATION_ERROR' } });
  }
};

// Add to upload route AFTER multer
fileRoutes.post(
  '/upload',
  authenticate,
  upload.single('file'),
  validateFileType, // ADD THIS
  asyncHandler(attachmentController.upload)
);
```

**Test:** Try uploading PHP/EXE with image MIME type - should be rejected  
**Commit message:** `security: add magic-byte validation to file uploads`

**Acceptance:** Only actual PNG/JPEG/PDF files accepted regardless of Content-Type

---

## 📋 HOUSEKEEPING

### STATE-1: Commit Pending Files ⏱️ 15 min
**Status:** ⬜ TODO  
**Files:** 15 modified files in git status

**Action required:**
```bash
git add backend/src/controllers/device.controller.ts
git add backend/src/controllers/ticket.controller.ts
git add backend/src/routes/device.routes.ts
git add backend/src/routes/ticket.routes.ts
git add database/init/03_it_devices.sql
git add src/components/*.tsx
git add src/App.tsx
git add backend/src/models/*.ts
git add backend/src/types/index.ts

git commit -m "feat: implement device management features

- Add device assignment modal with proper validation
- Implement device checkout workflow
- Add MAC address management
- Fix device specifications tracking
- Add device reports (history, summary, assignment, department)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

git push origin master
```

**Verification:**
```bash
git status  # Should show clean working directory
```

---

### STATE-2: Cleanup Root Directory ⏱️ 1 hour
**Status:** ⬜ TODO  
**Goal:** Remove 66 untracked files

**Actions:**
1. [ ] Delete Python test scripts (non-suite):
   ```bash
   rm test_*.py test_*.sh debug_*.py
   ```

2. [ ] Delete screenshots:
   ```bash
   rm *.png
   ```

3. [ ] Move remaining scripts to proper location:
   ```bash
   mkdir -p scripts/tests
   mv remaining_test_files scripts/tests/
   ```

4. [ ] Delete or consolidate documentation:
   ```bash
   rm *_IMPLEMENTATION*.md *_SUMMARY*.md *_QUICK*.md DASHBOARD_*.md
   # Keep only: PROJECT.md, README.md, ARCHITECTURE.md
   ```

5. [ ] Update .gitignore:
   ```bash
   cat >> .gitignore << 'EOF'
   # Testing artifacts
   test_*.py
   test_*.sh
   debug_*.py
   debug_*.png

   # Screenshots
   *.png

   # IDE/OS
   .DS_Store
   .vscode/
   .env.local
   EOF
   ```

6. [ ] Verify cleanup:
   ```bash
   git status  # Should show clean
   ls -la | grep -E '\.(py|png|sh)$'  # Should be empty
   ```

**Commit:**
```bash
git add .gitignore
git commit -m "chore: cleanup root directory and update gitignore"
```

---

## 📊 PROGRESS TRACKING

### Daily Standup Template

```
Date: ______
Sprint: Phase 1 Security + Bug Fixes

COMPLETED:
- [ ] BUG-1: Device checkout API
- [ ] BUG-2: ENUM mismatch
- [ ] BUG-3: Field names
- [ ] BUG-4: Stats query
- [ ] SEC-1: Rate limiting
- [ ] SEC-2: Comment spoofing
- [ ] HIGH-SEC-1: IDOR tickets
- [ ] HIGH-SEC-2: IDOR attachments
- [ ] HIGH-SEC-3: Assign validation
- [ ] HIGH-SEC-4: File MIME validation
- [ ] STATE-1: Commit files
- [ ] STATE-2: Cleanup root

IN PROGRESS:
- [Issue ID]: [Description]

BLOCKED:
- [Issue ID]: [Reason]

METRICS:
- Bugs fixed: __/4
- Security vulns fixed: __/6
- Test pass rate: __%
- Code review status: ___
```

---

## ACCEPTANCE CRITERIA

✅ **Phase 1 Complete When:**
- [ ] All 4 CRITICAL code bugs fixed and unit tested
- [ ] All 2 CRITICAL security vulns fixed
- [ ] All 4 HIGH security issues fixed
- [ ] 15 files committed to git
- [ ] Root directory cleaned
- [ ] TypeScript compilation passing
- [ ] Core E2E workflows passing (device assignment → checkout)
- [ ] Security team sign-off obtained

**Sign-Off:** [Security Lead] ________ | [Tech Lead] ________

---

**Timeline:** Complete by EOD June 27, 2026  
**Escalation:** Report blockers to [Engineering Lead] immediately  
**Questions:** See `REVIEW_REPORT_2026-06-25.md` for context
