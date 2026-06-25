#!/usr/bin/env python3
"""Simple check if devices are showing"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            # Quick auth flow
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
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(3000)

            # Check for device data
            rows = await page.locator('tbody tr').all()
            print(f"Found {len(rows)} device rows")

            # Check first few cells
            for i in range(min(3, len(rows))):
                cells = await rows[i].locator('td').all()
                name_cell = await cells[0].text_content()
                serial_cell = await cells[1].text_content()
                status_cell = await cells[3].text_content()
                print(f"Row {i}: Name='{name_cell.strip()[:30]}' Serial='{serial_cell.strip()[:30]}' Status='{status_cell.strip()}'")

            # Check page source for specific strings
            content = await page.content()
            if 'Latitude' in content or 'ThinkPad' in content or 'EliteDesk' in content or 'Generic Device' in content:
                print("\n[OK] Device names found in page content")
            else:
                print("\n[WARN] Device names not found in page content")

            if 'ITA-2026' in content:
                print("[OK] Device codes (ITA-XXXX) found in page content")
            else:
                print("[NO] Device codes not found")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
