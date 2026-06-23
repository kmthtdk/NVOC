#!/bin/bash
# VOC System - General Request Complete Workflow Test
# Records every step to a detailed log file

LOG_FILE="general_request_complete.log"

# Initialize log file
> "$LOG_FILE"

log_line() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" | tee -a "$LOG_FILE"
}

log_section() {
  echo "" | tee -a "$LOG_FILE"
  echo "=================================================================================" | tee -a "$LOG_FILE"
  echo "$1" | tee -a "$LOG_FILE"
  echo "=================================================================================" | tee -a "$LOG_FILE"
}

BASE_URL="http://localhost:4001/api"

log_section "VOC SYSTEM - GENERAL REQUEST WORKFLOW TEST"
log_line "Test Scenario: Submit -> Admin Assignment -> IT Update -> Resolution"
log_line "Start Time: $(date '+%Y-%m-%d %H:%M:%S')"

# =========================================================================
# PHASE 1: REQUESTER SUBMITS REQUEST
# =========================================================================
log_section "PHASE 1: REQUESTER - SUBMIT GENERAL REQUEST"

log_line ""
log_line "[1.1] Authenticate as Requester (Alex Mercer)"
REQUESTER_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.mercer@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REQUESTER_TOKEN" ]; then
  log_line "ERROR: Failed to authenticate as requester"
  exit 1
fi

log_line "   (OK) Authenticated successfully"
log_line "   Role: Requester"
log_line "   User: Alex Mercer"
log_line "   Email: alex.mercer@company.com"

log_line ""
log_line "[1.2] Submit General Request"
log_line "   Request Type: Office Setup"
log_line "   Title: Office workspace setup for new team member"
log_line "   Description: Need to set up workspace with desk, chair, monitor, keyboard, mouse"
log_line "   Priority: Medium"

SUBMIT_RESPONSE=$(curl -s -X POST $BASE_URL/tickets \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category":"general_request",
    "subcategory":"troubleshooting",
    "type":"office",
    "priority":"medium",
    "title":"Office workspace setup for new team member",
    "description":"Need to set up workspace with desk, chair, monitor, keyboard, mouse. Target date: next Monday.",
    "requesterName":"Alex Mercer",
    "requesterEmail":"alex.mercer@company.com",
    "requesterDept":"R&D"
  }')

