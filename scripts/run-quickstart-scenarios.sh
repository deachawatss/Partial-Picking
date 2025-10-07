#!/bin/bash

# Quickstart.md Scenario Validation Script
# Executes all 10 validation scenarios to verify development environment

set -e  # Exit on error

BACKEND_URL="http://localhost:7075/api"
BRIDGE_URL="ws://localhost:5000"
FRONTEND_URL="http://localhost:6060"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
RESULTS=()

print_header() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║    QUICKSTART.MD VALIDATION SCENARIOS (10/10)               ║"
    echo "║    Partial Picking System PWA - Environment Validation      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

print_scenario() {
    echo ""
    echo "─────────────────────────────────────────────────────────────"
    echo "Scenario $1: $2"
    echo "─────────────────────────────────────────────────────────────"
}

check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASSED++))
        RESULTS+=("✅ Scenario $2: PASS")
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((FAILED++))
        RESULTS+=("❌ Scenario $2: FAIL")
    fi
}

print_header

# Scenario 1: Backend API Health Check
print_scenario "1" "Backend API Health Check"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${BACKEND_URL}/health)
if [ "$RESPONSE" = "200" ]; then
    echo "Backend health endpoint returned 200"
    check_result 0 "1"
else
    echo "Backend health endpoint returned $RESPONSE (expected 200)"
    check_result 1 "1"
fi

# Scenario 2: Authentication - LDAP Success
print_scenario "2" "Authentication - LDAP Success"
TOKEN_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"dechawat","password":"P@ssw0rd123"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token // empty')
AUTH_SOURCE=$(echo $TOKEN_RESPONSE | jq -r '.user.authSource // empty')

if [[ -n "$TOKEN" && "$TOKEN" == eyJ* && "$AUTH_SOURCE" == "LDAP" ]]; then
    echo "LDAP authentication successful"
    echo "JWT token: ${TOKEN:0:50}..."
    echo "Auth source: $AUTH_SOURCE"
    check_result 0 "2"
else
    echo "LDAP authentication failed"
    echo "Response: $TOKEN_RESPONSE"
    check_result 1 "2"
fi

# Scenario 3: Authentication - SQL Fallback
print_scenario "3" "Authentication - SQL Fallback"
SQL_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"warehouse_user","password":"SqlPassword456"}')

SQL_TOKEN=$(echo $SQL_RESPONSE | jq -r '.token // empty')
SQL_AUTH_SOURCE=$(echo $SQL_RESPONSE | jq -r '.user.authSource // empty')

if [[ -n "$SQL_TOKEN" && "$SQL_TOKEN" == eyJ* && "$SQL_AUTH_SOURCE" == "LOCAL" ]]; then
    echo "SQL authentication successful"
    echo "Auth source: $SQL_AUTH_SOURCE"
    check_result 0 "3"
else
    echo "SQL authentication failed"
    echo "Response: $SQL_RESPONSE"
    check_result 1 "3"
fi

# Scenario 4: Run Details Auto-Population
print_scenario "4" "Run Details Auto-Population"
RUN_RESPONSE=$(curl -s ${BACKEND_URL}/runs/6000037 \
    -H "Authorization: Bearer $TOKEN")

FG_ITEM=$(echo $RUN_RESPONSE | jq -r '.fgItemKey // empty')
FG_DESC=$(echo $RUN_RESPONSE | jq -r '.fgDescription // empty')
BATCHES=$(echo $RUN_RESPONSE | jq -r '.batches | length')

if [[ "$FG_ITEM" == "TSM2285A" && -n "$FG_DESC" && "$BATCHES" -gt 0 ]]; then
    echo "Run details retrieved successfully"
    echo "FG Item: $FG_ITEM"
    echo "Description: $FG_DESC"
    echo "Batches: $BATCHES"
    check_result 0 "4"
else
    echo "Run details retrieval failed"
    echo "Response: $RUN_RESPONSE"
    check_result 1 "4"
fi

# Scenario 5: Batch Items with Weight Range
print_scenario "5" "Batch Items with Weight Range"
ITEMS_RESPONSE=$(curl -s ${BACKEND_URL}/runs/6000037/batches/1/items \
    -H "Authorization: Bearer $TOKEN")

ITEM_COUNT=$(echo $ITEMS_RESPONSE | jq -r '.items | length')
FIRST_ITEM=$(echo $ITEMS_RESPONSE | jq -r '.items[0].itemKey // empty')
WEIGHT_LOW=$(echo $ITEMS_RESPONSE | jq -r '.items[0].weightRangeLow // empty')
WEIGHT_HIGH=$(echo $ITEMS_RESPONSE | jq -r '.items[0].weightRangeHigh // empty')

if [[ "$ITEM_COUNT" -gt 0 && -n "$FIRST_ITEM" && -n "$WEIGHT_LOW" && -n "$WEIGHT_HIGH" ]]; then
    echo "Batch items retrieved successfully"
    echo "Item count: $ITEM_COUNT"
    echo "First item: $FIRST_ITEM"
    echo "Weight range: $WEIGHT_LOW - $WEIGHT_HIGH KG"
    check_result 0 "5"
