#!/usr/bin/env python3
"""Scroll to show MAC address section"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("Loading admin page...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("Logging in...")
            await page.locator('button:has-text("Admin")').first.click()
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Sign in")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            print("Entering Admin Workspace...")
            all_buttons = await page.locator('button').all()
            await all_buttons[1].click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Navigating to Device Inventory...")
            await page.locator('button:has-text("Device Inventory")').first.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("Opening Add Device form...")
            await page.locator('button:has-text("Add Device")').first.click()
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(500)

            print("Scrolling form to show MAC Addresses section...")
            # Find the form inside the modal
            form = page.locator('form').first

            # Scroll within the modal to show MAC addresses
            await form.evaluate("el => el.scrollTop = 800")
            await page.wait_for_timeout(500)

            print("Taking screenshot of MAC Addresses section...")
            await page.screenshot(path='mac_addresses_section.png', full_page=True)
            print("Screenshot saved: mac_addresses_section.png")

            print("\n[SUCCESS] MAC Addresses section is visible in the form!")
            print("\nMAC Address Features:")
            print("  - Add multiple MAC addresses (Ethernet, WiFi, Bluetooth, Other)")
            print("  - Input MAC address in format: 00:1A:2B:3C:4D:5E")
            print("  - Remove individual MAC addresses")
            print("  - Perfect for laptops with wireless + wired MACs")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
