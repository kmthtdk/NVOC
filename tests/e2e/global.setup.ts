// ============================================================================
// Global setup — authenticates Admin and Requester roles once, persists
// browser storage state so individual test files skip the login UI.
// ============================================================================

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_AUTH_FILE = path.join(__dirname, '.auth/admin.json');
const REQUESTER_AUTH_FILE = path.join(__dirname, '.auth/requester.json');
// The IT leader is step 2 of the seeded approval chain. Without his token a
// hardware request can never leave 'pending_approval', so nothing downstream —
// waiting, resolved, the device workflow — can be tested at all.
const IT_LEADER_AUTH_FILE = path.join(__dirname, '.auth/it-leader.json');

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Shared login helper — fills the sign-in form and waits until the app
// transitions away from the login gate (the IT Admin button or the portal
// header appears).
async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(BASE);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for something that exists ONLY once you are through the gate.
  //
  // This used to wait for "N-VOC SYSTEM" — which is the wordmark on the LOGIN
  // PAGE ITSELF. So the setup passed even when the login had failed, and every
  // spec then ran against a storageState containing no token at all. A failed
  // sign-in reported success; that is how two whole runs died on 429s downstream
  // instead of failing here, where the actual problem was.
  await expect(page.getByRole('button', { name: /^Search tickets/ })).toBeVisible({
    timeout: 15_000,
  });

  // And prove the token really landed, rather than trusting the DOM.
  const token = await page.evaluate(() => localStorage.getItem('nvoc_token'));
  expect(token, `signed in as ${email} but no nvoc_token was stored`).toBeTruthy();
}

// ----- Admin / IT Support -----
setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, 'admin@company.com', 'Passw0rd!');
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

// ----- Requester (employee) -----
setup('authenticate as requester', async ({ page }) => {
  await loginAs(page, 'alex.mercer@company.com', 'Passw0rd!');
  await page.context().storageState({ path: REQUESTER_AUTH_FILE });
});

// ----- IT leader (step 2 of the approval chain) -----
setup('authenticate as IT leader', async ({ page }) => {
  await loginAs(page, 'marcus.vance@company.com', 'Passw0rd!');
  await page.context().storageState({ path: IT_LEADER_AUTH_FILE });
});
