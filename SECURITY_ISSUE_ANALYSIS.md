# Security Issue: Requester Can See Admin Tab After Submit

## Issue Description
User reports that after submitting a VOC request as a **requester**, they can still see the **"IT Admin Workspace"** tab in the header. This should NOT be visible to requesters.

## Code Analysis

### Frontend Access Control (React)
**File:** `src/App.tsx` (lines 151-163)

```javascript
{isITSupport && (
  <button
    onClick={() => setView('admin')}
    className={...}
  >
    <Shield className="w-3.5 h-3.5" />
    <span>IT Admin Workspace</span>
  </button>
)}
```

**Expected Behavior:** Button only renders if `isITSupport === true`

### Auth State Management
**File:** `src/context/AuthContext.tsx` (lines 104-117)

```javascript
const value = useMemo<AuthContextValue>(() => {
  const role: UserRole | undefined = user?.role;
  return {
    // ... other properties
    isAdmin: role === 'admin',
    isITSupport: role === 'admin' || role === 'it_support',
  };
}, [user, ...]);
```

**Expected Behavior:** 
- If user.role === 'requester' → isITSupport = false
- If user.role === 'it_support' or 'admin' → isITSupport = true

### Backend Login Response
**Verified Working Correctly:**
- Requester: `"role": "requester"` ✅
- IT Support: `"role": "it_support"` ✅
- Admin: `"role": "admin"` ✅

---

## Possible Root Causes

### 1. **State Synchronization Delay** (Most Likely)
After user logs in, there might be a timing issue where:
1. User submits login → backend returns JWT token
2. Frontend sets token in localStorage/state
3. During the transition/reload, old user state persists briefly
4. The admin tab is briefly visible before state updates

**Evidence:** User can see tab immediately after submitting form, before page fully loads

### 2. **Token Persistence Issue**
If a previous admin/IT session token is cached in localStorage:
1. User A (Admin) logs in and submits a request
2. Token is stored in localStorage
3. User B (Requester) logs in, but old admin token somehow persists
4. Frontend renders based on cached token's role

### 3. **Missing useEffect Dependency**
The snap-back useEffect might have missing dependencies:

```javascript
// Current code (line 82-84)
useEffect(() => {
  if (view === 'admin' && !isITSupport) setView('user');
}, [view, isITSupport]); // ✅ Looks correct
```

But it's possible the `isITSupport` value isn't being updated when user changes.

### 4. **Mobile/Hidden View Issue**
On smaller screens, the tab might be hidden:
```javascript
<div className="hidden sm:flex ..."> {/* Hidden on small screens */}
```

But if user resizes or uses responsive design, tab appears without proper role check.

---

## Verification Steps

### Step 1: Clear Browser Cache
1. Open DevTools (F12)
2. Go to Storage → Local Storage → Clear All
3. Reload page and login again

**If issue disappears:** Token persistence is the culprit

### Step 2: Check useEffect Dependency
The snap-back logic should prevent viewing admin content:

```javascript
useEffect(() => {
  if (view === 'admin' && !isITSupport) setView('user');
}, [view, isITSupport]);
```

**Check:** Is this useEffect running after login?

### Step 3: Add Console Logging
Add debugging to AuthContext:

```javascript
useEffect(() => {
  console.log('User changed:', user?.email, 'Role:', user?.role, 'isITSupport:', isITSupport);
}, [user]);
```

---

## Recommended Fixes

### Fix 1: Force Clear Old Session (Immediate)
In `AuthContext.tsx` logout function:

```javascript
const logout = useCallback(() => {
  setAuthToken(null);
  setUser(null);
  // Force clear localStorage completely
  localStorage.clear();
  sessionStorage.clear();
}, []);
```

### Fix 2: Add Explicit Role Check Before Rendering Tab
Modify the tab rendering to be more defensive:

```javascript
{isITSupport && user?.role !== 'requester' && (
  <button ... >IT Admin Workspace</button>
)}
```

### Fix 3: Add Console Warning for Unexpected States
```javascript
useEffect(() => {
  // Warn if a requester somehow got admin view
  if (view === 'admin' && (user?.role === 'requester')) {
    console.warn('SECURITY: Requester in admin view!', {
      user: user?.email,
      role: user?.role,
      isITSupport
    });
    setView('user');
  }
}, [view, user?.role]);
```

### Fix 4: Double-Check Auth on Every Route Change
Implement route protection middleware:

```javascript
useEffect(() => {
  const userRole = user?.role;
  const isAttemptingAdmin = view === 'admin';
  
  if (isAttemptingAdmin && userRole === 'requester') {
    // Hard redirect - not just state change
    window.location.reload();
  }
}, [view, user?.role]);
```

---

## Risk Assessment

**Severity:** 🔴 **HIGH** (if confirmed)

**Impact:**
- Requesters might see confidential admin information
- Requesters might be able to modify other users' tickets
- Backend should still block write operations (403), but information disclosure is risk

**Affected Users:**
- Any requester who logs in after an admin/IT support session

**Mitigation (Current):**
- Backend enforces role-based access (PUT/DELETE blocked with 403)
- useEffect snaps back to user view if admin tab accessed
- But the tab being VISIBLE is a UX/security issue

---

## Testing Instructions

### Test 1: Verify Tab Visibility After Login
```bash
# 1. Open browser DevTools (F12)
# 2. Login as requester (alex.mercer@company.com)
# 3. Check if "IT Admin Workspace" tab appears in header
# 4. Expected: Tab should NOT appear
# 5. Result: ?
```

### Test 2: Check Browser Storage
```bash
# 1. Open DevTools → Storage → Local Storage
# 2. Look for 'authToken' or 'token' key
# 3. Decode the JWT (use jwt.io)
# 4. Verify the role in the token payload
```

### Test 3: Monitor Network
```bash
# 1. Open DevTools → Network tab
# 2. Login as requester
# 3. Check /auth/login response
# 4. Verify role field in response is "requester"
```

---

## Next Steps

1. **Confirm the Issue:**
   - Can you reproduce the issue consistently?
   - Does it happen with all requester accounts?
   - Does clearing browser cache fix it?

2. **Implement Immediate Fix:**
   - Add defensive check in tab rendering
   - Add console logging for debugging
   - Clear localStorage on logout

3. **Test Thoroughly:**
   - Test login/logout sequence
   - Test with different browsers
   - Test rapid role changes

4. **Deploy Security Patch:**
   - Implement all recommended fixes
   - Update AuthContext
   - Test in production-like environment

---

## Conclusion

The access control **logic appears sound** in code review, but there may be a **state synchronization or caching issue** causing the admin tab to briefly appear for requesters.

This needs to be **investigated immediately** and **fixed urgently** as it's a security issue affecting authorization visibility.

