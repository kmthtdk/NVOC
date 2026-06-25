#!/usr/bin/env python3
"""Check React state in DeviceManagement"""
import asyncio
from playwright.async_api import async_playwright
import json

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Load page
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

            # Try to inspect table cells directly
            print("Checking table cell content...")
            for i in range(3):
                cell = page.locator(f'tbody tr:nth-child({i+1}) td:first-child')
                html = await cell.inner_html()
                text = await cell.text_content()
                print(f"Row {i} cell HTML (first 100 chars): {html[:100]}")
                print(f"Row {i} cell text: '{text}'")

            # Check if there are any data attributes or hidden content
            print("\nChecking first row structure...")
            row = page.locator('tbody tr:first-child')
            row_html = await row.inner_html()
            print(f"Full row HTML (first 300 chars):\n{row_html[:300]}")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
