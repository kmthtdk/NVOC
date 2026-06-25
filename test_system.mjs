#!/usr/bin/env node
/**
 * N-VOC System Functional Testing
 * Tests all user and admin workflows, verifies reports
 */

const API_URL = 'http://localhost:4001/api';
let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  tests: []
};

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(colors[color], ...args, colors.reset);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name, fn) {
  try {
    log('blue', `\n[TEST] ${name}`);
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: '✅ PASS' });
    log('green', `  ✅ PASS`);
  } catch (err) {
    testResults.failed++;
    testResults.tests.push({ name, status: '❌ FAIL', error: err.message });
    testResults.errors.push({ test: name, error: err.message });
    log('red', `  ❌ FAIL: ${err.message}`);
  }
}

let authToken = null;
let userId = null;
let deviceId = null;
let ticketId = null;

// ============================================================================
// TEST 1: Authentication
// ============================================================================

await test('Login as requester user', async () => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.mercer@company.com',
      password: 'Passw0rd!'
    })
  });

  assert(res.ok, `Login failed: ${res.status}`);
  const data = await res.json();
  assert(data.token, 'No token in response');
  authToken = data.token;
  userId = data.user?.id;
  log('cyan', `  Token: ${authToken.substring(0, 20)}...`);
  log('cyan', `  User ID: ${userId}`);
});

// ============================================================================
// TEST 2: User Workflows - Create Request
// ============================================================================

await test('Create Hardware Request (User)', async () => {
  const res = await fetch(`${API_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      category: 'hardware_request',
      subcategory: 'laptop',
      title: 'New Laptop Request',
      description: 'Need new laptop for development',
      requesterName: 'Alex Mercer',
      requesterEmail: 'alex.mercer@company.com',
      requesterDept: 'R&D / Software Engineering',
      priority: 'high',
      deviceAction: 'new',
      deviceType: 'laptop'
    })
  });

  assert(res.ok, `Create ticket failed: ${res.status}`);
  const data = await res.json();
  ticketId = data.ticket?.id;
  assert(ticketId, 'No ticket ID returned');
  log('cyan', `  Ticket ID: ${ticketId}`);
  log('cyan', `  Ticket Code: ${data.ticket?.code}`);
});

await test('Get User Requests (User)', async () => {
  const res = await fetch(`${API_URL}/tickets`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  assert(res.ok, `Get tickets failed: ${res.status}`);
  const data = await res.json();
  assert(Array.isArray(data.data), 'Response not array');
  log('cyan', `  Found ${data.data.length} tickets`);
});

await test('Add Comment to Request (User)', async () => {
  const res = await fetch(`${API_URL}/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      content: 'Please prioritize this request'
    })
  });

  assert(res.ok, `Add comment failed: ${res.status}`);
  const data = await res.json();
  log('cyan', `  Comment added by: ${data.data?.author}`);
});

// ============================================================================
// TEST 3: Admin Login
// ============================================================================

let adminToken = null;
let adminId = null;

await test('Login as admin', async () => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@company.com',
      password: 'Passw0rd!'
    })
  });

  assert(res.ok, `Admin login failed: ${res.status}`);
  const data = await res.json();
  assert(data.token, 'No admin token');
  adminToken = data.token;
  adminId = data.user?.id;
  log('cyan', `  Admin Token: ${adminToken.substring(0, 20)}...`);
});

// ============================================================================
// TEST 4: Admin Workflows - Device Management
// ============================================================================

await test('Create Device (Admin)', async () => {
  const res = await fetch(`${API_URL}/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      deviceType: 'laptop',
      model: 'XPS 13',
      serialNumber: `DELL-XPS-${Date.now()}`,
      status: 'In Stock',
      purchaseDate: '2024-01-15',
      warrantyExpiry: '2026-01-15'
    })
  });

  assert(res.ok, `Create device failed: ${res.status}`);
  const data = await res.json();
  deviceId = data.data?.id;
  assert(deviceId, 'No device ID returned');
  log('cyan', `  Device ID: ${deviceId}`);
});

await test('Add MAC Address to Device', async () => {
  const res = await fetch(`${API_URL}/devices/${deviceId}/mac`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      macAddress: `${Math.random().toString(16).slice(2, 4).toUpperCase()}:${Math.random().toString(16).slice(2, 4).toUpperCase()}:${Math.random().toString(16).slice(2, 4).toUpperCase()}:${Math.random().toString(16).slice(2, 4).toUpperCase()}:${Math.random().toString(16).slice(2, 4).toUpperCase()}:${Math.random().toString(16).slice(2, 4).toUpperCase()}`,
      macType: 'Ethernet'
    })
  });

  assert(res.ok, `Add MAC failed: ${res.status}`);
  const data = await res.json();
  log('cyan', `  MAC Address: ${data.data?.macAddress}`);
});

await test('Assign Device to User', async () => {
  const res = await fetch(`${API_URL}/devices/${deviceId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      userId: userId,
      userName: 'Alex Mercer',
      userEmail: 'alex.mercer@company.com',
      userDept: 'R&D / Software Engineering',
      reason: 'Device assignment for development'
    })
  });

  assert(res.ok, `Assign device failed: ${res.status}`);
  const data = await res.json();
  log('cyan', `  Assigned to: ${data.device?.assignedTo}`);
});

