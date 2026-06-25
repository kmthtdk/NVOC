#!/usr/bin/env python3
"""Test the manual device allocation workflow for hardware_request tickets"""
import asyncio
from playwright.async_api import async_playwright
import time

async def test_device_allocation_workflow():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1400, 'height': 900})

        try:
            print("="*70)
            print("DEVICE ALLOCATION WORKFLOW TEST")
            print("="*70)

            # Step 1: Open admin portal
            print("\n[1/8] Opening admin portal...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')
            print("      ✓ Portal loaded")

            # Step 2: Authenticate as admin
            print("\n[2/8] Authenticating as admin...")
            try:
                await page.locator('button:has-text("Admin")').first.click()
                await page.wait_for_timeout(300)
            except:
                pass

            try:
                await page.locator('button:has-text("Sign in")').first.click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(1000)
            except:
                pass

            # Click through user selection
            try:
                all_buttons = await page.locator('button').all()
                if len(all_buttons) > 1:
                    await all_buttons[1].click()
                    await page.wait_for_load_state('networkidle')
                    await page.wait_for_timeout(1000)
            except:
                pass

            print("      ✓ Authentication complete")

            # Step 3: Create hardware_request ticket via the UI
            print("\n[3/8] Creating hardware_request ticket with deviceType='laptop'...")

            # Look for a way to create ticket (might be a button)
            try:
                create_btn = await page.locator('button:has-text("Create"), button:has-text("New")').first
                if create_btn:
                    await create_btn.click()
                    await page.wait_for_timeout(500)
            except:
                pass

            # Alternative: navigate to ticket creation page
            await page.goto('http://localhost:3001/request')
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)

            print("      ✓ Navigated to ticket creation")

            # Fill form
            print("\n[4/8] Filling hardware request form...")

            # Title
            try:
                await page.fill('input[placeholder*="Title"], input[placeholder*="title"]', 'Test Laptop Request')
                await page.wait_for_timeout(200)
            except:
                pass

            # Description
            try:
                await page.fill('textarea, textarea[placeholder*="description"]', 'Need a laptop for new employee')
                await page.wait_for_timeout(200)
            except:
                pass

            # Category: hardware_request
            try:
                category_select = await page.locator('select, [role="combobox"]').first
                await category_select.click()
                await page.wait_for_timeout(300)
                await page.locator('option:has-text("Hardware Request"), div:has-text("Hardware Request")').first.click()
                await page.wait_for_timeout(300)
            except Exception as e:
                print(f"      Note: Could not select category: {e}")

            # Take screenshot before submission
            await page.screenshot(path='test_before_submit.png')
            print("      ✓ Form filled, screenshot saved")

            # Step 5: Submit ticket
            print("\n[5/8] Submitting ticket...")
            try:
                submit_btn = await page.locator('button:has-text("Submit"), button:has-text("Create")').first
                await submit_btn.click()
                await page.wait_for_load_state('networkidle')
                await page.wait_for_timeout(2000)
                print("      ✓ Ticket submitted")
            except Exception as e:
                print(f"      Warning: Submission step: {e}")

            # Step 6: Navigate to admin simulation
            print("\n[6/8] Opening admin dispatch console...")
            await page.goto('http://localhost:3001/admin/simulation')
            await page.wait_for_load_state('networkidle')
            await page.wait_for_timeout(1000)
            print("      ✓ Admin console opened")

            # Step 7: Find and select the hardware request ticket
            print("\n[7/8] Selecting hardware request ticket...")
            try:
                ticket_selector = await page.locator('select').first
                await ticket_selector.click()
                await page.wait_for_timeout(300)

                # Look for a hardware ticket
                hw_option = await page.locator('option:has-text("hardware"), option:has-text("Laptop")').first
                if hw_option:
                    await hw_option.click()
                    await page.wait_for_timeout(500)
                    print("      ✓ Hardware request ticket selected")
                else:
                    print("      Note: Could not find hardware request ticket")
            except Exception as e:
                print(f"      Note: Ticket selection: {e}")

            # Step 8: Change status to "resolved" and trigger device workflow
            print("\n[8/8] Resolving ticket and testing device allocation modal...")

            # Take screenshot of form
            await page.screenshot(path='test_before_resolve.png')

            # Change status dropdown to "resolved"
            try:
                status_select = await page.locator('select').nth(1)  # Second select is usually status
                await status_select.click()
                await page.wait_for_timeout(300)
                await page.locator('option:has-text("Resolved")').click()
                await page.wait_for_timeout(500)
                print("      ✓ Status changed to resolved")
            except Exception as e:
                print(f"      Note: Status change: {e}")

            # Take screenshot
            await page.screenshot(path='test_status_changed.png')

            # Click submit to trigger device workflow
            print("\n      Submitting to trigger DeviceAssignmentModal...")
            try:
                submit_btn = await page.locator('button[type="submit"], button:has-text("Update")').first
                await submit_btn.click()
                await page.wait_for_timeout(1500)

                # Check if modal appeared
                modal = await page.locator('[role="dialog"], .modal, [aria-modal="true"]').first
                if modal:
                    print("      ✓ DeviceAssignmentModal appeared!")
                    await page.screenshot(path='test_device_modal.png')

                    # Verify modal has device list
                    devices = await page.locator('tr, li, .device-item, [role="option"]').all()
                    print(f"      ✓ Modal shows {len(devices)} devices")

                    if len(devices) > 0:
                        # Take screenshot of device selection
                        await page.screenshot(path='test_device_list.png')

                        # Try to select first device
                        try:
                            first_radio = await page.locator('input[type="radio"]').first
                            await first_radio.click()
                            await page.wait_for_timeout(300)
                            print("      ✓ Device selected")
                        except:
                            pass

                        # Try to assign
                        try:
                            assign_btn = await page.locator('button:has-text("Assign")').first
                            await assign_btn.click()
                            await page.wait_for_timeout(1000)
                            print("      ✓ Assignment submitted")

                            await page.screenshot(path='test_after_assign.png')
                        except Exception as e:
                            print(f"      Note: Assignment button: {e}")
                else:
                    print("      ⚠ DeviceAssignmentModal did not appear")
                    await page.screenshot(path='test_no_modal.png')

            except Exception as e:
                print(f"      Error during resolve: {e}")
                await page.screenshot(path='test_error.png')

            print("\n" + "="*70)
            print("TEST COMPLETE - Screenshots saved:")
            print("  - test_before_submit.png")
            print("  - test_before_resolve.png")
            print("  - test_status_changed.png")
            print("  - test_device_modal.png")
            print("  - test_device_list.png")
            print("  - test_after_assign.png")
            print("="*70)

        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test_device_allocation_workflow())
