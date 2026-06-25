#!/usr/bin/env python3
"""Quick test to verify MAC address section is visible"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("Loading admin page...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("Logging in as Admin...")
            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            print("Entering Admin Workspace...")
            all_buttons = await page.locator('button').all()
            if len(all_buttons) > 1:
                await all_buttons[1].click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)

            print("Navigating to Device Inventory...")
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Opening Add Device form...")
            await page.locator('button:has-text("Add Device")').first.click()
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(1000)

            print("\nChecking for MAC address section...")
            # Check if MAC address label exists
            mac_section = await page.locator('text="MAC Addresses"').count()
            print(f"MAC Addresses section found: {mac_section > 0}")

            # Check for MAC address inputs
            mac_type_select = await page.locator('select').all()
            mac_input = await page.locator('input[placeholder*="00:1A"]').count()
            add_mac_button = await page.locator('button:has-text("Add MAC")').count()

            print(f"MAC Type dropdowns found: {len(mac_type_select) > 0}")
            print(f"MAC Address input found: {mac_input > 0}")
            print(f"Add MAC button found: {add_mac_button > 0}")

            if mac_section > 0 and mac_input > 0:
                print("\n[SUCCESS] MAC Address section is fully visible!")
            else:
                print("\n[WARN] MAC Address section may be partially visible")

            # Take screenshot
            print("Taking screenshot...")
            await page.screenshot(path='mac_section_screenshot.png', full_page=True)
            print("Screenshot saved: mac_section_screenshot.png")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