await test('Get Device Details', async () => {
  const res = await fetch(`${API_URL}/devices/${deviceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Get device failed: ${res.status}`);
  const data = await res.json();
  log('cyan', `  Device: ${data.data?.model}`);
  log('cyan', `  Serial: ${data.data?.serialNumber}`);
  log('cyan', `  Status: ${data.data?.status}`);
});

// ============================================================================
// TEST 5: Reports - Admin Side
// ============================================================================

await test('Get Device Summary Report', async () => {
  const res = await fetch(`${API_URL}/devices/reports/summary`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Summary report failed: ${res.status}`);
  const data = await res.json();
  const summary = data.summary || data.data || {};
  log('cyan', `  Total Devices: ${summary.total || 0}`);
  log('cyan', `  Available: ${summary.available || 0}`);
  log('cyan', `  Assigned: ${summary.assigned || 0}`);
});

await test('Get Device Assignment Report', async () => {
  const res = await fetch(`${API_URL}/devices/reports/assignments`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Assignment report failed: ${res.status}`);
  const data = await res.json();
  assert(Array.isArray(data.assignments) || Array.isArray(data.data), 'Report data not array');
  const assignments = data.assignments || data.data || [];
  log('cyan', `  Assignments in report: ${assignments.length}`);
});

await test('Get Ticket Stats Report', async () => {
  const res = await fetch(`${API_URL}/tickets/stats/summary`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Stats report failed: ${res.status}`);
  const data = await res.json();
  const stats = data.stats || data.data || {};
  log('cyan', `  Total Tickets: ${stats.total || 0}`);
  log('cyan', `  Pending: ${stats.pending || 0}`);
  log('cyan', `  Completed: ${stats.completed || 0}`);
});

await test('Get Ticket Analytics - Recent Stats', async () => {
  const res = await fetch(`${API_URL}/tickets/stats/recent`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Recent stats failed: ${res.status}`);
  const data = await res.json();
  const stats = data.stats || data.data || [];
  assert(Array.isArray(stats), 'Stats not array');
  log('cyan', `  Records in recent stats: ${stats.length}`);
});

// ============================================================================
// TEST 6: Device Checkout (TEST BUG-1)
// ============================================================================

await test('BUG TEST: Checkout Device (Fake API Bug)', async () => {
  const res = await fetch(`${API_URL}/devices/${deviceId}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      condition: 'good',
      notes: 'Device checked out for return',
      actionType: 'return'
    })
  });

  if (res.status === 404) {
    throw new Error('Checkout endpoint not found - may be implemented differently');
  }

  assert(res.ok, `Checkout failed: ${res.status}`);
  const data = await res.json();
  log('cyan', `  Device status: ${data.device?.status}`);

  // Verify device status changed in DB
  const checkRes = await fetch(`${API_URL}/devices/${deviceId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const deviceData = await checkRes.json();
  const status = deviceData.data?.status;
  log('cyan', `  Device status after checkout: ${status}`);

  if (status !== 'checked_out') {
    throw new Error(`BUG CONFIRMED: Status is ${status}, should be 'checked_out'`);
  }
});

// ============================================================================
// TEST 7: Verify Data Consistency
// ============================================================================

await test('Verify Ticket appears in Admin View', async () => {
  const res = await fetch(`${API_URL}/tickets`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Admin get tickets failed: ${res.status}`);
  const data = await res.json();
  const ticket = data.data.find(t => t.id === ticketId);
  assert(ticket, `Ticket ${ticketId} not found in admin view`);
  log('cyan', `  Ticket found in admin view: ${ticket.code}`);
});

await test('Verify Device appears in Admin Inventory', async () => {
  const res = await fetch(`${API_URL}/devices`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(res.ok, `Admin get devices failed: ${res.status}`);
  const data = await res.json();
  const device = data.data.find(d => d.id === deviceId);
  assert(device, `Device ${deviceId} not found in admin inventory`);
  log('cyan', `  Device found in inventory: ${device.code}`);
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(80));
log('cyan', '\n FINAL TEST RESULTS\n');
console.log('='.repeat(80));

testResults.tests.forEach(t => {
  const color = t.status.includes('PASS') ? 'green' : 'red';
  log(color, `${t.status.padEnd(10)} ${t.name}`);
  if (t.error) {
    log('yellow', `         └─ ${t.error}`);
  }
});

console.log('\n' + '='.repeat(80));
log('cyan', `SUMMARY: ${testResults.passed} PASSED, ${testResults.failed} FAILED`);
log('cyan', `Score: ${testResults.passed}/${testResults.passed + testResults.failed}`);

if (testResults.errors.length > 0) {
  log('yellow', '\nFAILURES:');
  testResults.errors.forEach(e => {
    log('red', `  ❌ ${e.test}`);
    log('yellow', `     ${e.error}`);
  });
}

console.log('\n' + '='.repeat(80) + '\n');

process.exit(testResults.failed > 0 ? 1 : 0);
