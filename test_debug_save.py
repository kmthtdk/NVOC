#!/usr/bin/env python3
"""Debug device save - check for error messages"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        # Enable console message logging
        def log_console(msg):
            print(f"[CONSOLE] {msg.text}")

        page.on("console", log_console)

        try:
            print("Setting up...")
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
            await page.wait_for_timeout(1000)

            print("\nOpening form and filling data...")
            await page.locator('button:has-text("Add Device")').first.click()
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(500)

            await page.fill('input[name="name"]', 'Debug Test Device')
            await page.fill('input[name="serial_number"]', 'DEBUG-001')

            print("Submitting form...")
            submit_buttons = await page.locator('button:has-text("Add Device"), button:has-text("Update Device")').all()
            if len(submit_buttons) > 1:
                await submit_buttons[-1].click()
                print("Waiting for response...")
                await page.wait_for_timeout(3000)

                # Check for alert
                try:
                    alert_text = await page.evaluate("window.lastAlert")
                    print(f"[ALERT] {alert_text}")
                except:
                    pass

                # Check page text for any error messages
                page_text = await page.content()
                if 'Error' in page_text or 'error' in page_text:
                    print("[ERROR] Error text found in page")

                # Take screenshot
                await page.screenshot(path='debug_save_result.png', full_page=True)
                print("Screenshot saved: debug_save_result.png")
            else:
                print("Could not find submit button")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
