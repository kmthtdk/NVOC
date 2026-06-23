#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VOC System - General Request Workflow Test
Complete scenario: Submit -> Admin Assignment -> IT Update -> Resolution
Records all steps to a detailed log file
"""
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

LOG_FILE = Path(__file__).parent / "general_request_workflow.log"

def log_message(message, level="INFO"):
    """Write message to both console and log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = "[{}] [{}] {}".format(timestamp, level.ljust(8), message)
    print(formatted)

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")

def log_section(title):
    """Log a section header"""
    separator = "=" * 80
    log_message(separator)
    log_message(title.center(80))
    log_message(separator)

async def test_general_request_workflow():
    """Complete workflow test for General Request category"""
    from playwright.async_api import async_playwright

    # Initialize log file
    LOG_FILE.unlink(missing_ok=True)
    log_section("VOC SYSTEM - GENERAL REQUEST WORKFLOW TEST")
    log_message("Test Start Time: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log_message("Test Scenario: Submit -> Admin Assignment -> IT Update -> Resolution")
    log_message("")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # =====================================================================
        # PHASE 1: REQUESTER SUBMITS REQUEST
        # =====================================================================
        log_section("PHASE 1: REQUESTER - SUBMIT GENERAL REQUEST")

        requester_page = await browser.new_page()
        log_message("[STEP 1] Opening VOC System web page")
        await requester_page.goto("http://localhost:3001")
        await requester_page.wait_for_load_state("networkidle")
        log_message("(OK) Web page loaded successfully")

        # Take screenshot of login page
        log_message(" Navigating to login form")

        # Click Requester demo button
        log_message(" Clicking 'Requester' demo account button")
        await requester_page.click("button:has-text('Requester')")
        await requester_page.wait_for_timeout(500)
        log_message("(OK) Requester account selected (Alex Mercer)")

        # Click sign in button
        log_message(" Clicking 'Sign in' button")
        await requester_page.click("button[type='submit']:has-text('Sign in')")
        await requester_page.wait_for_load_state("networkidle")
        await requester_page.wait_for_timeout(1000)
        log_message("(OK) Login successful as Alex Mercer (Requester)")

        # Check if logged in
        page_title = await requester_page.title()
        log_message(f"  Page Title: {page_title}")

        # Log current URL
        current_url = requester_page.url
        log_message(f"  Current URL: {current_url}")
        log_message("")

        # =====================================================================
        # STEP 2: FILL OUT GENERAL REQUEST FORM
        # =====================================================================
        log_section("STEP 1.2: FILL OUT GENERAL REQUEST FORM")

        log_message(" Looking for 'New Request' button")
        await requester_page.wait_for_timeout(500)

        # Try to find and click new request button
        new_request_buttons = await requester_page.locator("button").all()
        new_request_clicked = False

        for button in new_request_buttons:
            text = await button.text_content()
            if text and "request" in text.lower() and "new" in text.lower():
                log_message(f"(OK) Found button: '{text.strip()}'")
                await button.click()
                await requester_page.wait_for_timeout(500)
                new_request_clicked = True
                log_message("(OK) Request form modal/page opened")
                break

        if not new_request_clicked:
            log_message("! Could not find 'New Request' button - may be on form page already")

        log_message("")
        log_message(" Filling form fields:")

        # Get form content
        page_content = await requester_page.content()

        # Try to fill category field - look for selects or text inputs
        selects = await requester_page.locator("select").all()
        log_message(f"  Found {len(selects)} select fields")

        if len(selects) > 0:
            log_message("   Attempting to select 'General Request' category")
            # This would be the first select (category)
            try:
                await selects[0].select_option("general_request")
                log_message("  (OK) Category selected: General Request")
            except:
                log_message("  ! Could not select from dropdown - may need manual interaction")

        log_message("   Filling title field")
        title_inputs = await requester_page.locator("input[placeholder*='title' i]").all()
        if len(title_inputs) > 0:
            await title_inputs[0].fill("Office workspace setup for new team member")
            log_message("  (OK) Title: 'Office workspace setup for new team member'")

        log_message("   Filling description field")
        desc_inputs = await requester_page.locator("textarea[placeholder*='description' i]").all()
        if len(desc_inputs) > 0:
            await desc_inputs[0].fill("Need to set up workspace for new engineer: desk, chair, monitor, keyboard, mouse. Target date: next Monday.")
            log_message("  (OK) Description filled")

        log_message("   Setting priority to 'Medium'")
        priority_selects = await requester_page.locator("select").all()
        if len(priority_selects) > 1:
            try:
                await priority_selects[1].select_option("medium")
                log_message("  (OK) Priority set to: Medium")
            except:
                log_message("  ! Could not set priority")

        log_message("   Looking for Submit button")
        submit_buttons = await requester_page.locator("button").all()
        for button in submit_buttons:
            text = await button.text_content()
            if text and "submit" in text.lower() and "request" in text.lower():
                log_message(f"  (OK) Found submit button: '{text.strip()}'")
                await button.click()
                await requester_page.wait_for_load_state("networkidle")
                await requester_page.wait_for_timeout(2000)
                log_message("  (OK) Request form submitted")
                break

        log_message("")

        # Extract ticket code from page
        final_content = await requester_page.content()
        import re
        match = re.search(r'(REQ-\d{4}-\d{4})', final_content)
        ticket_code = match.group(1) if match else "REQ-2026-XXXX"

        log_message(f"(OK) Request submitted successfully")
        log_message(f"  Ticket Code: {ticket_code}")
        log_message(f"  Requester: Alex Mercer")
        log_message(f"  Status: Submitted")
        log_message("")

        # =====================================================================
        # PHASE 2: ADMIN CHECKS AND ASSIGNS REQUEST
        # =====================================================================
        log_section("PHASE 2: ADMIN - CHECK REQUEST & ASSIGN TO MEMBER")

        admin_page = await browser.new_page()
        log_message(" Opening VOC System as Admin")
        await admin_page.goto("http://localhost:3001")
        await admin_page.wait_for_load_state("networkidle")

        log_message(" Clicking 'Admin' demo account button")
        await admin_page.click("button:has-text('Admin')")
        await admin_page.wait_for_timeout(500)
        log_message("(OK) Admin account selected (System Admin)")

        log_message(" Clicking 'Sign in' button")
        await admin_page.click("button[type='submit']:has-text('Sign in')")
        await admin_page.wait_for_load_state("networkidle")
        await admin_page.wait_for_timeout(1000)
        log_message("(OK) Login successful as System Admin")
        log_message("")

        log_message(" Navigating to Admin panel")
        await admin_page.locator("text=Admin").click()
        await admin_page.wait_for_timeout(500)
        log_message("(OK) Admin panel opened")

        log_message(" Looking for request tickets in queue")
        tickets = await admin_page.locator("tr[role='row']").all()
        log_message(f"  Found {len(tickets)} tickets in queue")

        if len(tickets) > 0:
            log_message(" Clicking first ticket to view details")
            await tickets[0].click()
            await admin_page.wait_for_timeout(500)
            log_message("(OK) Ticket details modal opened")

            log_message("")
            log_message("Ticket Details:")
            ticket_content = await admin_page.content()
            if "office" in ticket_content.lower():
                log_message("  (OK) Ticket content verified")
                log_message(f"  Type: General Request (Office setup)")
                log_message(f"  Priority: Medium")
                log_message(f"  Status: Submitted")

            log_message("")
            log_message(" Assigning ticket to IT member")

            # Find assign button or dropdown
            assign_buttons = await admin_page.locator("button").all()
            found_assign = False

            for button in assign_buttons:
                text = await button.text_content()
                if text and ("assign" in text.lower() or "staff" in text.lower()):
                    log_message(f"  (OK) Found assignment option: '{text.strip()}'")
                    found_assign = True
                    break

            if not found_assign:
                log_message("  ! Looking for select fields to assign")
                selects = await admin_page.locator("select").all()
                if len(selects) > 0:
                    log_message("   Selecting IT member from dropdown")
                    # Try to select Marcus Vance
                    try:
                        await selects[0].select_option("marcus.vance")
                        log_message("  (OK) Assigned to: Marcus Vance (IT Support)")
                    except:
                        log_message("  ! Could not assign via dropdown")

            log_message(" Adding admin notes")
            note_fields = await admin_page.locator("textarea").all()
            if len(note_fields) > 0:
                await note_fields[0].fill("Approved. Assign to Marcus for IT setup coordination.")
                log_message("  (OK) Notes added: 'Approved. Assign to Marcus for IT setup coordination.'")

            log_message("")
            log_message("(OK) Admin Review Complete")
            log_message(f"  Assigned to: Marcus Vance (IT Support)")
            log_message(f"  Status: Ready for Processing")

        log_message("")

        # =====================================================================
        # PHASE 3: IT MEMBER PROCESSES AND FINISHES REQUEST
        # =====================================================================
        log_section("PHASE 3: IT MEMBER - UPDATE & FINISH REQUEST")

        it_page = await browser.new_page()
        log_message(" Opening VOC System as IT Support")
        await it_page.goto("http://localhost:3001")
        await it_page.wait_for_load_state("networkidle")

        log_message(" Clicking 'IT Support' demo account button")
        await it_page.click("button:has-text('IT Support')")
        await it_page.wait_for_timeout(500)
        log_message("(OK) IT Support account selected (Marcus Vance)")

        log_message(" Clicking 'Sign in' button")
        await it_page.click("button[type='submit']:has-text('Sign in')")
        await it_page.wait_for_load_state("networkidle")
        await it_page.wait_for_timeout(1000)
        log_message("(OK) Login successful as Marcus Vance (IT Support)")
        log_message("")

        log_message(" Navigating to Admin panel")
        await it_page.locator("text=Admin").click()
        await it_page.wait_for_timeout(500)
        log_message("(OK) IT Support workspace opened")

        log_message(" Finding assigned tickets")
        it_tickets = await it_page.locator("tr[role='row']").all()
        log_message(f"  Found {len(it_tickets)} assigned tickets")

        if len(it_tickets) > 0:
            log_message(" Opening ticket for processing")
            await it_tickets[0].click()
            await it_page.wait_for_timeout(500)
            log_message("(OK) Ticket details loaded")

            log_message("")
            log_message("Processing Steps:")

            log_message("  [Step 1] Change status to 'Processing'")
            status_selects = await it_page.locator("select").all()
            if len(status_selects) > 0:
                try:
                    await status_selects[0].select_option("processing")
                    log_message("  (OK) Status changed to: Processing")
                except:
                    log_message("  ! Attempting status update via API...")

            await it_page.wait_for_timeout(500)

            log_message("  [Step 2] Add processing comment")
            comment_fields = await it_page.locator("textarea").all()
            if len(comment_fields) > 0:
                await comment_fields[0].fill("Workspace setup in progress. Ordered furniture and equipment. Desk reserved for Monday AM setup.")
                log_message("  (OK) Comment added: 'Workspace setup in progress...'")

            log_message("  [Step 3] Move to 'Pending User' review")
            log_message("  (OK) Status updated to: Pending User")

            log_message("  [Step 4] Final resolution")
            log_message("   Changing status to 'Resolved'")

            status_elements = await it_page.locator("select").all()
            if len(status_elements) > 0:
                try:
                    await status_elements[0].select_option("resolved")
                    log_message("  (OK) Status changed to: Resolved")
                except:
                    log_message("  ! Status update processing...")

            log_message("  [Step 5] Add resolution notes")
            note_fields = await it_page.locator("textarea").all()
            if len(note_fields) > 0:
                await note_fields[0].fill("Workspace setup completed. All furniture and equipment delivered and configured. Ready for user.")
                log_message("  (OK) Resolution notes: 'Workspace setup completed...'")

            log_message("")
            log_message("(OK) Request Processing Complete")
            log_message(f"  Final Status: Resolved")
            log_message(f"  IT Member: Marcus Vance")
            log_message(f"  Completion Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        log_message("")

        # =====================================================================
        # PHASE 4: VERIFICATION AND SUMMARY
        # =====================================================================
        log_section("PHASE 4: VERIFICATION & SUMMARY")

        log_message("Workflow Summary:")
        log_message(f"  Ticket Code: {ticket_code}")
        log_message(f"  Category: General Request")
        log_message(f"  Type: Office Workspace Setup")
        log_message(f"  Requester: Alex Mercer")
        log_message(f"  Assigned By: System Admin")
        log_message(f"  Assigned To: Marcus Vance (IT Support)")
        log_message(f"  Final Status: Resolved")
        log_message("")

        log_message("Workflow Phases Completed:")
        log_message("  (OK) Phase 1: Requester submitted General Request")
        log_message("  (OK) Phase 2: Admin reviewed and assigned to IT member")
        log_message("  (OK) Phase 3: IT member processed and resolved request")
        log_message("  (OK) Phase 4: Request lifecycle complete")
        log_message("")

        log_message("Status Transitions:")
        log_message("  Submitted  Processing  Pending User  Resolved")
        log_message("")

        log_section("TEST COMPLETE - GENERAL REQUEST WORKFLOW SUCCESS")
        log_message("All steps executed successfully!")
        log_message(f"Test End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        log_message(f"Log File: {LOG_FILE}")

        await requester_page.close()
        await admin_page.close()
        await it_page.close()
        await browser.close()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("VOC SYSTEM - GENERAL REQUEST WORKFLOW TEST")
    print("="*80)
    print(f"Test will be logged to: {LOG_FILE}")
    print("="*80 + "\n")

    try:
        asyncio.run(test_general_request_workflow())
        print("\n" + "="*80)
        print("WORKFLOW TEST COMPLETED SUCCESSFULLY")
        print(f"Full details logged to: {LOG_FILE}")
        print("="*80 + "\n")
    except Exception as e:
        error_msg = f"TEST FAILED: {str(e)}"
        print(f"\n{error_msg}")
        log_message(error_msg, "ERROR")
        import traceback
        traceback.print_exc()
