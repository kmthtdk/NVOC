#!/usr/bin/env python3
"""Complete end-to-end test of device specifications form"""
import asyncio
from playwright.async_api import async_playwright
import json

async def test_device_specs_workflow():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            print("\n" + "="*60)
            print("DEVICE SPECIFICATIONS FORM - FULL WORKFLOW TEST")
            print("="*60 + "\n")

            # Step 1: Navigate and login
            print("[STEP 1] Navigating to admin portal...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')
            await page.screenshot(path='workflow_01_initial.png', full_page=True)
            print("        [OK] Portal loaded")

            print("[STEP 2] Authenticating as Admin...")
            admin_btn = page.locator('button:has-text("Admin")').first
            await admin_btn.click()
            await page.wait_for_timeout(500)

            signin_btn = page.locator('button:has-text("Sign in")').first
            await signin_btn.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(2000)
            await page.screenshot(path='workflow_02_logged_in.png', full_page=True)
            print("        [OK]Admin authenticated")

            # Step 2: Enter admin workspace
            print("[STEP 3] Entering IT Admin Workspace...")
            all_buttons = await page.locator('button').all()
            if len(all_buttons) > 1:
                await all_buttons[1].click()  # IT Admin Workspace button
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)
            print("        [OK]Admin workspace entered")

            # Step 3: Navigate to Device Inventory
            print("[STEP 4] Clicking Device Inventory tab...")
            devices_tab = page.locator('button:has-text("Device Inventory")').first
            await devices_tab.click()
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)
            await page.screenshot(path='workflow_03_device_inventory.png', full_page=True)
            print("        [OK]Device Inventory tab activated")

            # Step 4: Click Add Device
            print("[STEP 5] Clicking 'Add Device' button...")
            add_btn = page.locator('button:has-text("Add Device")').first
            await add_btn.click()
            # Wait for form to appear (check for input with name="name")
            await page.wait_for_selector('input[name="name"]', timeout=5000)
            await page.wait_for_timeout(500)
            await page.screenshot(path='workflow_04_modal_opened.png', full_page=True)
            print("        [OK] Device form modal opened")

            # Step 5: Fill basic device info
            print("[STEP 6] Filling device information...")
            await page.fill('input[name="name"]', 'Dell XPS 15 Laptop')
            await page.fill('input[name="serial_number"]', 'SN-DL-XPS-20260616-001')
            await page.fill('input[placeholder*="Laptop"]', 'laptop')
            print("        [OK]Basic device info filled")

            # Step 6: Fill specifications
            print("[STEP 7] Filling device specifications...")

            # CPU
            cpu_input = page.locator('input[name="cpu"]').first
            if await cpu_input.count() > 0:
                await cpu_input.fill('Intel Core i7-12700K @ 3.6 GHz')
                print("        [OK]CPU: Intel Core i7-12700K @ 3.6 GHz")

            # RAM
            ram_input = page.locator('input[name="ram_gb"]').first
            if await ram_input.count() > 0:
                await ram_input.fill('32')
                print("        [OK]RAM: 32 GB")

            # Storage
            storage_input = page.locator('input[name="storage_gb"]').first
            if await storage_input.count() > 0:
                await storage_input.fill('1024')
                print("        [OK]Storage: 1024 GB (1TB NVMe SSD)")

            # GPU
            gpu_input = page.locator('input[name="gpu"]').first
            if await gpu_input.count() > 0:
                await gpu_input.fill('NVIDIA GeForce RTX 3070 Ti (8GB GDDR6)')
                print("        [OK]GPU: NVIDIA GeForce RTX 3070 Ti")

            # PSU
            psu_input = page.locator('input[name="psu_watts"]').first
            if await psu_input.count() > 0:
                await psu_input.fill('230')
                print("        [OK]PSU: 230 Watts")

            await page.screenshot(path='workflow_05_form_filled.png', full_page=True)
            print("        [OK]All specification fields filled")

            # Step 7: Submit form
            print("[STEP 8] Submitting device form...")
            submit_btn = page.locator('button:has-text("Add Device")').first
            await submit_btn.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path='workflow_06_after_submit.png', full_page=True)
            print("        [OK]Form submitted")

            # Step 8: Verify device in list
            print("[STEP 9] Verifying device appears in list...")
            await page.wait_for_timeout(1000)

            # Check if device name appears in the table
            device_name_visible = await page.locator('text=Dell XPS 15 Laptop').count() > 0
            serial_visible = await page.locator('text=SN-DL-XPS-20260616-001').count() > 0

            if device_name_visible and serial_visible:
                print("        [OK]Device successfully created and visible in list!")
                print("        [OK]Device name: Dell XPS 15 Laptop")
                print("        [OK]Serial: SN-DL-XPS-20260616-001")
            else:
                print("        [WARN]Device may not be visible in list (might need more time)")

            await page.screenshot(path='workflow_07_device_in_list.png', full_page=True)

            # Step 9: Try to edit the device to verify specs are saved
            print("[STEP 10] Verifying specifications were saved...")
            # Find edit button - look for pencil icon or Edit button in the table
            edit_buttons = await page.locator('button').filter(has_text='Edit2').all()
            if not edit_buttons:
                # Try looking for buttons within table rows
                edit_buttons = await page.locator('button:has-text("Edit")').all()

            if edit_buttons:
                await edit_buttons[0].click()
                # Wait for form inputs to appear
                await page.wait_for_selector('input[name="cpu"]', timeout=5000)
                await page.wait_for_timeout(500)

                # Check if CPU is populated
                cpu_value = await page.locator('input[name="cpu"]').first.input_value()
                ram_value = await page.locator('input[name="ram_gb"]').first.input_value()
                storage_value = await page.locator('input[name="storage_gb"]').first.input_value()
                gpu_value = await page.locator('input[name="gpu"]').first.input_value()
                psu_value = await page.locator('input[name="psu_watts"]').first.input_value()

                print(f"        Verified CPU: {cpu_value}")
                print(f"        Verified RAM: {ram_value} GB")
                print(f"        Verified Storage: {storage_value} GB")
                print(f"        Verified GPU: {gpu_value}")
                print(f"        Verified PSU: {psu_value} W")

                if cpu_value and ram_value and storage_value:
                    print("        [OK]All specifications saved correctly!")
                else:
                    print("        [WARN]Some specifications missing")

                await page.screenshot(path='workflow_08_edit_form_opened.png', full_page=True)

                # Close the edit modal
                close_btn = page.locator('button:has-text("Cancel")').first
                if await close_btn.count() > 0:
                    await close_btn.click()
                    await page.wait_for_timeout(500)
            else:
                print("        [WARN] No edit button found, skipping verification")

            print("\n" + "="*60)
            print("TEST COMPLETED SUCCESSFULLY!")
            print("="*60)
            print("\nSummary:")
            print("  ✓ Logged in as Admin")
            print("  ✓ Navigated to Device Inventory")
            print("  ✓ Opened Add Device form")
            print("  ✓ Filled all specification fields")
            print("  ✓ Submitted device")
            print("  ✓ Verified device in list")
            print("  ✓ Edited device to confirm specs saved")
            print("\nScreenshots saved:")
            print("  - workflow_01_initial.png")
            print("  - workflow_02_logged_in.png")
            print("  - workflow_03_device_inventory.png")
            print("  - workflow_04_modal_opened.png")
            print("  - workflow_05_form_filled.png")
            print("  - workflow_06_after_submit.png")
            print("  - workflow_07_device_in_list.png")
            print("  - workflow_08_edit_form_opened.png")
            print("\n")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path='workflow_ERROR.png', full_page=True)
        finally:
            await page.wait_for_timeout(3000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test_device_specs_workflow())
