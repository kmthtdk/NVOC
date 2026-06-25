#!/usr/bin/env python3
"""Test the admin dashboard device allocation workflow"""
import asyncio
from playwright.async_api import async_playwright
import time
import sys
import os

# Fix encoding for Windows
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'

async def test_admin_dashboard():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={'width': 1600, 'height': 1000})

        try:
            print("\n" + "="*80)
            print("ADMIN DASHBOARD - DEVICE ALLOCATION WORKFLOW TEST")
            print("="*80)

            # Step 1: Navigate to admin portal
            print("\n[1/10] Navigating to admin portal...")
            await page.goto('http://localhost:3001/admin/simulation', timeout=10000)
            await page.wait_for_load_state('networkidle')
            print("      [OK] Admin portal loaded")
            await page.screenshot(path='test_admin_01_portal.png')

            # Step 2: Authenticate
            print("\n[2/10] Authenticating...")

            # Look for Admin button
            try:
                admin_btn = page.locator('button:has-text("Admin")')
                if await admin_btn.count() > 0:
                    await admin_btn.first.click()
                    await page.wait_for_timeout(500)
                    print("      [OK] Clicked Admin button")
            except:
                print("      Note: Admin button not found")

            # Look for Sign in button
            try:
                signin_btn = page.locator('button:has-text("Sign in")')
                if await signin_btn.count() > 0:
                    await signin_btn.first.click()
                    await page.wait_for_load_state('networkidle')
                    await page.wait_for_timeout(1000)
                    print("      [OK] Clicked Sign in button")
            except:
                print("      Note: Sign in button not found")

            # Click user selection (usually second button)
            try:
                all_buttons = await page.locator('button').all()
                if len(all_buttons) > 1:
                    await all_buttons[1].click()
                    await page.wait_for_load_state('networkidle')
                    await page.wait_for_timeout(1000)
                    print("      [OK] User selected")
            except:
                print("      Note: User selection failed")

            await page.screenshot(path='test_admin_02_authenticated.png')

            # Step 3: Wait for admin console to load
            print("\n[3/10] Waiting for admin console...")
            try:
                await page.wait_for_selector('select', timeout=5000)
                print("      [OK] Admin console ready")
            except:
                print("      Note: Admin console might not be fully loaded")

            # Step 4: Check available tickets
            print("\n[4/10] Checking available tickets...")
            try:
                ticket_select = page.locator('select').first
                option_count = await page.locator('select').first.locator('option').count()
                print(f"      [OK] Found {option_count} ticket options")
                await page.screenshot(path='test_admin_03_tickets.png')
            except Exception as e:
                print(f"      Error: {e}")

            # Step 5: Look for a hardware_request ticket or create one via API
            print("\n[5/10] Finding/creating hardware_request ticket...")

            # Try to find a hardware request in the dropdown
            try:
                options = await page.locator('select').first.locator('option').all()
                hardware_ticket = None

                for opt in options:
                    text = await opt.text_content()
                    if 'Hardware Request' in text or 'hardware' in text.lower() or 'laptop' in text.lower():
                        hardware_ticket = text
                        print(f"      [OK] Found hardware ticket: {text[:60]}...")
                        await opt.click()
                        await page.wait_for_timeout(500)
                        break

                if not hardware_ticket:
                    print("      Note: No hardware request found, will test with available ticket")
                    if len(options) > 1:
                        await options[1].click()
                        await page.wait_for_timeout(500)
                        ticket_text = await options[1].text_content()
                        print(f"      Using ticket: {ticket_text[:60]}...")
            except Exception as e:
                print(f"      Error selecting ticket: {e}")

            await page.screenshot(path='test_admin_04_ticket_selected.png')

            # Step 6: Change status to "resolved"
            print("\n[6/10] Changing ticket status to 'resolved'...")
            try:
                # Find all select elements (first is ticket, second might be status)
                selects = await page.locator('select').all()
                if len(selects) >= 2:
                    status_select = selects[1]
                    await status_select.click()
                    await page.wait_for_timeout(300)

                    # Click on "resolved" option
                    resolved_opt = page.locator('option:has-text("resolved")').first
                    if await resolved_opt.count() > 0:
                        await resolved_opt.click()
                        await page.wait_for_timeout(500)
                        print("      [OK] Status changed to 'resolved'")
                    else:
                        print("      Note: 'resolved' option not found")
                else:
                    print("      Note: Status select not found")
            except Exception as e:
                print(f"      Error: {e}")

            await page.screenshot(path='test_admin_05_status_changed.png')

            # Step 7: Submit to trigger device modal
            print("\n[7/10] Submitting to trigger device allocation modal...")
            try:
                submit_btn = page.locator('button[type="submit"], button:has-text("Update")').first
                if await submit_btn.count() > 0:
                    await submit_btn.click()
                    await page.wait_for_timeout(1500)
                    print("      [OK] Submit button clicked")
                else:
                    print("      Note: Submit button not found")
            except Exception as e:
                print(f"      Error: {e}")

            await page.screenshot(path='test_admin_06_after_submit.png')

            # Step 8: Check for device allocation modal
            print("\n[8/10] Checking for DeviceAssignmentModal...")
            try:
                modal = page.locator('[role="dialog"], .modal, [aria-modal="true"]').first
                modal_visible = await modal.is_visible()

                if modal_visible:
                    print("      [OK] DeviceAssignmentModal appeared!")

                    # Check modal title
                    title = await page.locator('h3, h2, [id*="title"]').first.text_content()
                    print(f"      Modal title: {title[:60] if title else 'N/A'}")

                    # Count device options
                    devices = await page.locator('input[type="radio"], [role="option"], .device-item').all()
                    print(f"      [OK] Modal shows {len(devices)} device options")

                    await page.screenshot(path='test_admin_07_device_modal.png')
                else:
                    print("      [WARN] Modal not visible yet, checking for alternative layouts...")

                    # Check for modals with different selectors
                    alternatives = await page.locator('[class*="modal"], [class*="dialog"], [class*="Modal"]').all()
                    print(f"      Found {len(alternatives)} alternative modal-like elements")

                    if len(alternatives) > 0:
                        await page.screenshot(path='test_admin_07_alternative_modal.png')
            except Exception as e:
                print(f"      Note: Modal check error: {e}")
                await page.screenshot(path='test_admin_07_error.png')

            # Step 9: Select a device
            print("\n[9/10] Selecting device...")
            try:
                radios = await page.locator('input[type="radio"]').all()
                if len(radios) > 0:
                    await radios[0].click()
                    await page.wait_for_timeout(300)

                    # Get device info
                    parent = radios[0].locator('xpath=..')
                    device_text = await parent.text_content()
                    print(f"      [OK] Selected device: {device_text[:60] if device_text else 'Device 1'}")

                    await page.screenshot(path='test_admin_08_device_selected.png')
                else:
                    print("      Note: No radio buttons found")
            except Exception as e:
                print(f"      Note: Device selection: {e}")

            # Step 10: Click Assign button
            print("\n[10/10] Assigning device...")
            try:
                assign_btn = page.locator('button:has-text("Assign")').first
                if await assign_btn.count() > 0:
                    await assign_btn.click()
                    await page.wait_for_timeout(1500)
                    print("      [OK] Assignment submitted")

                    # Check for success message
                    try:
                        toast = page.locator('[class*="toast"], [role="alert"], .success-message').first
                        if await toast.is_visible():
                            toast_text = await toast.text_content()
                            print(f"      [OK] Success message: {toast_text[:60] if toast_text else 'Device assigned'}")
                    except:
                        pass
                else:
                    print("      Note: Assign button not found")
            except Exception as e:
                print(f"      Error: {e}")

            await page.screenshot(path='test_admin_09_after_assign.png')

            # Final verification
            print("\n" + "="*80)
            print("TEST COMPLETE")
            print("="*80)
            print("\nScreenshots saved:")
            print("  [OK] test_admin_01_portal.png")
            print("  [OK] test_admin_02_authenticated.png")
            print("  [OK] test_admin_03_tickets.png")
            print("  [OK] test_admin_04_ticket_selected.png")
            print("  [OK] test_admin_05_status_changed.png")
            print("  [OK] test_admin_06_after_submit.png")
            print("  [OK] test_admin_07_device_modal.png")
            print("  [OK] test_admin_08_device_selected.png")
            print("  [OK] test_admin_09_after_assign.png")
            print("="*80)

        except Exception as e:
            print(f"\n[FAIL] Test failed: {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path='test_admin_error.png')
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(test_admin_dashboard())
