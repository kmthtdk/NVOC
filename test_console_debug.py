#!/usr/bin/env python3
"""Check browser console and network errors"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        console_logs = []
        def log_console(msg):
            console_logs.append(f"{msg.type}: {msg.text}")

        page.on("console", log_console)

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

            print("\nConsole logs:")
            for log in console_logs:
                print(f"  {log}")

            # Check for errors
            if any('error' in log.lower() for log in console_logs):
                print("\n[ERROR] Errors found in console")
            else:
                print("\n[OK] No errors in console")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

asyncio.run(test())
