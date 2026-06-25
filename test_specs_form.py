#!/usr/bin/env python3
"""Test device specifications form in DeviceFormModal"""
import asyncio
from playwright.async_api import async_playwright

async def test_device_specs_form():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Navigate to admin page
            print("[1] Navigating to admin simulation page...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')
            print("[2] Admin page loaded!")

            # Take screenshot
            await page.screenshot(path='01_initial_page.png', full_page=True)

            # Select Admin role (fills demo credentials)
            print("[3] Selecting Admin demo account...")
            admin_btn = page.locator('button', has_text='Admin').first
            if await admin_btn.count() > 0:
                await admin_btn.click()
                await page.wait_for_timeout(500)
                print("[4] Admin credentials filled")

                # Click Sign In button
                print("[5] Clicking Sign In...")
                signin_btn = page.locator('button', has_text='Sign in').first
                if await signin_btn.count() > 0:
                    await signin_btn.click()
                    await page.wait_for_load_state('networkidle')
                    print("[6] Signed in!")
                    await page.screenshot(path='02_after_signin.png', full_page=True)

                    # Now click IT Admin Workspace button (button index 1)
                    print("[7] Clicking IT Admin Workspace button...")
                    all_buttons = await page.locator('button').all()
                    if len(all_buttons) > 1:
                        # Button at index 1 should be "IT Admin Workspace"
                        await all_buttons[1].click()
                        await page.wait_for_load_state('networkidle')
                        await page.wait_for_timeout(1000)
                        print("[8] Entered Admin Workspace!")
                        await page.screenshot(path='02b_admin_workspace.png', full_page=True)
                    else:
                        print("[!] Could not find IT Admin Workspace button")
                        return
                else:
                    print("[!] Sign In button not found")
                    return
            else:
                print("[!] Admin button not found")
                return

            # Now look for Device Inventory tab
            print("[10] Looking for Device Inventory tab...")
            devices_tab = page.locator('button', has_text='Device Inventory').first
            tab_count = await page.locator('button', has_text='Device Inventory').count()
            print(f"    Found {tab_count} 'Device Inventory' tabs")

            if tab_count > 0:
                print("[11] Clicking Device Inventory tab...")
                await devices_tab.click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)
                print("[12] Device Inventory tab is now active!")
                await page.screenshot(path='03_devices_tab_active.png', full_page=True)

                # Look for Add Device button
                print("[13] Looking for 'Add Device' button...")
                add_btn = page.locator('button', has_text='Add Device').first
                add_count = await page.locator('button', has_text='Add Device').count()
                print(f"    Found {add_count} 'Add Device' buttons")

                if add_count > 0:
                    print("[14] Clicking 'Add Device' button...")
                    await add_btn.click()

                    # Wait for modal to appear (could take a moment)
                    print("[15] Waiting for modal (up to 5 seconds)...")
                    try:
                        await page.wait_for_selector('[role="dialog"]', timeout=5000)
                        print("[16] Modal appeared!")
                    except Exception as e:
                        print(f"[!] Modal did not appear: {e}")
                        # Take screenshot to see what happened
                        await page.screenshot(path='04_after_add_click.png', full_page=True)
                        return

                    modal_count = await page.locator('[role="dialog"]').count()

                    if modal_count > 0:
                        # Take screenshot of modal
                        await page.screenshot(path='04_device_form_modal.png', full_page=True)

                        # List all input fields with their properties
                        print("[17] Analyzing form inputs...")
                        all_inputs = await page.locator('input').all()
                        print(f"     Total {len(all_inputs)} inputs found:")

                        input_info = []
                        for inp in all_inputs:
                            placeholder = await inp.get_attribute('placeholder')
                            input_type = await inp.get_attribute('type')
                            input_id = await inp.get_attribute('id')
                            input_class = await inp.get_attribute('class')
                            if 'visibility:hidden' not in (input_class or ''):
                                input_info.append({
                                    'type': input_type or 'text',
                                    'placeholder': placeholder or '(none)',
                                    'id': input_id or '(none)'
                                })

                        for info in input_info[:20]:  # Show first 20
                            print(f"     - {info['type']:10} | {info['placeholder']:30} | {info['id']}")

                        # Check if we can see CPU, RAM, Storage fields
                        print("[18] Checking for specification fields...")
                        cpu_count = await page.locator('input[placeholder*="CPU"], input[placeholder*="Intel"]').count()
                        ram_count = await page.locator('input[placeholder*="RAM"], input[placeholder*="GB"]').count()
                        storage_count = await page.locator('input[placeholder*="Storage"]').count()
                        gpu_count = await page.locator('input[placeholder*="GPU"]').count()

                        print(f"     CPU fields: {cpu_count}")
                        print(f"     RAM fields: {ram_count}")
                        print(f"     Storage fields: {storage_count}")
                        print(f"     GPU fields: {gpu_count}")

                        if cpu_count > 0 and ram_count > 0:
                            print("[19] SUCCESS: Specification fields found!")
                            print("     Device specifications form is working!")
                        else:
                            print("[!] Warning: Some specification fields not found")

                    else:
                        print("[!] Modal did not appear after clicking Add Device")
                else:
                    print("[!] 'Add Device' button not found")
            else:
                print("[!] 'Devices' tab not found")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("[*] Test complete. Keeping browser open for 3 seconds...")
            await page.wait_for_timeout(3000)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test_device_specs_form())
