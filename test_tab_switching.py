#!/usr/bin/env python3
"""Test if tab switching actually works"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("1. Loading admin page...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("\n2. Authenticating...")
            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            all_buttons = await page.locator('button').all()
            await all_buttons[1].click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            # Now check if Device Inventory button is visible
            if await page.locator('button:has-text("Device Inventory")').first.is_visible():
                print("   [OK] Device Inventory button is visible after auth")
            else:
                print("   [NO] Device Inventory button not visible after auth")
                # List all visible buttons
                buttons = await page.locator('button').all()
                print(f"   Total buttons on page: {len(buttons)}")
                return

            print("\n3. Clicking Device Inventory button...")
            device_btn = page.locator('button:has-text("Device Inventory")').first
            if await device_btn.is_visible():
                print("   Device Inventory button visible, clicking...")
                await device_btn.click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(2000)
            else:
                print("   Button not visible!")
                return

            print("\n4. Checking if page content changed...")

            # Check for admin section class names that indicate the tab
            content = await page.content()

            # Check for various indicators
            if 'Add Device' in content:
                print("   [OK] 'Add Device' button found (DeviceManagement feature)")
            else:
                print("   [NO] 'Add Device' button not found")

            if 'Search by serial number' in content:
                print("   [OK] 'Search by serial number' found (DeviceManagement feature)")
            else:
                print("   [NO] 'Search by serial number' not found")

            if 'Showing' in content and 'devices' in content:
                print("   [OK] Device count text found")
            else:
                print("   [NO] Device count text not found")

            # Check what heading is visible
            h1 = await page.locator('h1').first
            h1_text = await h1.text_content() if h1 else "No h1"
            print(f"\n   Main heading: {h1_text}")

            # Take a screenshot
            await page.screenshot(path='tab_switch_result.png', full_page=True)
            print("\n5. Screenshot saved: tab_switch_result.png")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
