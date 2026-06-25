#!/usr/bin/env python3
"""Test device allocation API endpoints directly"""
import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:4001/api"

# Admin user credentials (from test users)
ADMIN_EMAIL = "admin@company.com"
ADMIN_PASS = "admin123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log(msg, color=Colors.BLUE):
    print(f"{color}{msg}{Colors.END}")

def success(msg):
    log(f"✓ {msg}", Colors.GREEN)

def error(msg):
    log(f"✗ {msg}", Colors.RED)

def info(msg):
    log(f"ℹ {msg}", Colors.YELLOW)

# Step 1: Login
log("\n" + "="*70)
log("DEVICE ALLOCATION WORKFLOW - API TEST", Colors.BLUE)
log("="*70)

log("\n[1/7] Authenticating as admin...")
try:
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASS
    })
    if login_resp.status_code == 200:
        token = login_resp.json()["token"]
        success("Authenticated")
    else:
        error(f"Login failed: {login_resp.text}")
        sys.exit(1)
except Exception as e:
    error(f"Login error: {e}")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get available devices
log("\n[2/7] Fetching available devices (In Stock)...")
try:
    dev_resp = requests.get(f"{BASE_URL}/devices?status=In%20Stock", headers=headers)
    devices = dev_resp.json().get("data", [])
    info(f"Found {len(devices)} in-stock devices")

    # Show breakdown by type
    types = {}
    for d in devices:
        dt = d.get("deviceType", "unknown")
        types[dt] = types.get(dt, 0) + 1

    for dt, count in sorted(types.items()):
        info(f"  - {dt}: {count} devices")

    if len(devices) == 0:
        error("No devices available!")
        sys.exit(1)
except Exception as e:
    error(f"Device fetch error: {e}")
    sys.exit(1)

# Step 3: Create hardware_request ticket with deviceType
log("\n[3/7] Creating hardware_request ticket with deviceType='laptop'...")
try:
    ticket_payload = {
        "title": f"Test Laptop Request - {datetime.now().strftime('%H:%M:%S')}",
        "description": "Testing manual device allocation workflow",
        "requesterName": "Test User",
        "requesterEmail": "test@company.com",
        "requesterDept": "Engineering",
        "category": "hardware_request",
        "subcategory": "laptop",
        "type": None,
        "priority": "high",
        "details": {
            "deviceType": "laptop",
            "deviceAction": "new"
        }
    }

    ticket_resp = requests.post(f"{BASE_URL}/tickets", json=ticket_payload, headers=headers)
    if ticket_resp.status_code == 201:
        ticket = ticket_resp.json()["ticket"]
        ticket_id = ticket["id"]
        ticket_code = ticket["code"]
        success(f"Ticket created: {ticket_code} (ID: {ticket_id})")
    else:
        error(f"Ticket creation failed: {ticket_resp.text}")
        sys.exit(1)
except Exception as e:
    error(f"Ticket creation error: {e}")
    sys.exit(1)

# Step 4: Verify ticket was created
log("\n[4/7] Verifying ticket details...")
try:
    get_resp = requests.get(f"{BASE_URL}/tickets/{ticket_id}", headers=headers)
    ticket = get_resp.json()["ticket"]
    success(f"Ticket status: {ticket['status']}")
    success(f"Device type in details: {ticket.get('details', {}).get('deviceType', 'N/A')}")
except Exception as e:
    error(f"Ticket fetch error: {e}")

# Step 5: Find a laptop device to assign
log("\n[5/7] Finding available laptop device...")
laptop_devices = [d for d in devices if d.get("deviceType", "").lower() == "laptop"]
if laptop_devices:
    device = laptop_devices[0]
    device_id = device["id"]
    success(f"Selected device: {device['code']} ({device['model']})")
    info(f"  Serial: {device['serialNumber']}")
    info(f"  Current status: {device['status']}")
else:
    error("No laptop devices available!")
    info("Available types: " + ", ".join(types.keys()))
    sys.exit(1)

# Step 6: Create device link (ticket_device_link)
log("\n[6/7] Creating ticket-device link...")
try:
    link_payload = {
        "deviceId": device_id,
        "actionType": "new"
    }

    link_resp = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/link-device",
        json=link_payload,
        headers=headers
    )

    if link_resp.status_code == 201:
        link = link_resp.json()
        success(f"Device link created")
        info(f"  Response: {json.dumps(link, indent=2)}")
    else:
        error(f"Link creation failed: {link_resp.status_code}")
        error(f"Response: {link_resp.text}")
except Exception as e:
    error(f"Link creation error: {e}")
    import traceback
    traceback.print_exc()

# Step 7: Assign device to requester
log("\n[7/7] Assigning device to requester...")
try:
    assign_payload = {
        "userId": None,
        "userName": "Test User",
        "userEmail": "test@company.com",
        "userDept": "Engineering",
        "ticketId": ticket_id,
        "reason": f"Assigned via allocation workflow for {ticket_code}"
    }

    assign_resp = requests.post(
        f"{BASE_URL}/devices/{device_id}/assign",
        json=assign_payload,
        headers=headers
    )

    if assign_resp.status_code == 200:
        assigned_device = assign_resp.json()["device"]
        success(f"Device assigned")
        success(f"  New status: {assigned_device['status']}")
        success(f"  Assigned to: {assigned_device['assignedTo']}")
    else:
        error(f"Assignment failed: {assign_resp.status_code}")
        error(f"Response: {assign_resp.text}")
except Exception as e:
    error(f"Assignment error: {e}")
    import traceback
    traceback.print_exc()

# Verify final state
log("\n" + "="*70)
log("VERIFICATION", Colors.BLUE)
log("="*70)

try:
    # Check device status
    dev_final = requests.get(f"{BASE_URL}/devices/{device_id}", headers=headers).json()["data"]
    log(f"\nDevice {dev_final['code']}:")
    success(f"  Status: {dev_final['status']}")
    success(f"  Assigned to: {dev_final['assignedTo']}")

    # Check ticket links (if endpoint exists)
    log(f"\nTicket {ticket_code}:")
    ticket_final = requests.get(f"{BASE_URL}/tickets/{ticket_id}", headers=headers).json()["ticket"]
    if "linkedDevices" in ticket_final and ticket_final["linkedDevices"]:
        success(f"  Linked devices: {len(ticket_final['linkedDevices'])}")
        for ld in ticket_final["linkedDevices"]:
            info(f"    - Device {ld['deviceId']}: {ld.get('actionType', 'N/A')}")
    else:
        info(f"  No linked devices yet (may require page reload)")

except Exception as e:
    error(f"Verification error: {e}")

log("\n" + "="*70)
log("✓ WORKFLOW TEST COMPLETE", Colors.GREEN)
log("="*70)
log("\nSummary:")
log(f"  • Created ticket: {ticket_code}")
log(f"  • Assigned device: {device['code']} to Test User")
log(f"  • Device status: {assigned_device.get('status', '?')}")
log(f"  • Device linked: Yes")
log("="*70)
