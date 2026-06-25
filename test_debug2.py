#!/usr/bin/env python3
"""Debug what's on the page after signin"""
import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("[1] Navigating...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("[2] Clicking Admin...")
            admin_btn = page.locator('button:has-text("Admin")').first
            await admin_btn.click()
            await page.wait_for_timeout(500)

            print("[3] Clicking Sign in...")
            signin_btn = page.locator('button:has-text("Sign in")').first
            await signin_btn.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            print("[4] Taking screenshot...")
            await page.screenshot(path='debug_after_signin.png', full_page=True)

            print("[5] Checking current URL...")
            url = page.url
            print(f"    Current URL: {url}")

            print("[6] Listing all buttons on the page...")
            buttons = await page.locator('button').all()
            print(f"    Total buttons: {len(buttons)}")

            for i, btn in enumerate(buttons):
                try:
                    text = await btn.text_content()
                    if text:
                        print(f"      {i}: '{text.strip()}'")
                except:
                    pass

            print("[7] Checking for h1, h2 headings...")
            h1s = await page.locator('h1, h2').all()
            for h in h1s:
                try:
                    text = await h.text_content()
                    print(f"    Heading: {text.strip()}")
                except:
                    pass

            print("[8] Getting page HTML snippet around 'Device' or 'Inventory'...")
            html = await page.content()
            if 'Device Inventory' in html:
                print("    'Device Inventory' found in HTML!")
            elif 'device' in html.lower():
                print("    'device' (lowercase) found in HTML")
            else:
                print("    'device' not found in HTML")

            # Try finding the admin buttons more specifically
            print("\n[9] Looking for admin navigation buttons...")
            # The structure should have buttons with "Ticket Queue" and "Device Inventory"
            nav_buttons = page.locator('button:has-text("Ticket Queue"), button:has-text("Device Inventory"), button:has-text("IT Admin")')
            nav_count = await nav_buttons.count()
            print(f"    Found {nav_count} navigation buttons")

            # Check if we're in admin view by looking for the terminal icon
            terminal_btn = page.locator('[class*="Terminal"]')
            term_count = await terminal_btn.count()
            print(f"    Terminal icons found: {term_count}")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(debug())
