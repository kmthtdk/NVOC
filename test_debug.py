#!/usr/bin/env python3
"""Debug script to see page structure"""
import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("[1] Navigating to admin simulation...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("[2] Taking initial screenshot...")
            await page.screenshot(path='debug_01_initial.png', full_page=True)

            print("[3] Selecting Admin role...")
            admin_btn = page.locator('button:has-text("Admin")').first
            if await admin_btn.count() > 0:
                await admin_btn.click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(2000)

                print("[4] Admin selected, taking screenshot...")
                await page.screenshot(path='debug_02_admin_selected.png', full_page=True)

                # Get all button texts
                buttons = await page.locator('button').all()
                print(f"[5] Total buttons on page: {len(buttons)}")

                button_texts = []
                for btn in buttons:
                    try:
                        text = await btn.text_content()
                        if text and len(text) < 100:
                            button_texts.append(text.strip())
                    except:
                        pass

                print("[6] Button texts:")
                for i, text in enumerate(button_texts[:20]):
                    print(f"      {i}: '{text}'")

                # Get page HTML around buttons
                print("\n[7] Page content check...")
                page_html = await page.content()
                if 'Device Inventory' in page_html:
                    print("    ✓ 'Device Inventory' text found in HTML")
                else:
                    print("    ✗ 'Device Inventory' NOT found in HTML")

                if 'device' in page_html.lower():
                    print("    ✓ 'device' (lowercase) found in HTML")

                # Try direct locator
                print("\n[8] Direct locator tests...")
                inventory_button = page.locator('button').filter(has_text='Device Inventory')
                inv_count = await inventory_button.count()
                print(f"    Device Inventory button count: {inv_count}")

                # Try with regex
                inventory_button2 = page.locator('button:has-text("Device Inventory")')
                inv_count2 = await inventory_button2.count()
                print(f"    Device Inventory :has-text count: {inv_count2}")

                # Try searching for any button with 'inventory'
                any_inventory = page.locator('button:has-text("Inventory")')
                inv_count3 = await any_inventory.count()
                print(f"    Any button with 'Inventory': {inv_count3}")

            else:
                print("[!] Admin button not found")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(debug())
