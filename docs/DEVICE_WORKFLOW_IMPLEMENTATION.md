# Device Assignment Workflow Implementation

## Overview
Modified `AdminSimulation.tsx` to trigger device assignment workflows when resolving hardware request tickets. The implementation adds modal-based workflows for three device action types:
- **new**: Show `DeviceAssignmentModal` to select device from inventory
- **replace**: Show `DeviceCheckoutModal` to confirm replacement device details
- **return**: Show `DeviceCheckoutModal` to confirm returned device condition

## Key Design Decisions

### 1. Linked Device Detection
Currently uses `ticket.details.deviceActionType` as a proxy for "linked device." This field is populated when:
- Ticket category = `'hardware_request'` (verified in `categories.ts`)
- Request type specifies device action (new, repair, replace, return)

**Note**: If a dedicated `ticket_device_links` table exists in the backend, update the detection logic in `shouldTriggerDeviceWorkflow()` to query that instead.

### 2. Device Action Type Handling
```
deviceActionType === 'new'          → DeviceAssignmentModal
deviceActionType === 'repair'       → No modal (in-situ repair, no workflow)
deviceActionType === 'replace'      → DeviceCheckoutModal
deviceActionType === 'return'       → DeviceCheckoutModal
```

### 3. Workflow State Management
Device workflow is deferred: when the user clicks "Update State & Log Audit" on a hardware request moving to 'resolved':
1. Modal opens instead of immediately calling `api.updateTicket()`
2. User completes modal action (select device or confirm checkout details)
3. Modal's `onComplete()` handler calls both device API + ticket resolve update
4. This prevents double-resolving or orphaned device records

## Modified Files

### 1. `src/components/AdminSimulation.tsx` (Updated)

**Key additions:**

```typescript
// Import modals
import DeviceAssignmentModal from './DeviceAssignmentModal';
import DeviceCheckoutModal from './DeviceCheckoutModal';

// Device workflow state interface
interface PendingDeviceWorkflow {
  ticketId: string;
  ticketCode: string;
  deviceActionType: 'new' | 'replace' | 'return';
  assignedTo: string;
  notes: string;
}

// New state
const [deviceWorkflow, setDeviceWorkflow] = useState<PendingDeviceWorkflow | null>(null);

// New function: Device workflow detection
const shouldTriggerDeviceWorkflow = (): boolean => {
  if (!activeTicket) return false;
  if (newStatus !== 'resolved') return false;
  if (activeTicket.category !== 'hardware_request') return false;
  const actionType = activeTicket.details?.deviceActionType;
  return actionType === 'new' || actionType === 'replace' || actionType === 'return';
};

// Updated handleUpdate: Branch on device workflow
const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
  // ...
  if (shouldTriggerDeviceWorkflow()) {
    // Open modal instead of immediate update
    setDeviceWorkflow({...});
    return;
  }
  // Standard update path
  await api.updateTicket(selectedTicketId, {...});
};

// New function: Device workflow completion
const handleDeviceWorkflowComplete = async () => {
  // Call device API (TODO when available)
  // Then call updateTicket to resolve
  await api.updateTicket(deviceWorkflow.ticketId, {
    status: 'resolved',
    assignedTo: deviceWorkflow.assignedTo,
    notes: deviceWorkflow.notes,
  });
};

// Modal renders at end of component
{deviceWorkflow && deviceWorkflow.deviceActionType === 'new' && (
  <DeviceAssignmentModal {...} />
)}
{deviceWorkflow && (deviceWorkflow.deviceActionType === 'return' || ...) && (
  <DeviceCheckoutModal {...} />
)}
```

### 2. `src/components/DeviceAssignmentModal.tsx` (New)

Modal for assigning new devices. Features:
- Radio selection from available device inventory
- Device model, serial number, status display
- Placeholder device list (TODO: replace with API fetch)
- Disabled "Assign & Resolve" button until device selected
- Calls `onComplete()` to trigger device assignment + ticket resolve

Props:
```typescript
interface DeviceAssignmentModalProps {
  ticketCode: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
```

### 3. `src/components/DeviceCheckoutModal.tsx` (New)

Modal for return/replacement device checkout. Features:
- Device condition selection (good, damaged, unknown)
- Optional checkout notes textarea
- Warning alert if device marked damaged (routed for repair)
- Handles both 'return' and 'replace' action types
- Calls `onComplete()` to trigger device checkout + ticket resolve

Props:
```typescript
interface DeviceCheckoutModalProps {
  ticketCode: string;
  deviceActionType: 'return' | 'replace';
  onComplete: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
```

## Integration Points (Requires Backend Implementation)

### Device API Endpoints Needed

1. **Assign new device** (TODO in `handleDeviceWorkflowComplete`)
   ```typescript
   // Example structure
   await api.assignDevice(deviceId, {
     ticketCode: string,
     actionType: 'new',
   });
   ```

2. **Checkout device** (TODO in `DeviceCheckoutModal.handleCheckoutDevice`)
   ```typescript
   // Example structure
   await api.checkoutDevice(ticketCode, {
     actionType: 'return' | 'replace',
     condition: 'good' | 'damaged' | 'unknown',
     notes: string,
   });
   ```

3. **Device inventory list** (TODO in `DeviceAssignmentModal`)
   ```typescript
   // Currently uses placeholder array
   // Should fetch: const devices = await api.getAvailableDevices();
   ```

### API Client Updates
Add these methods to `src/api/client.ts`:
```typescript
assignDevice(deviceId: string, payload: {...}): Promise<void> {
  return request<void>(`/devices/${deviceId}/assign`, { method: 'POST', body: payload });
}

checkoutDevice(ticketCode: string, payload: {...}): Promise<void> {
  return request<void>(`/devices/checkout`, { method: 'POST', body: payload });
}

getAvailableDevices(): Promise<Device[]> {
  return request<Device[]>(`/devices/available`);
}
```

## Testing Workflow

1. Load AdminSimulation component with hardware_request tickets
2. Select a ticket with `category === 'hardware_request'` and `details.deviceActionType in ['new','replace','return']`
3. Change status to "Resolved"
4. Click "Update State & Log Audit" button
5. Verify appropriate modal appears:
   - DeviceAssignmentModal for `deviceActionType='new'`
   - DeviceCheckoutModal for `deviceActionType='replace'` or `'return'`
6. Complete modal action
7. Verify ticket is marked resolved and onMutated callback fires

## Category ID Reference
Verified in `src/data/categories.ts`:
- Hardware requests use category ID: `'hardware_request'` (not name)
- Valid subcategories: desktop, laptop, monitor, phone, tablet, deskphone, removable_disk, accessories
- Valid action types: new, repair, replace, return

## Notes
- Modals are styled to match existing ConfirmationModal aesthetic (dark mode, accessible)
- Device workflow respects the deferred-update pattern (no double-resolve)
- 'repair' action type intentionally excluded from modal trigger (in-situ, no assignment needed)
- All TODO comments mark places where device API integration is needed
