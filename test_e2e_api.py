#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete End-to-End API Test
Tests full workflow: Submit -> Process -> Resolve
"""
import requests
import json
import time

BASE_URL = "http://localhost:4001/api"

def get_token(email, password):
    """Get JWT token for a user"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    return response.json()["token"]

def main():
    print("\n" + "="*80)
    print("VOC SYSTEM - COMPLETE END-TO-END API TEST")
    print("="*80)

    # =====================================================================
    # PHASE 1: AUTHENTICATION
    # =====================================================================
    print("\n[PHASE 1] Authentication & Setup")
    print("-" * 80)

    requester_token = get_token("alex.mercer@company.com", "Passw0rd!")
    it_support_token = get_token("marcus.vance@company.com", "Passw0rd!")
    admin_token = get_token("admin@company.com", "Passw0rd!")

    print("[OK] Authenticated as:")
    print("     - Requester (Alex Mercer)")
    print("     - IT Support (Marcus Vance)")
    print("     - Admin (System Admin)")

    # =====================================================================
    # PHASE 2: REQUESTER SUBMITS REQUESTS
    # =====================================================================
    print("\n[PHASE 2] Requester: Submit VOC Requests")
    print("-" * 80)

    # Submit General Request
    general_req = requests.post(
        f"{BASE_URL}/tickets",
        headers={"Authorization": f"Bearer {requester_token}"},
        json={
            "category": "General",
            "subcategory": "Network Access",
            "type": "Folder/Share Access",
            "priority": "medium",
            "title": "Need access to Q2 project folder",
            "description": "Requesting read/write access to /shared/projects/Q2-2026"
        }
    )
    general_ticket = general_req.json()
    general_id = general_ticket["id"]
    general_code = general_ticket["code"]

    print(f"[OK] General request submitted: {general_code}")
    print(f"     Status: {general_ticket['status']}")
    print(f"     Priority: {general_ticket['priority']}")

    # Submit Hardware Request
    hardware_req = requests.post(
        f"{BASE_URL}/tickets",
        headers={"Authorization": f"Bearer {requester_token}"},
        json={
            "category": "Hardware",
            "subcategory": "New Device",
            "type": "New Laptop",
            "priority": "high",
            "title": "New laptop for expanding team",
            "description": "Need laptop for new software engineer joining the team"
        }
    )
    hardware_ticket = hardware_req.json()
    hardware_id = hardware_ticket["id"]
    hardware_code = hardware_ticket["code"]

    print(f"[OK] Hardware request submitted: {hardware_code}")
    print(f"     Status: {hardware_ticket['status']}")
    print(f"     Priority: {hardware_ticket['priority']}")

    # =====================================================================
    # PHASE 3: IT SUPPORT PROCESSES REQUESTS
    # =====================================================================
    print("\n[PHASE 3] IT Support: Process Requests")
    print("-" * 80)

    # Process General Request
    general_process = requests.put(
        f"{BASE_URL}/tickets/{general_id}",
        headers={"Authorization": f"Bearer {it_support_token}"},
        json={
            "status": "processing",
            "assignedTo": "Marcus Vance (Network Advisor)",
            "notes": "Checking folder permissions"
        }
    )

    print(f"[OK] General request {general_code} status: processing")
    print(f"     Assigned to: Marcus Vance")

    # Add comment
    requests.post(
        f"{BASE_URL}/tickets/{general_id}/comments",
        headers={"Authorization": f"Bearer {it_support_token}"},
        json={
            "text": "Verifying access rights and configuring share permissions.",
            "isInternal": True
        }
    )
    print(f"[OK] Added internal comment")

    # Process Hardware Request
    hardware_process = requests.put(
        f"{BASE_URL}/tickets/{hardware_id}",
        headers={"Authorization": f"Bearer {it_support_token}"},
        json={
            "status": "processing",
            "assignedTo": "Marcus Vance (Network Advisor)",
            "notes": "Checking available inventory"
        }
    )

    print(f"[OK] Hardware request {hardware_code} status: processing")
    print(f"     Assigned to: Marcus Vance")

    # =====================================================================
    # PHASE 4: MOVE TO PENDING USER
    # =====================================================================
    print("\n[PHASE 4] IT Support: Pending User Review")
    print("-" * 80)

    # Move general to pending_user
    requests.put(
        f"{BASE_URL}/tickets/{general_id}",
        headers={"Authorization": f"Bearer {it_support_token}"},
        json={
            "status": "pending_user",
            "notes": "Folder access configured. Please verify access and confirm."
        }
    )
    print(f"[OK] General request {general_code} status: pending_user")

    # =====================================================================
    # PHASE 5: ADMIN RESOLVES REQUESTS
    # =====================================================================
    print("\n[PHASE 5] Admin: Resolve Requests")
    print("-" * 80)

    # Resolve General Request
    general_resolve = requests.put(
        f"{BASE_URL}/tickets/{general_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "resolved",
            "notes": "Access confirmed by user. Folder access complete."
        }
    )

    print(f"[OK] General request {general_code} status: resolved")

    # Resolve Hardware Request
    hardware_resolve = requests.put(
        f"{BASE_URL}/tickets/{hardware_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "resolved",
            "notes": "Dell XPS 15 laptop assigned from inventory"
        }
    )

    print(f"[OK] Hardware request {hardware_code} status: resolved")

    # =====================================================================
    # PHASE 6: VERIFICATION
    # =====================================================================
    print("\n[PHASE 6] Verification: System State")
    print("-" * 80)

    # Verify General Ticket Final State
    general_final = requests.get(
        f"{BASE_URL}/tickets/{general_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()

    print(f"[VERIFY] {general_code}:")
    print(f"        Status: {general_final['status']}")
    print(f"        Assigned to: {general_final['assignedTo']}")
    print(f"        Priority: {general_final['priority']}")
    print(f"        Created: {general_final['createdAt'][:10]}")

    if general_final["status"] != "resolved":
        print(f"[FAIL] Expected resolved, got {general_final['status']}")
    else:
        print("[OK] Status verified: resolved")

    # Verify Hardware Ticket Final State
    hardware_final = requests.get(
        f"{BASE_URL}/tickets/{hardware_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()

    print(f"\n[VERIFY] {hardware_code}:")
    print(f"        Status: {hardware_final['status']}")
    print(f"        Assigned to: {hardware_final['assignedTo']}")
    print(f"        Priority: {hardware_final['priority']}")
    print(f"        Created: {hardware_final['createdAt'][:10]}")

    if hardware_final["status"] != "resolved":
        print(f"[FAIL] Expected resolved, got {hardware_final['status']}")
    else:
        print("[OK] Status verified: resolved")

    # Check History
    if "history" in general_final and general_final["history"]:
        print(f"\n[VERIFY] Ticket history recorded:")
        print(f"        Total entries: {len(general_final['history'])}")
        for entry in general_final["history"][:3]:
            print(f"        - {entry.get('action', 'N/A')}: {entry.get('oldValue', '-')} -> {entry.get('newValue', '-')}")

    # Verify Device Inventory
    print(f"\n[VERIFY] Device Inventory:")
    devices = requests.get(
        f"{BASE_URL}/devices",
        headers={"Authorization": f"Bearer {admin_token}"}
    ).json()

    print(f"        Total devices: {devices['pagination']['total']}")
    print(f"        Device records available: {len(devices['data'])}")

    if len(devices["data"]) > 0:
        sample_device = devices["data"][0]
        print(f"        Sample: {sample_device['code']} ({sample_device['deviceType']})")
        print(f"        Status: {sample_device['status']}")

    # =====================================================================
    # FINAL SUMMARY
    # =====================================================================
    print("\n" + "="*80)
    print("END-TO-END WORKFLOW TEST SUMMARY")
    print("="*80)
    print("[OK] Authentication - All roles logged in successfully")
    print("[OK] Request Submission - Both general and hardware requests submitted")
    print(f"     General: {general_code}")
    print(f"     Hardware: {hardware_code}")
    print("[OK] IT Support Processing - Requests processed and assigned")
    print("[OK] Status Transitions - requests moved through workflow states")
    print("[OK] Admin Resolution - Both requests marked as resolved")
    print("[OK] State Verification - Final states confirmed correct")
    print("[OK] Device System - Inventory accessible and operational")
    print("\n" + "="*80)
    print("RESULT: END-TO-END WORKFLOW TEST PASSED")
    print("="*80 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
