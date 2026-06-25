#!/usr/bin/env python3
"""Debug button details after signin"""
import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("[1] Navigating and signing in...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            admin_btn = page.locator('button:has-text("Admin")').first
            await admin_btn.click()
            await page.wait_for_timeout(500)

            signin_btn = page.locator('button:has-text("Sign in")').first
            await signin_btn.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            print("[2] Taking full page screenshot...")
            await page.screenshot(path='debug3_after_signin_full.png', full_page=True)

            print("[3] Getting all buttons with detailed info...")
            buttons = await page.locator('button').all()
            print(f"    Total buttons: {len(buttons)}")

            for i, btn in enumerate(buttons):
                try:
                    text = await btn.text_content()
                    is_visible = await btn.is_visible()
                    # Get the button's parent to understand context
                    classes = await btn.get_attribute('class')
                    print(f"      Button {i}:")
                    print(f"        Text: '{text}'")
                    print(f"        Visible: {is_visible}")
                    print(f"        Classes: {classes[:100] if classes else 'none'}")
                except Exception as e:
                    print(f"      Button {i}: Error - {e}")

            # Try to find buttons by looking for Shield icon (should be admin button)
            print("\n[4] Looking for Shield icon (admin button)...")
            shield_elems = await page.locator('[class*="Shield"]').all()
            print(f"    Found {len(shield_elems)} elements with 'Shield' in class")

            # Try finding by looking at all divs with button-like styling
            print("\n[5] Checking header structure...")
            header = page.locator('header, [class*="header"], [class*="Header"]').first
            if await header.count() > 0:
                header_html = await header.inner_html()
                print(f"    Header HTML length: {len(header_html)}")
                if 'Workspace' in header_html or 'workspace' in header_html:
                    print("    'Workspace' found in header!")
                else:
                    print("    'Workspace' NOT found in header")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(debug())
