#!/usr/bin/env python3
"""Show complete form with MAC and specs sections"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("Setting up...")
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

            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Opening form...")
            await page.locator('button:has-text("Add Device")').first.click()
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(1000)

            print("Taking full page screenshot...")
            await page.screenshot(path='form_complete.png', full_page=True)
            print("Complete screenshot saved!")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            await page.wait_for_timeout(1000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
