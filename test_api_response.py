#!/usr/bin/env python3
"""Check API response structure"""
import asyncio
import json
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        api_response_text = None
        def on_response(response):
            nonlocal api_response_text
            if '/api/devices' in response.url and '?pageSize' in response.url:
                # Schedule getting the text asynchronously
                async def get_text():
                    nonlocal api_response_text
                    api_response_text = await response.text()
                asyncio.create_task(get_text())

        page.on("response", on_response)

        try:
            print("Loading page and waiting for API response...")
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
            await page.wait_for_timeout(2000)

            if api_response_text:
                data = json.loads(api_response_text)
                if data.get('data') and len(data['data']) > 0:
                    first_device = data['data'][0]
                    print("\nFirst device from API:")
                    print(json.dumps(first_device, indent=2)[:500])
                    print("\nDevice keys:", list(first_device.keys()))
            else:
                print("No API response captured yet, trying to manually call API...")
                # Use page.evaluate to call the API
                token = "test_token"
                result = await page.evaluate("""
                    async () => {
                        const response = await fetch('/api/devices?pageSize=100', {
                            headers: { 'Content-Type': 'application/json' }
                        });
                        const data = await response.json();
                        return data;
                    }
                """)
                if result and result.get('data'):
                    first = result['data'][0]
                    print("\nFirst device:")
                    print(json.dumps(first, indent=2)[:500])
                    print("\nDevice keys:", list(first.keys()))

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

asyncio.run(test())
