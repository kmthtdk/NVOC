/**
 * Layout Jitter Diagnosis Test
 *
 * Identifies the root cause of persistent layout shifting when switching tabs
 * in the N-VOC System application. Measures clientWidth vs innerWidth to
 * detect scrollbar appearance/disappearance as the primary suspect.
 *
 * Key diagnostic metric:
 *   document.documentElement.clientWidth  — shrinks when scrollbar appears
 *   window.innerWidth                     — constant (viewport width)
 *   The DIFFERENCE between them = scrollbar width (0 = hidden, ~15-17 = visible)
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

const BASE_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@company.com';
const DEMO_PASSWORD = 'Passw0rd!';
const SCREENSHOT_DIR = 'jitter-screenshots';

interface LayoutMetrics {
  clientWidth: number;
  innerWidth: number;
  scrollbarWidth: number;
  scrollHeight: number;
  viewportHeight: number;
  hasScrollbar: boolean;
  htmlOverflow: string;
  bodyOverflow: string;
  rootDivOverflow: string;
  scrollbarGutter: string;
}

async function captureMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const rootDiv = document.querySelector('#root > div') as HTMLElement | null;
    const computed = (el: Element | null, prop: string) =>
      el ? window.getComputedStyle(el).getPropertyValue(prop) : 'N/A';

    return {
      clientWidth: html.clientWidth,
      innerWidth: window.innerWidth,
      scrollbarWidth: window.innerWidth - html.clientWidth,
      scrollHeight: html.scrollHeight,
      viewportHeight: window.innerHeight,
      hasScrollbar: html.scrollHeight > window.innerHeight,
      htmlOverflow: computed(html, 'overflow'),
      bodyOverflow: computed(body, 'overflow'),
      rootDivOverflow: computed(rootDiv, 'overflow'),
      scrollbarGutter: computed(html, 'scrollbar-gutter'),
    };
  });
}

async function screenshotWithMetrics(
  page: Page,
  name: string,
  description: string,
): Promise<LayoutMetrics> {
  const metrics = await captureMetrics(page);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `jitter_${name}.png`),
    fullPage: false,
  });

  console.log(`\n--- ${description} ---`);
  console.log(`  clientWidth:   ${metrics.clientWidth}px`);
  console.log(`  innerWidth:    ${metrics.innerWidth}px`);
  console.log(`  scrollbarWidth:${metrics.scrollbarWidth}px  ← key metric`);
  console.log(`  hasScrollbar:  ${metrics.hasScrollbar}  (scrollH=${metrics.scrollHeight}, vh=${metrics.viewportHeight})`);
  console.log(`  html overflow: ${metrics.htmlOverflow}`);
  console.log(`  body overflow: ${metrics.bodyOverflow}`);
  console.log(`  root overflow: ${metrics.rootDivOverflow}`);
  console.log(`  scrollbar-gutter: ${metrics.scrollbarGutter}`);

  return metrics;
}

test.describe('Layout Jitter Diagnosis', () => {
  test('Phase 1 + 2: Measure scrollbar shift during tab switching', async ({ page }) => {
    const measurements: { label: string; metrics: LayoutMetrics }[] = [];

    // ---- Login ----
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'jitter_00_login.png') });

    // Fill in credentials using the Admin demo account
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Confirm we are authenticated by waiting for the header with N-VOC SYSTEM text
    await expect(page.locator('text=N-VOC SYSTEM')).toBeVisible({ timeout: 10000 });

    // Switch to IT Admin Workspace
    const adminBtn = page.locator('button:has-text("IT Admin Workspace")');
    await expect(adminBtn).toBeVisible({ timeout: 5000 });
    await adminBtn.click();
    await page.waitForTimeout(600);

    // ---- Phase 1: Baseline measurements ----
    console.log('\n========== PHASE 1: BASELINES ==========');

    // 1a. Ticket Queue baseline
    const ticketTab = page.locator('button:has-text("Ticket Queue")');
    await ticketTab.click();
    await page.waitForTimeout(800);

    const m1 = await screenshotWithMetrics(page, '01_ticket_queue', 'Ticket Queue tab (baseline)');
    measurements.push({ label: 'Ticket Queue', metrics: m1 });

    // 1b. Device Inventory > Device Management
    const deviceTab = page.locator('button:has-text("Device Inventory")');
    await deviceTab.click();
    await page.waitForTimeout(800);

    const m2 = await screenshotWithMetrics(page, '02_device_management', 'Device Management tab (baseline)');
    measurements.push({ label: 'Device Management', metrics: m2 });

    // 1c. Reports & Analytics
    const reportsTab = page.locator('button:has-text("Reports & Analytics")');
    await reportsTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const m3 = await screenshotWithMetrics(page, '03_reports_summary', 'Reports & Analytics - Summary tab (baseline)');
    measurements.push({ label: 'Reports Summary', metrics: m3 });

    // ---- Phase 2: Tab Switching Test ----
    console.log('\n========== PHASE 2: TAB SWITCHING SHIFT DETECTION ==========');

    // 2a. Click Ticket Queue and measure
    await ticketTab.click();
    await page.waitForTimeout(600);
    const m4 = await screenshotWithMetrics(page, '04_back_to_tickets', 'Back to Ticket Queue');
    measurements.push({ label: 'Back to Ticket Queue', metrics: m4 });

    // 2b. Switch to Device Inventory
    await deviceTab.click();
    await page.waitForTimeout(600);
    const m5 = await screenshotWithMetrics(page, '05_device_inv_after_tickets', 'Device Inventory after Ticket Queue');
    measurements.push({ label: 'Device Inv after Tickets', metrics: m5 });

    // 2c. Switch back to Ticket Queue
    await ticketTab.click();
    await page.waitForTimeout(600);
    const m6 = await screenshotWithMetrics(page, '06_ticket_queue_again', 'Ticket Queue again');
    measurements.push({ label: 'Ticket Queue (2nd)', metrics: m6 });

    // ---- Phase 2b: Sub-tab switching (Device Inventory) ----
    console.log('\n========== PHASE 2b: SUB-TAB SWITCHING ==========');
    await deviceTab.click();
    await page.waitForTimeout(500);

    const devMgmtBtn = page.locator('button:has-text("Device Management")');
    const reportsBtn = page.locator('button:has-text("Reports & Analytics")');

    for (let i = 0; i < 5; i++) {
      await devMgmtBtn.click();
      await page.waitForTimeout(400);
      const mMgmt = await captureMetrics(page);

      await reportsBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const mReports = await captureMetrics(page);

      const shift = Math.abs(mMgmt.clientWidth - mReports.clientWidth);
      console.log(`  Cycle ${i + 1}: DevMgmt clientW=${mMgmt.clientWidth}, Reports clientW=${mReports.clientWidth}, SHIFT=${shift}px`);
    }

    // ---- Phase 3: Report filter sub-tabs ----
    console.log('\n========== PHASE 3: REPORT FILTER TAB SWITCHING ==========');

    await deviceTab.click();
    await page.waitForTimeout(300);
    await reportsBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    const reportTabs: { name: string; selector: string }[] = [
      { name: 'summary',    selector: 'button:has-text("Summary")' },
      { name: 'assignments', selector: 'button:has-text("Assignments")' },
      { name: 'aging',       selector: 'button:has-text("Aging")' },
      { name: 'department',  selector: 'button:has-text("By Department")' },
      { name: 'availability', selector: 'button:has-text("Availability")' },
    ];

    for (const tab of reportTabs) {
      const btn = page.locator(tab.selector).first();
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) {
        console.log(`  [SKIP] "${tab.name}" tab button not found`);
        continue;
      }
      await btn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      const m = await screenshotWithMetrics(
        page,
        `07_report_${tab.name}`,
        `Report tab: ${tab.name}`,
      );
      measurements.push({ label: `Report: ${tab.name}`, metrics: m });
    }

    // ---- Phase 4: Computed CSS deep-dive on the jitter elements ----
    console.log('\n========== PHASE 4: CSS DEEP-DIVE ==========');

    const cssAudit = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const rootDiv = document.querySelector('#root > div') as HTMLElement | null;
      const main = document.querySelector('main') as HTMLElement | null;
      const header = document.querySelector('header') as HTMLElement | null;

      const props = ['overflow', 'overflow-x', 'overflow-y', 'scrollbar-gutter', 'width', 'min-width', 'max-width'];
      const getProps = (el: Element | null, label: string) => {
        if (!el) return { label, error: 'element not found' };
        const cs = window.getComputedStyle(el);
        const result: Record<string, string> = { label };
        for (const p of props) result[p] = cs.getPropertyValue(p) || 'unset';
        return result;
      };

      return {
        html: getProps(html, '<html>'),
        body: getProps(body, '<body>'),
        rootDiv: getProps(rootDiv, '#root > div'),
        main: getProps(main, '<main>'),
        header: getProps(header, '<header>'),
      };
    });

    console.log('\nComputed CSS for key layout elements:');
    for (const [, el] of Object.entries(cssAudit)) {
      console.log(`\n  ${(el as Record<string, string>).label}:`);
      for (const [prop, val] of Object.entries(el as Record<string, string>)) {
        if (prop !== 'label') console.log(`    ${prop}: ${val}`);
      }
    }

    // ---- Phase 5: Console errors collected during session ----
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // ---- Final Report ----
    console.log('\n========== FINAL LAYOUT SHIFT SUMMARY ==========');
    console.log('\nScrollbar width by tab (clientWidth vs innerWidth delta):');

    let minClientWidth = Infinity;
    let maxClientWidth = 0;
    for (const { label, metrics } of measurements) {
      minClientWidth = Math.min(minClientWidth, metrics.clientWidth);
      maxClientWidth = Math.max(maxClientWidth, metrics.clientWidth);
      const indicator = metrics.scrollbarWidth > 0 ? '  <<< SCROLLBAR VISIBLE' : '';
      console.log(`  ${label.padEnd(30)} clientW=${metrics.clientWidth}  scrollbarW=${metrics.scrollbarWidth}${indicator}`);
    }

    const totalShift = maxClientWidth - minClientWidth;
    console.log(`\nTotal layout shift detected: ${totalShift}px`);
    if (totalShift > 0) {
      console.log('ROOT CAUSE CONFIRMED: Scrollbar appearing/disappearing shifts content');
      console.log('FIX: Add `html { scrollbar-gutter: stable; }` or `html { overflow-y: scroll; }`');
    } else {
      console.log('No width-based layout shift detected. Jitter may be from animation/transition.');
    }

    // The test asserts we captured data — actual diagnosis is in console output + screenshots
    expect(measurements.length).toBeGreaterThan(0);
    // innerWidth must be consistent across all measurements (no viewport resizing)
    const baseInnerWidth = measurements[0].metrics.innerWidth;
    expect(measurements.every(m => m.metrics.innerWidth === baseInnerWidth)).toBe(true);
  });
});
