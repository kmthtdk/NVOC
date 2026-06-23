#!/bin/bash
# Test: Check if Requester can see Admin tab after login

BASE_URL="http://localhost:4001/api"

echo "================================================================"
echo "TEST: Verify role returned from login endpoint"
echo "================================================================"
echo ""

echo "[1] Login as Requester and check role in response"
RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.mercer@company.com","password":"Passw0rd!"}')

echo "Full Response:"
echo $RESPONSE | python3 -m json.tool 2>/dev/null || echo $RESPONSE

echo ""
echo "[2] Extract role from response"
ROLE=$(echo $RESPONSE | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
echo "Role returned: $ROLE"

echo ""
echo "[3] Expected: requester"
echo "Actual: $ROLE"

if [ "$ROLE" = "requester" ]; then
  echo "Status: OK - Correct role"
else
  echo "Status: ERROR - Wrong role returned!"
fi

echo ""
echo "[4] Login as IT Support and check role"
IT_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marcus.vance@company.com","password":"Passw0rd!"}')

IT_ROLE=$(echo $IT_RESPONSE | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
echo "IT Support role: $IT_ROLE"

echo ""
echo "[5] Login as Admin and check role"
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Passw0rd!"}')

ADMIN_ROLE=$(echo $ADMIN_RESPONSE | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
echo "Admin role: $ADMIN_ROLE"

echo ""
echo "================================================================"
echo "SUMMARY"
echo "================================================================"
echo "Requester:  $ROLE (should be 'requester')"
echo "IT Support: $IT_ROLE (should be 'it_support')"
echo "Admin:      $ADMIN_ROLE (should be 'admin')"
echo ""