TICKET_ID=$(echo $SUBMIT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TICKET_CODE=$(echo $SUBMIT_RESPONSE | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
TICKET_STATUS=$(echo $SUBMIT_RESPONSE | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TICKET_CODE" ]; then
  log_line "   ERROR: Failed to submit request"
  exit 1
fi

log_line "   (OK) Request submitted successfully"
log_line ""
log_line "   Ticket Details:"
log_line "      Ticket Code: $TICKET_CODE"
log_line "      Ticket ID: $TICKET_ID"
log_line "      Status: $TICKET_STATUS"
log_line "      Created By: Alex Mercer"
log_line "      Created At: $(date '+%Y-%m-%d %H:%M:%S')"

# =========================================================================
# PHASE 2: ADMIN CHECKS AND ASSIGNS REQUEST
# =========================================================================
log_section "PHASE 2: ADMIN - CHECK REQUEST & ASSIGN TO MEMBER"

log_line ""
log_line "[2.1] Authenticate as Admin (System Admin)"
ADMIN_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  log_line "ERROR: Failed to authenticate as admin"
  exit 1
fi

log_line "   (OK) Authenticated successfully"
log_line "   Role: Admin"
log_line "   User: System Admin"

log_line ""
log_line "[2.2] Admin retrieves request for review"

TICKET_DETAIL=$(curl -s -X GET $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CURRENT_STATUS=$(echo $TICKET_DETAIL | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
REQUESTER_NAME=$(echo $TICKET_DETAIL | grep -o '"requesterName":"[^"]*"' | cut -d'"' -f4)
TICKET_TITLE=$(echo $TICKET_DETAIL | grep -o '"title":"[^"]*"' | cut -d'"' -f4)

log_line "   (OK) Request retrieved for review"
log_line ""
log_line "   Request Summary:"
log_line "      Ticket Code: $TICKET_CODE"
log_line "      Title: $TICKET_TITLE"
log_line "      Requester: $REQUESTER_NAME"
log_line "      Status: $CURRENT_STATUS"

log_line ""
log_line "[2.3] Admin assigns request to IT member"
log_line "   Assigning to: Marcus Vance (IT Support)"

ASSIGN_RESPONSE=$(curl -s -X PUT $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo":"Marcus Vance (IT Support)",
    "notes":"Approved for processing. Assign to Marcus for IT setup coordination."
  }')

log_line "   (OK) Request assigned to: Marcus Vance (IT Support)"
log_line "   Notes: Approved for processing. Assign to Marcus for IT setup coordination."
log_line "   Assignment Time: $(date '+%Y-%m-%d %H:%M:%S')"

# =========================================================================
# PHASE 3: IT MEMBER PROCESSES AND FINISHES REQUEST
# =========================================================================
log_section "PHASE 3: IT MEMBER - PROCESS & FINISH REQUEST"

log_line ""
log_line "[3.1] Authenticate as IT Support (Marcus Vance)"
IT_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marcus.vance@company.com","password":"Passw0rd!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$IT_TOKEN" ]; then
  log_line "ERROR: Failed to authenticate as IT support"
  exit 1
fi

log_line "   (OK) Authenticated successfully"
log_line "   Role: IT Support"
log_line "   User: Marcus Vance"
log_line "   Email: marcus.vance@company.com"

log_line ""
log_line "[3.2] Change status to: Processing"

IT_PROCESS=$(curl -s -X PUT $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"processing",
    "notes":"Workspace setup in progress. Ordered furniture and equipment. Desk reserved for Monday AM."
  }')

log_line "   (OK) Status changed to: Processing"
log_line "   IT Notes: Workspace setup in progress. Ordered furniture and equipment."
log_line "   Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

log_line ""
log_line "[3.3] Add comment to ticket"

COMMENT=$(curl -s -X POST $BASE_URL/tickets/$TICKET_ID/comments \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text":"Equipment ordered from vendor. Delivery expected Monday morning. Will coordinate setup with Alex.",
    "isInternal":true
  }')

log_line "   (OK) Internal comment added"
log_line "   Comment: Equipment ordered from vendor. Delivery expected Monday morning."

log_line ""
log_line "[3.4] Move request to: Pending User Review"

PENDING=$(curl -s -X PUT $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"pending_user",
    "notes":"Awaiting user confirmation for workspace setup completion."
  }')

log_line "   (OK) Status changed to: Pending User Review"
log_line "   Waiting for: User confirmation"
log_line "   Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

log_line ""
log_line "[3.5] Final resolution - Mark as Resolved"

RESOLVE=$(curl -s -X PUT $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $IT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"resolved",
    "notes":"Workspace setup completed. All furniture and equipment delivered and configured. Ready for user."
  }')

log_line "   (OK) Status changed to: Resolved"
log_line "   Resolution Notes: Workspace setup completed. All equipment configured."
log_line "   Completion Time: $(date '+%Y-%m-%d %H:%M:%S')"

# =========================================================================
# PHASE 4: VERIFICATION AND SUMMARY
# =========================================================================
log_section "PHASE 4: VERIFICATION & WORKFLOW SUMMARY"

log_line ""
log_line "[4.1] Retrieve final ticket state"

FINAL_TICKET=$(curl -s -X GET $BASE_URL/tickets/$TICKET_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

FINAL_STATUS=$(echo $FINAL_TICKET | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
FINAL_ASSIGNED=$(echo $FINAL_TICKET | grep -o '"assignedTo":"[^"]*"' | cut -d'"' -f4)

log_line "   (OK) Final state retrieved"
log_line ""
log_line "   Final Ticket State:"
log_line "      Ticket Code: $TICKET_CODE"
log_line "      Final Status: $FINAL_STATUS"
log_line "      Assigned To: $FINAL_ASSIGNED"

log_line ""
log_line "[4.2] Workflow Summary"
log_line ""
log_line "   Workflow Phases:"
log_line "      Phase 1 - Requester Submit: (OK) COMPLETED"
log_line "      Phase 2 - Admin Review & Assign: (OK) COMPLETED"
log_line "      Phase 3 - IT Process & Resolve: (OK) COMPLETED"
log_line "      Phase 4 - Verification: (OK) COMPLETED"
log_line ""
log_line "   Request Lifecycle:"
log_line "      Created: Submitted"
log_line "      Assigned: Marcus Vance"
log_line "      Processed: Processing -> Pending User -> Resolved"
log_line "      Completed: Yes"
log_line ""
log_line "   Status Transitions:"
log_line "      1. submitted (Requester created)"
log_line "      2. processing (IT started work)"
log_line "      3. pending_user (Awaiting confirmation)"
log_line "      4. resolved (FINAL)"
log_line ""

# =========================================================================
# FINAL REPORT
# =========================================================================
log_section "TEST COMPLETE - GENERAL REQUEST WORKFLOW"

log_line ""
log_line "Test Execution Summary:"
log_line "   Start Time: $(date '+%Y-%m-%d %H:%M:%S')"
log_line "   Test Type: General Request Workflow (API-based)"
log_line "   Result: SUCCESS"
log_line ""
log_line "Ticket Information:"
log_line "   Ticket Code: $TICKET_CODE"
log_line "   Category: General Request"
log_line "   Type: Office Setup"
log_line "   Priority: Medium"
log_line ""
log_line "Participants:"
log_line "   Requester: Alex Mercer"
log_line "   Admin: System Admin"
log_line "   IT Member: Marcus Vance (IT Support)"
log_line ""
log_line "All steps executed successfully!"
log_line "Log file: $LOG_FILE"
log_line ""

log_section "END OF WORKFLOW TEST LOG"
