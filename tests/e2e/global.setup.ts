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

const BASE = 'http://localhost:3000';

// Shared login helper — fills the sign-in form and waits until the app
// transitions away from the login gate (the IT Admin button or the portal
// header appears).
async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(BASE);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the authenticated shell to appear (header contains N-VOC SYSTEM).
  await expect(page.getByText('N-VOC SYSTEM')).toBeVisible({ timeout: 15_000 });
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
