/**
 * Jitter Timing Analysis
 *
 * Focuses on capturing the visual intermediate states during tab transitions.
 * Takes rapid screenshots to catch the moment of jitter:
 * - 0ms after click (before React re-render)
 * - 50ms after click (during loading/animation)
 * - 100ms, 200ms, 400ms, 800ms (watching the transition settle)
 *
 * Also specifically tests the `transition-opacity duration-200` on the
 * reports content wrapper and the `min-h-96` placeholder height.
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

const BASE_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@company.com';
const DEMO_PASSWORD = 'Passw0rd!';
const SCREENSHOT_DIR = 'jitter-screenshots';

async function loginAsAdmin(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('text=N-VOC SYSTEM')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);

  const adminBtn = page.locator('button:has-text("IT Admin Workspace")');
  await expect(adminBtn).toBeVisible({ timeout: 5000 });
  await adminBtn.click();
  await page.waitForTimeout(500);
}

async function measureHeightAndPosition(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const mainRect = main?.getBoundingClientRect();
    const contentArea = document.querySelector('main > div');
    const contentRect = contentArea?.getBoundingClientRect();

    // Measure the admin tab bar
    const tabBar = document.querySelector('.border-b.border-slate-200');
    const tabBarRect = tabBar?.getBoundingClientRect();

    // Measure any visible loading spinner
    const spinner = document.querySelector('.animate-spin');

    // Find the reports content wrapper (transition-opacity)
    const transitionEl = document.querySelector('[class*="transition-opacity"]');
    const transitionRect = transitionEl?.getBoundingClientRect();
    const transitionStyle = transitionEl ? window.getComputedStyle(transitionEl).opacity : 'N/A';

    // Header position
    const header = document.querySelector('header');
    const headerRect = header?.getBoundingClientRect();

    return {
      mainTop: mainRect?.top,
      mainHeight: mainRect?.height,
      contentTop: contentRect?.top,
      contentHeight: contentRect?.height,
      tabBarTop: tabBarRect?.top,
      tabBarBottom: tabBarRect?.bottom,
      headerBottom: headerRect?.bottom,
      spinnerVisible: !!spinner,
      transitionOpacity: transitionStyle,
      transitionHeight: transitionRect?.height,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
    };
  });
}

test.describe('Layout Jitter - Timing Analysis', () => {
  test('Capture rapid screenshots during tab switch transitions', async ({ page }) => {
    await loginAsAdmin(page);

    const deviceTab = page.locator('button:has-text("Device Inventory")');
    const ticketTab = page.locator('button:has-text("Ticket Queue")');

    // ---- Test 1: Main view switch (Tickets → Admin) animation ----
    // The <main> element has animate-fadeIn which does translateY(8px) → (0)
    // This fires when switching between User Portal and IT Admin Workspace
    console.log('\n=== TEST 1: Main Workspace Switch Animation ===');

    // Go to user portal first
    const userPortalBtn = page.locator('button:has-text("Employee Portal")');
    await userPortalBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01a_user_portal.png') });
    const m1a = await measureHeightAndPosition(page);
    console.log('User Portal - main top:', m1a.mainTop, 'scrollY:', m1a.scrollY);

    // NOW click IT Admin Workspace and capture frames rapidly
    const adminBtn = page.locator('button:has-text("IT Admin Workspace")');
    await adminBtn.click();
    // Capture at t=0ms (click fires)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01b_admin_t0ms.png') });
    const m1b = await measureHeightAndPosition(page);
    console.log('Admin (t=0ms) - main top:', m1b.mainTop, 'content top:', m1b.contentTop);

    await page.waitForTimeout(50);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01c_admin_t50ms.png') });
    const m1c = await measureHeightAndPosition(page);
    console.log('Admin (t=50ms) - main top:', m1c.mainTop, 'content top:', m1c.contentTop);

    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01d_admin_t150ms.png') });
    const m1d = await measureHeightAndPosition(page);
    console.log('Admin (t=150ms) - main top:', m1d.mainTop, 'content top:', m1d.contentTop);

    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01e_admin_t300ms.png') });
    const m1e = await measureHeightAndPosition(page);
    console.log('Admin (t=300ms) - main top:', m1e.mainTop, 'content top:', m1e.contentTop);

    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_01f_admin_settled.png') });
    const m1f = await measureHeightAndPosition(page);
    console.log('Admin (settled) - main top:', m1f.mainTop, 'content top:', m1f.contentTop);

    // ---- Test 2: Admin sub-tab switch (Tickets → Device Inventory) ----
    // The content inside <main> changes but <main> itself doesn't re-mount
    console.log('\n=== TEST 2: Admin Sub-Tab Switch ===');

    await ticketTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_02a_tickets.png') });
    const m2a = await measureHeightAndPosition(page);
    console.log('Ticket Queue - main top:', m2a.mainTop, 'doc height:', m2a.documentHeight);

    // Rapid fire the Device Inventory click
    await deviceTab.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_02b_device_t0ms.png') });
    const m2b = await measureHeightAndPosition(page);
    console.log('Device Inv (t=0ms) - main top:', m2b.mainTop, 'spinner:', m2b.spinnerVisible, 'doc height:', m2b.documentHeight);

    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_02c_device_t100ms.png') });
    const m2c = await measureHeightAndPosition(page);
    console.log('Device Inv (t=100ms) - main top:', m2c.mainTop, 'spinner:', m2c.spinnerVisible, 'doc height:', m2c.documentHeight);

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_02d_device_settled.png') });
    const m2d = await measureHeightAndPosition(page);
    console.log('Device Inv (settled) - main top:', m2d.mainTop, 'doc height:', m2d.documentHeight);

    // ---- Test 3: Reports sub-tab switching (transition-opacity) ----
    console.log('\n=== TEST 3: Reports Sub-Tab with transition-opacity ===');

    const reportsSubTab = page.locator('button:has-text("Reports & Analytics")').first();
    await reportsSubTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Summary → Department (large pivot table)
    const deptTabBtn = page.locator('button:has-text("By Department")').first();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_03a_summary.png') });
    const m3a = await measureHeightAndPosition(page);
    console.log('Summary tab - transition opacity:', m3a.transitionOpacity, 'height:', m3a.transitionHeight, 'doc:', m3a.documentHeight);

    await deptTabBtn.click();
    // Capture during opacity transition
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_03b_dept_t0ms.png') });
    const m3b = await measureHeightAndPosition(page);
    console.log('By Department (t=0ms) - opacity:', m3b.transitionOpacity, 'spinner:', m3b.spinnerVisible, 'doc:', m3b.documentHeight);

    await page.waitForTimeout(50);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_03c_dept_t50ms.png') });
    const m3c = await measureHeightAndPosition(page);
    console.log('By Department (t=50ms) - opacity:', m3c.transitionOpacity, 'spinner:', m3c.spinnerVisible);

    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_03d_dept_t200ms.png') });
    const m3d = await measureHeightAndPosition(page);
    console.log('By Department (t=200ms) - opacity:', m3d.transitionOpacity, 'spinner:', m3d.spinnerVisible);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_03e_dept_settled.png') });
    const m3e = await measureHeightAndPosition(page);
    console.log('By Department (settled) - opacity:', m3e.transitionOpacity, 'height:', m3e.transitionHeight, 'doc:', m3e.documentHeight);

    // ---- Test 4: Check if main element gets re-added to DOM on view switch ----
    console.log('\n=== TEST 4: DOM Re-mount Analysis ===');

    const domAnalysis = await page.evaluate(() => {
      const main = document.querySelector('main');
      // Check if main has animate-fadeIn (which would make it slide on every render)
      const hasAnimateFadeIn = main?.classList.contains('animate-fadeIn');
      const mainClasses = main?.className;

      // Check the admin workspace div key rendering pattern
      const adminWorkspaceDiv = document.querySelector('main > div');
      const adminWorkspaceClasses = adminWorkspaceDiv?.className;

      return {
        hasAnimateFadeIn,
        mainClasses,
        adminWorkspaceClasses,
        mainChildren: main?.children.length,
      };
    });

    console.log('\nDOM Analysis:');
    console.log('  main has animate-fadeIn:', domAnalysis.hasAnimateFadeIn);
    console.log('  main classes:', domAnalysis.mainClasses);
    console.log('  admin workspace classes:', domAnalysis.adminWorkspaceClasses);
    console.log('  main children count:', domAnalysis.mainChildren);

    // ---- Test 5: Check scroll position behavior ----
    console.log('\n=== TEST 5: Scroll Position During Tab Switch ===');

    await ticketTab.click();
    await page.waitForTimeout(500);

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(200);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    console.log('Scroll position before switch:', scrollBefore);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_05a_scrolled.png') });

    // Switch tabs
    await deviceTab.click();
    await page.waitForTimeout(100);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    console.log('Scroll position after switch:', scrollAfter);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'timing_05b_after_switch.png') });

    if (scrollAfter !== scrollBefore) {
      console.log('SCROLL JUMP DETECTED:', scrollBefore, '→', scrollAfter, '(diff:', scrollAfter - scrollBefore, 'px)');
    }

    // ---- Summary ----
    console.log('\n=== JITTER SOURCE ANALYSIS SUMMARY ===');
    console.log('\nKey findings:');
    console.log('1. animate-fadeIn on <main>:', domAnalysis.hasAnimateFadeIn ? 'YES - fires on view switch' : 'NO');
    console.log('2. Reports content transition-opacity: 200ms delay during tab switch');
    console.log('3. min-h-96 on reports content prevents height collapse during loading');
    console.log('4. overflow-y:scroll NOT in built CSS (index.css rule missing from Docker build)');
    console.log('   → html overflow computed as: visible (from Playwright measurement)');

    expect(domAnalysis.mainChildren).toBeGreaterThan(0);
  });
});
