#!/usr/bin/env python3
"""Check actual table content"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("Loading admin page...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("Authenticating...")
            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            all_buttons = await page.locator('button').all()
            await all_buttons[1].click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Opening Device Inventory...")
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            # Get table rows
            rows = await page.locator('tbody tr').all()
            print(f"\nFound {len(rows)} device rows")

            for i, row in enumerate(rows[:3]):
                cells = await row.locator('td').all()
                cell_texts = []
                for cell in cells[:4]:
                    text = await cell.text_content()
                    cell_texts.append(text.strip() if text else '[empty]')
                print(f"Row {i}: {cell_texts}")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
