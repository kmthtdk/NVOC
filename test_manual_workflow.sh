#!/bin/bash

# Manual Device Allocation Workflow Test
# Steps to test via admin dashboard:

echo "=========================================="
echo "MANUAL DEVICE ALLOCATION WORKFLOW TEST"
echo "=========================================="
echo ""
echo "Follow these steps in your browser:"
echo ""
echo "STEP 1: Open Admin Dashboard"
echo "  URL: http://localhost:3001/admin/simulation"
echo "  Expected: Login page"
echo ""
echo "STEP 2: Login"
echo "  Click 'Admin' tab at bottom"
echo "  Click 'Sign in' button"
echo "  Select any user"
echo "  Expected: Admin console with ticket list"
echo ""
echo "STEP 3: Find Hardware Request Ticket"
echo "  Look in 'TARGET TICKET' dropdown for a hardware_request"
echo "  Example: 'REQ-2024-0013 — Test User (Test Laptop Allocation...)'"
echo "  Click to select it"
echo "  Expected: Ticket details shown below"
echo ""
echo "STEP 4: Change Status to 'resolved'"
echo "  Click 'NEW STATUS' dropdown (currently shows 'In Progress')"
echo "  Select 'resolved'"
echo "  Expected: Status dropdown now shows 'resolved'"
echo ""
echo "STEP 5: Submit to Trigger Device Modal"
echo "  Click the blue 'Update' button at the bottom"
echo "  Expected: DeviceAssignmentModal appears with:"
echo "    - Modal title: 'Assign Device — [TICKET_CODE]'"
echo "    - List of available laptops (filtered by deviceType)"
echo "    - Radio buttons to select a device"
echo "    - 'Assign Device' button"
echo ""
echo "STEP 6: Select a Device"
echo "  Click on a laptop device radio button"
echo "  Expected: Device selected (radio button checked)"
echo ""
echo "STEP 7: Assign Device"
echo "  Click the 'Assign Device' button in the modal"
echo "  Expected:"
echo "    - Modal closes"
echo "    - Success toast: '[DEVICE_CODE] assigned to [USER]'"
echo "    - Ticket status updates to 'resolved'"
echo ""
echo "=========================================="
echo ""
echo "API Test Results:"
echo "=========================================="
echo ""
echo "STEP A: Create Ticket + Link Device + Assign (via API)"
echo ""

# API test from our earlier passing test
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Passw0rd!"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "[FAIL] Could not authenticate"
  exit 1
fi

echo "[OK] Authenticated as admin"

# Create ticket with deviceType='laptop'
TICKET=$(curl -s -X POST http://localhost:4001/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"title\": \"Manual Workflow Test $(date +%s)\",
    \"description\": \"Testing device allocation\",
    \"requesterName\": \"Test User\",
    \"requesterEmail\": \"test@company.com\",
    \"requesterDept\": \"Engineering\",
    \"category\": \"hardware_request\",
    \"subcategory\": \"laptop\",
    \"priority\": \"high\",
    \"details\": {\"deviceType\": \"laptop\", \"deviceAction\": \"new\"}
  }")

TICKET_ID=$(echo "$TICKET" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ticket',{}).get('id',''))" 2>/dev/null)
TICKET_CODE=$(echo "$TICKET" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ticket',{}).get('code',''))" 2>/dev/null)

if [ -z "$TICKET_ID" ]; then
  echo "[FAIL] Could not create ticket"
  exit 1
fi

echo "[OK] Created ticket: $TICKET_CODE"

# Get available laptop device
DEVICES=$(curl -s "http://localhost:4001/api/devices?status=In%20Stock" \
  -H "Authorization: Bearer $TOKEN")

DEVICE_ID=$(echo "$DEVICES" | python3 -c "import sys, json; d=json.load(sys.stdin); laptops=[x for x in d.get('data',[]) if 'laptop' in x.get('deviceType','').lower()]; print(laptops[0]['id'] if laptops else '')" 2>/dev/null)
DEVICE_CODE=$(echo "$DEVICES" | python3 -c "import sys, json; d=json.load(sys.stdin); laptops=[x for x in d.get('data',[]) if 'laptop' in x.get('deviceType','').lower()]; print(laptops[0]['code'] if laptops else '')" 2>/dev/null)

if [ -z "$DEVICE_ID" ]; then
  echo "[FAIL] No laptop devices available"
  exit 1
fi

echo "[OK] Found laptop: $DEVICE_CODE"

# Create device link
LINK=$(curl -s -X POST "http://localhost:4001/api/tickets/$TICKET_ID/link-device" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"deviceId\": $DEVICE_ID, \"actionType\": \"new\"}")

LINK_SUCCESS=$(echo "$LINK" | python3 -c "import sys, json; r=json.load(sys.stdin); print('yes' if r.get('success') or r.get('ticketId') else 'no')" 2>/dev/null)

if [ "$LINK_SUCCESS" = "yes" ]; then
  echo "[OK] Created device link"
else
  echo "[FAIL] Could not create device link"
fi

# Assign device
ASSIGN=$(curl -s -X POST "http://localhost:4001/api/devices/$DEVICE_ID/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"userId\": null,
    \"userName\": \"Test User\",
    \"userEmail\": \"test@company.com\",
    \"userDept\": \"Engineering\",
    \"ticketId\": \"$TICKET_ID\",
    \"reason\": \"Manual workflow test\"
  }")

ASSIGN_STATUS=$(echo "$ASSIGN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('device',{}).get('status',''))" 2>/dev/null)
ASSIGN_TO=$(echo "$ASSIGN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('device',{}).get('assignedTo',''))" 2>/dev/null)

if [ -n "$ASSIGN_STATUS" ] && [ "$ASSIGN_STATUS" = "Active" ]; then
  echo "[OK] Device assigned to $ASSIGN_TO with status: $ASSIGN_STATUS"
else
  echo "[FAIL] Device assignment failed"
fi

echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "API Test: Ticket=$TICKET_CODE, Device=$DEVICE_CODE, Status=$ASSIGN_STATUS"
echo ""
echo "Next Step: Test UI workflow at http://localhost:3001/admin/simulation"
echo "=========================================="
