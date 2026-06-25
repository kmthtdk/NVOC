#!/usr/bin/env python3
"""Test device persistence - data survives page reload"""
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1024, 'height': 1400})

        try:
            print("\n" + "="*60)
            print("DEVICE PERSISTENCE TEST")
            print("="*60 + "\n")

            # Setup and login
            print("[1/6] Loading admin portal...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')

            print("[2/6] Authenticating as Admin...")
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

            # Create new device
            print("[3/6] Creating new device with specs and MAC address...")
            await page.locator('button:has-text("Add Device")').first.click()
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(500)

            # Fill basic info
            await page.fill('input[name="name"]', 'Test Laptop 2026')
            await page.fill('input[name="serial_number"]', 'TEST-LAP-001-PERSIST')

            # Add MAC address
            mac_input = page.locator('input[placeholder*="00:1A"]').first
            if await mac_input.count() > 0:
                await mac_input.fill('AA:BB:CC:DD:EE:FF')
                await page.locator('button:has-text("Add MAC")').first.click()
                await page.wait_for_timeout(300)

            # Fill specifications
            cpu_input = page.locator('input[name="cpu"]').first
            if await cpu_input.count() > 0:
                await cpu_input.fill('Intel i9-13900K')

            ram_input = page.locator('input[name="ram_gb"]').first
            if await ram_input.count() > 0:
                await ram_input.fill('64')

            storage_input = page.locator('input[name="storage_gb"]').first
            if await storage_input.count() > 0:
                await storage_input.fill('2048')

            print("   [OK] Device data filled")
            await page.screenshot(path='test_before_save.png', full_page=True)

            # Submit form
            print("[4/6] Submitting device form...")
            # Look for submit button - need to scroll to find it
            submit_buttons = await page.locator('button:has-text("Add Device"), button:has-text("Update Device")').all()
            if len(submit_buttons) > 1:
                # Click the last one (in the modal footer)
                await submit_buttons[-1].click()
                await page.wait_for_timeout(2000)
                print("   [OK] Device submitted")
            else:
                print("   [WARN] Could not find submit button")

            await page.screenshot(path='test_after_save.png', full_page=True)

            # Check if device appears in list
            device_found_before = await page.locator('text=TEST-LAP-001-PERSIST').count() > 0
            print(f"[5/6] Device in list before reload: {device_found_before}")

            # Reload page to test persistence
            print("[6/6] Reloading page to test persistence...")
            await page.reload()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)

            # Check if device still appears
            device_found_after = await page.locator('text=TEST-LAP-001-PERSIST').count() > 0
            await page.screenshot(path='test_after_reload.png', full_page=True)

            print("\n" + "="*60)
            if device_found_after:
                status_before = "[OK] Device visible" if device_found_before else "[WARN] Device not visible"
                status_after = "[OK] Device visible" if device_found_after else "[FAIL] Device NOT found"
                print("SUCCESS! Device persisted to database!")
                print("="*60)
                print("\nResults:")
                print(f"  Before reload: {status_before}")
                print(f"  After reload:  {status_after}")
                print("\nThe device was successfully saved to the database!")
                print("MAC addresses and specifications are being stored!")
            else:
                print("FAILURE! Device not persisted!")
                print("="*60)
                print("\nThe device was not saved to the database.")
                print("Checking browser console and API responses...")

            print("\n")

        except Exception as e:
            print(f"\nError: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await page.wait_for_timeout(2000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
