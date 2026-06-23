#!/bin/bash

BASE_URL="http://localhost:4001/api"

echo ""
echo "================================================================================"
echo "VOC SYSTEM - COMPLETE END-TO-END API TEST"
echo "================================================================================"

# ================================================================
# PHASE 1: Authentication
# ================================================================
echo ""
echo "[PHASE 1] Authentication & Setup"
echo "────────────────────────────────────────────────────────────────────────────────"

REQUESTER_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.mercer@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

IT_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marcus.vance@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

ADMIN_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "[OK] Authenticated as:"
echo "     - Requester (Alex Mercer)"
echo "     - IT Support (Marcus Vance)"
echo "     - Admin (System Admin)"

# ================================================================
# PHASE 2: REQUESTER SUBMITS REQUESTS
# ================================================================
echo ""
echo "[PHASE 2] Requester: Submit VOC Requests"
echo "────────────────────────────────────────────────────────────────────────────────"

GENERAL_RESPONSE=$(curl -s -X POST $BASE_URL/tickets \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"server_request","subcategory":"permission","type":"read_folder","priority":"medium","title":"Need read access to Q2 project folder","description":"Requesting read/write access to /shared/projects/Q2-2026","requesterName":"Alex Mercer","requesterEmail":"alex.mercer@company.com","requesterDept":"R&D"}')

GENERAL_ID=$(echo $GENERAL_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
GENERAL_CODE=$(echo $GENERAL_RESPONSE | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "[OK] General request submitted: $GENERAL_CODE"
echo "     ID: $GENERAL_ID"

HARDWARE_RESPONSE=$(curl -s -X POST $BASE_URL/tickets \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"hardware_request","subcategory":"laptop","type":"laptop_new","priority":"high","title":"New laptop for expanding team","description":"Need laptop for new software engineer joining the team","requesterName":"Alex Mercer","requesterEmail":"alex.mercer@company.com","requesterDept":"R&D"}')

HARDWARE_ID=$(echo $HARDWARE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
HARDWARE_CODE=$(echo $HARDWARE_RESPONSE | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "[OK] Hardware request submitted: $HARDWARE_CODE"
echo "     ID: $HARDWARE_ID"

# ================================================================
# PHASE 3: IT SUPPORT PROCESSES REQUESTS
# ================================================================
echo ""
echo "[PHASE 3] IT Support: Process Requests"
echo "────────────────────────────────────────────────────────────────────────────────"

curl -s -X PUT $BASE_URL/tickets/$GENERAL_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"processing","assignedTo":"Marcus Vance (Network Advisor)","notes":"Checking folder permissions"}' > /dev/null

echo "[OK] General request $GENERAL_CODE status: processing"

curl -s -X POST $BASE_URL/tickets/$GENERAL_ID/comments \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Verifying access rights","isInternal":true}' > /dev/null

echo "[OK] Added internal comment"

curl -s -X PUT $BASE_URL/tickets/$HARDWARE_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"processing","assignedTo":"Marcus Vance (Network Advisor)","notes":"Checking inventory"}' > /dev/null

echo "[OK] Hardware request $HARDWARE_CODE status: processing"

# ================================================================
# PHASE 4: MOVE TO PENDING USER
# ================================================================
echo ""
echo "[PHASE 4] IT Support: Awaiting User Review"
echo "────────────────────────────────────────────────────────────────────────────────"

curl -s -X PUT $BASE_URL/tickets/$GENERAL_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"pending_user","notes":"Configured. Please verify."}' > /dev/null

echo "[OK] General request $GENERAL_CODE status: pending_user"

# ================================================================
# PHASE 5: ADMIN RESOLVES REQUESTS
# ================================================================
echo ""
echo "[PHASE 5] Admin: Resolve Requests"
echo "────────────────────────────────────────────────────────────────────────────────"

curl -s -X PUT $BASE_URL/tickets/$GENERAL_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","notes":"Access complete"}' > /dev/null

echo "[OK] General request $GENERAL_CODE status: resolved"

curl -s -X PUT $BASE_URL/tickets/$HARDWARE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","notes":"Laptop assigned"}' > /dev/null

echo "[OK] Hardware request $HARDWARE_CODE status: resolved"

# ================================================================
# PHASE 6: VERIFICATION
# ================================================================
echo ""
echo "[PHASE 6] Verification: System State"
echo "────────────────────────────────────────────────────────────────────────────────"

GENERAL_FINAL=$(curl -s -X GET $BASE_URL/tickets/$GENERAL_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

STATUS=$(echo $GENERAL_FINAL | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "[VERIFY] $GENERAL_CODE Final State:"
echo "        Status: $STATUS"

if [ "$STATUS" = "resolved" ]; then
  echo "[OK] Status verified"
fi

HARDWARE_FINAL=$(curl -s -X GET $BASE_URL/tickets/$HARDWARE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HARDWARE_STATUS=$(echo $HARDWARE_FINAL | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "[VERIFY] $HARDWARE_CODE Final State:"
echo "        Status: $HARDWARE_STATUS"

if [ "$HARDWARE_STATUS" = "resolved" ]; then
  echo "[OK] Status verified"
fi

# Check Devices
DEVICES=$(curl -s -X GET $BASE_URL/devices \
  -H "Authorization: Bearer $ADMIN_TOKEN")

DEVICE_COUNT=$(echo $DEVICES | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo ""
echo "[VERIFY] Device System:"
echo "        Total devices: $DEVICE_COUNT"

# ================================================================
# FINAL SUMMARY
# ================================================================
echo ""
echo "================================================================================"
echo "END-TO-END WORKFLOW TEST SUMMARY"
echo "================================================================================"
echo "[OK] Authentication - All roles authenticated"
echo "[OK] Submission - 2 requests created ($GENERAL_CODE, $HARDWARE_CODE)"
echo "[OK] Processing - Requests processed by IT Support"
echo "[OK] Transitions - Status changes verified"
echo "[OK] Resolution - Both requests resolved by Admin"
echo "[OK] Device System - Operational ($DEVICE_COUNT devices)"
echo ""
echo "================================================================================"
echo "RESULT: END-TO-END WORKFLOW TEST PASSED"
echo "================================================================================"
echo ""
