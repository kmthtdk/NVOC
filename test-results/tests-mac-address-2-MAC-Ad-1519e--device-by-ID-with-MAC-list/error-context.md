# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\mac-address.spec.ts >> 2. MAC Address Retrieval >> 2.1: Get device by ID with MAC list
- Location: tests\mac-address.spec.ts:289:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
  28  | 
  29  | // Seeded test credentials (from database/init/02_seed.sql)
  30  | const TEST_USERS = {
  31  |   admin: { email: 'admin@company.com', password: 'Passw0rd!' },
  32  |   itSupport: { email: 'marcus.vance@company.com', password: 'Passw0rd!' },
  33  |   requester: { email: 'alex.mercer@company.com', password: 'Passw0rd!' },
  34  | };
  35  | 
  36  | // Test data
  37  | interface Device {
  38  |   id: number;
  39  |   code: string;
  40  |   deviceType: string;
  41  |   model: string;
  42  |   serialNumber: string;
  43  |   status: 'Active' | 'In Repair' | 'Retired' | 'Lost';
  44  |   assignedTo: string | null;
  45  |   department: string | null;
  46  |   purchaseDate: string | null;
  47  |   warrantyExpiry: string | null;
  48  |   notes: string | null;
  49  |   createdAt: string;
  50  |   updatedAt: string;
  51  |   linkedTickets: unknown[];
  52  |   macAddresses?: MacAddress[];
  53  | }
  54  | 
  55  | interface MacAddress {
  56  |   id: number;
  57  |   deviceId: number;
  58  |   macType: 'Ethernet' | 'WiFi' | 'Bluetooth' | 'Other';
  59  |   macAddress: string;
  60  |   createdAt: string;
  61  |   updatedAt: string;
  62  | }
  63  | 
  64  | // Test helper: Generate unique serial number
  65  | function getUniqueSerial(prefix = 'SN-TEST'): string {
  66  |   return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  67  | }
  68  | 
  69  | // Test helper: Login and capture JWT token
  70  | async function loginAndGetToken(
  71  |   request: typeof test.requestFixture,
  72  |   email: string,
  73  |   password: string,
  74  | ): Promise<string> {
  75  |   const response = await request.post(`${API_BASE}/auth/login`, {
  76  |     data: { email, password },
  77  |   });
  78  |   expect(response.status()).toBe(200);
  79  |   const body = await response.json();
  80  |   expect(body.token).toBeTruthy();
  81  |   console.log(`[AUTH] Logged in as ${email}`);
  82  |   return body.token;
  83  | }
  84  | 
  85  | // Test helper: Create a device
  86  | async function createDevice(
  87  |   request: typeof test.requestFixture,
  88  |   token: string,
  89  |   overrides?: Partial<Device>,
  90  | ): Promise<Device> {
  91  |   const payload = {
  92  |     deviceType: overrides?.deviceType || 'laptop',
  93  |     model: overrides?.model || 'Dell XPS 15',
  94  |     serialNumber: overrides?.serialNumber || getUniqueSerial(),
  95  |     status: overrides?.status || 'Active',
  96  |     assignedTo: overrides?.assignedTo || 'John Doe',
  97  |     department: overrides?.department || 'IT Operations',
  98  |     purchaseDate: overrides?.purchaseDate || '2026-01-01',
  99  |     warrantyExpiry: overrides?.warrantyExpiry || '2028-01-01',
  100 |     notes: overrides?.notes || 'Test device for MAC testing',
  101 |   };
  102 | 
  103 |   const response = await request.post(`${API_BASE}/devices`, {
  104 |     headers: { Authorization: `Bearer ${token}` },
  105 |     data: payload,
  106 |   });
  107 | 
  108 |   expect(response.status()).toBe(201);
  109 |   const body = await response.json();
  110 |   const device: Device = body.data;
  111 |   console.log(`[DEVICE CREATE] Device ${device.code} (id=${device.id}) created`);
  112 |   return device;
  113 | }
  114 | 
  115 | // Test helper: Add MAC address to device
  116 | async function addMacToDevice(
  117 |   request: typeof test.requestFixture,
  118 |   token: string,
  119 |   deviceId: number,
  120 |   macType: 'Ethernet' | 'WiFi' | 'Bluetooth' | 'Other',
  121 |   macAddress: string,
  122 | ): Promise<MacAddress> {
  123 |   const response = await request.post(`${API_BASE}/devices/${deviceId}/mac`, {
  124 |     headers: { Authorization: `Bearer ${token}` },
  125 |     data: { macType, macAddress },
  126 |   });
  127 | 
> 128 |   expect(response.status()).toBe(201);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  129 |   const body = await response.json();
  130 |   const mac: MacAddress = body.data;
  131 |   console.log(`[MAC ADD] Added ${macType} MAC (${macAddress}) to device ${deviceId}`);
  132 |   return mac;
  133 | }
  134 | 
  135 | // Test helper: Get device by ID
  136 | async function getDevice(
  137 |   request: typeof test.requestFixture,
  138 |   token: string,
  139 |   deviceId: number,
  140 | ): Promise<Device> {
  141 |   const response = await request.get(`${API_BASE}/devices/${deviceId}`, {
  142 |     headers: { Authorization: `Bearer ${token}` },
  143 |   });
  144 | 
  145 |   expect(response.status()).toBe(200);
  146 |   const body = await response.json();
  147 |   return body.data;
  148 | }
  149 | 
  150 | // Test helper: Delete a device
  151 | async function deleteDevice(
  152 |   request: typeof test.requestFixture,
  153 |   token: string,
  154 |   deviceId: number,
  155 | ): Promise<void> {
  156 |   const response = await request.delete(`${API_BASE}/devices/${deviceId}`, {
  157 |     headers: { Authorization: `Bearer ${token}` },
  158 |   });
  159 | 
  160 |   expect(response.status()).toBe(204);
  161 |   console.log(`[DEVICE DELETE] Device ${deviceId} deleted`);
  162 | }
  163 | 
  164 | // Test helper: Update MAC address
  165 | async function updateMac(
  166 |   request: typeof test.requestFixture,
  167 |   token: string,
  168 |   deviceId: number,
  169 |   macId: number,
  170 |   updates: Partial<{ macType: string; macAddress: string }>,
  171 | ): Promise<MacAddress> {
  172 |   const response = await request.put(`${API_BASE}/devices/${deviceId}/mac/${macId}`, {
  173 |     headers: { Authorization: `Bearer ${token}` },
  174 |     data: updates,
  175 |   });
  176 | 
  177 |   expect(response.status()).toBe(200);
  178 |   const body = await response.json();
  179 |   console.log(`[MAC UPDATE] MAC ${macId} updated on device ${deviceId}`);
  180 |   return body.data;
  181 | }
  182 | 
  183 | // Test helper: Delete MAC from device
  184 | async function deleteMac(
  185 |   request: typeof test.requestFixture,
  186 |   token: string,
  187 |   deviceId: number,
  188 |   macId: number,
  189 | ): Promise<void> {
  190 |   const response = await request.delete(`${API_BASE}/devices/${deviceId}/mac/${macId}`, {
  191 |     headers: { Authorization: `Bearer ${token}` },
  192 |   });
  193 | 
  194 |   expect(response.status()).toBe(204);
  195 |   console.log(`[MAC DELETE] MAC ${macId} deleted from device ${deviceId}`);
  196 | }
  197 | 
  198 | // ============================================================================
  199 | // Test Fixtures (Session Setup)
  200 | // ============================================================================
  201 | 
  202 | test.describe.configure({ mode: 'serial' }); // Run tests sequentially for API state consistency
  203 | 
  204 | let authToken: string; // Shared token across tests
  205 | let testDeviceId: number; // Shared device ID
  206 | 
  207 | test.beforeAll(async ({ request }) => {
  208 |   authToken = await loginAndGetToken(request, TEST_USERS.itSupport.email, TEST_USERS.itSupport.password);
  209 |   console.log('[SETUP] Authentication token captured');
  210 | });
  211 | 
  212 | // ============================================================================
  213 | // Test Group 1: MAC Address Creation (Tests 1.1 - 1.4)
  214 | // ============================================================================
  215 | 
  216 | test.describe('1. MAC Address Creation', () => {
  217 |   let device1: Device;
  218 | 
  219 |   test('1.1: Create device and add WiFi MAC', async ({ request }) => {
  220 |     device1 = await createDevice(request, authToken);
  221 | 
  222 |     const mac = await addMacToDevice(request, authToken, device1.id, 'WiFi', 'AA:BB:CC:DD:EE:FF');
  223 | 
  224 |     expect(mac.id).toBeTruthy();
  225 |     expect(mac.deviceId).toBe(device1.id);
  226 |     expect(mac.macType).toBe('WiFi');
  227 |     expect(mac.macAddress).toBe('AA:BB:CC:DD:EE:FF');
  228 |     expect(mac.createdAt).toBeTruthy();
```