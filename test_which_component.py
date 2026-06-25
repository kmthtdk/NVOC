#!/usr/bin/env python3
"""Determine which component is rendering the table"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Quick auth and navigation
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

            # Get the full HTML of the table
            table = page.locator('table').first
            table_html = await table.inner_html()

            # Look for clues about what component it is
            if 'Add Device' in table_html:
                print("[DeviceManagement] Found 'Add Device' in table HTML")
            if 'Latitude' in table_html or 'ThinkPad' in table_html:
                print("[DeviceManagement] Found device names in table")
            if 'ITA-2026' in table_html:
                print("[DeviceManagement] Found device codes in table")

            # Check the first row structure
            first_row_html = table_html[table_html.find('<tbody'):table_html.find('</tbody>')+8]
            print("\nFirst row structure (first 500 chars):")
            print(first_row_html[:500])

            # Count empty <p> tags and non-empty <p> tags
            empty_p = table_html.count('<p class="font-medium text-gray-900 dark:text-white"></p>')
            print(f"\nEmpty <p> tags with class 'font-medium': {empty_p}")

            # Check what class names are on the table
            table_tag = await page.locator('table').first.evaluate('el => el.outerHTML')
            if 'Device Inventory' in table_tag or 'device' in table_tag.lower():
                print("\n[YES] Table appears to be from DeviceManagement component")
            else:
                print("\n[MAYBE] Table source unclear")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