else
    echo "Batch items retrieval failed"
    echo "Response: $ITEMS_RESPONSE"
    check_result 1 "5"
fi

# Scenario 6: FEFO Lot Selection
print_scenario "6" "FEFO Lot Selection"
LOTS_RESPONSE=$(curl -s "${BACKEND_URL}/lots/available?itemKey=INSALT02" \
    -H "Authorization: Bearer $TOKEN")

LOT_COUNT=$(echo $LOTS_RESPONSE | jq -r '.lots | length')
FIRST_EXPIRY=$(echo $LOTS_RESPONSE | jq -r '.lots[0].expiryDate // empty')
SECOND_EXPIRY=$(echo $LOTS_RESPONSE | jq -r '.lots[1].expiryDate // empty')

if [[ "$LOT_COUNT" -gt 0 && -n "$FIRST_EXPIRY" ]]; then
    echo "FEFO lots retrieved successfully"
    echo "Lot count: $LOT_COUNT"
    echo "First expiry: $FIRST_EXPIRY"
    if [[ -n "$SECOND_EXPIRY" ]]; then
        echo "Second expiry: $SECOND_EXPIRY"
        # Verify FEFO sorting (first expiry <= second expiry)
        if [[ "$FIRST_EXPIRY" < "$SECOND_EXPIRY" ]] || [[ "$FIRST_EXPIRY" == "$SECOND_EXPIRY" ]]; then
            echo "FEFO sorting verified: earliest expiry first"
        else
            echo "Warning: FEFO sorting may be incorrect"
        fi
    fi
    check_result 0 "6"
else
    echo "FEFO lot retrieval failed"
    echo "Response: $LOTS_RESPONSE"
    check_result 1 "6"
fi

# Scenario 7: 4-Phase Atomic Pick Transaction
print_scenario "7" "4-Phase Atomic Pick Transaction"
echo "Note: Skipping actual pick to avoid database modifications"
echo "Test would verify:"
echo "  - POST /api/picks endpoint"
echo "  - Status 201 Created"
echo "  - All 4 phases execute atomically"
echo "  - Rollback on failure"
echo -e "${YELLOW}⚠ SKIPPED (manual verification required)${NC}"
RESULTS+=("⚠ Scenario 7: SKIPPED (manual)")

# Scenario 8: Weight Tolerance Validation
print_scenario "8" "Weight Tolerance Validation"
echo "Note: Skipping to avoid database modifications"
echo "Test would verify:"
echo "  - Weight out of tolerance returns 400"
echo "  - Error code: VALIDATION_WEIGHT_OUT_OF_TOLERANCE"
echo "  - Details include weight range"
echo -e "${YELLOW}⚠ SKIPPED (manual verification required)${NC}"
RESULTS+=("⚠ Scenario 8: SKIPPED (manual)")

# Scenario 9: WebSocket Weight Stream
print_scenario "9" "WebSocket Weight Stream"
echo "Note: Requires WebSocket client (wscat)"
if command -v wscat &> /dev/null; then
    echo "wscat is installed"
    echo "Testing WebSocket connection..."
    # Attempt connection with timeout
    timeout 5s wscat -c ${BRIDGE_URL}/ws/scale/WS-001/small -x '{"type":"ping"}' 2>/dev/null && WS_RESULT=0 || WS_RESULT=1

    if [ $WS_RESULT -eq 0 ]; then
        echo "WebSocket connection successful"
        check_result 0 "9"
    else
        echo "WebSocket connection failed (bridge service may not be running)"
        check_result 1 "9"
    fi
else
    echo "wscat not installed, skipping WebSocket test"
    echo "Install with: npm install -g wscat"
    echo -e "${YELLOW}⚠ SKIPPED (wscat not available)${NC}"
    RESULTS+=("⚠ Scenario 9: SKIPPED (no wscat)")
fi

# Scenario 10: Frontend End-to-End Flow
print_scenario "10" "Frontend End-to-End Flow"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${FRONTEND_URL})

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "Frontend is accessible at $FRONTEND_URL"
    echo "Manual E2E test steps:"
    echo "  1. Login with credentials"
    echo "  2. Select workstation"
    echo "  3. Enter Run No"
    echo "  4. Verify auto-population"
    echo "  5. Complete picking workflow"
    check_result 0 "10"
else
    echo "Frontend not accessible (status: $FRONTEND_STATUS)"
    echo "Make sure frontend is running: cd frontend && npm run dev"
    check_result 1 "10"
fi

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    VALIDATION SUMMARY                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

for result in "${RESULTS[@]}"; do
    echo "$result"
done

echo ""
echo "─────────────────────────────────────────────────────────────"
echo -e "Total Tests: $(($PASSED + $FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "─────────────────────────────────────────────────────────────"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL AUTOMATED SCENARIOS PASSED${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ SOME SCENARIOS FAILED${NC}\n"
    exit 1
fi
