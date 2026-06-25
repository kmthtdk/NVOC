#!/usr/bin/env python3
"""Check what component is actually on the page"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("Loading...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            all_buttons = await page.locator('button').all()
            await all_buttons[1].click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Clicking Device Inventory...")
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            # Get the page source
            content = await page.content()

            # Check what's on the page
            if 'DeviceManagement' in content:
                print("[OK] DeviceManagement component text found in page")
            else:
                print("[NO] DeviceManagement component not in page source")

            if 'Showing' in content and 'of' in content and 'devices' in content:
                print("[OK] Device table text found")
            else:
                print("[NO] Device table not found")

            # Look for the API call
            if '/api/devices' in content:
                print("[OK] API endpoint reference found")
            else:
                print("[NO] API endpoint reference not found")

            # Check for React errors
            if 'error' in content.lower() and ('react' in content.lower() or 'uncaught' in content.lower()):
                print("[WARN] Possible React error in page")

            # Look for the actual content
            if 'Device Inventory' in content:
                idx = content.find('Device Inventory')
                print(f"\nContent around 'Device Inventory' (chars {idx} to {idx+200}):")
                print(content[max(0, idx-100):idx+300])

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
