#!/usr/bin/env python3
"""Test that the GET /api/devices endpoint works after the specs_json fix"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("[1] Loading admin portal...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("[2] Authenticating as Admin...")
            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            print("[3] Entering Admin Workspace...")
            all_buttons = await page.locator('button').all()
            await all_buttons[1].click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("[4] Navigating to Device Inventory...")
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            # Check if devices loaded
            page_content = await page.content()
            if 'ITA-2026' in page_content:
                print("[SUCCESS] Device inventory loaded successfully!")
                print("  [OK] GET /api/devices endpoint is working")
                print("  [OK] Device list populated with demo devices")
                await page.screenshot(path='devices_loaded.png', full_page=True)
            else:
                print("[FAIL] Device inventory is empty")
                await page.screenshot(path='devices_failed.png', full_page=True)

        except Exception as e:
            print(f"[ERROR] {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
