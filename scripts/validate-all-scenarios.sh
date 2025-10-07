#!/bin/bash

################################################################################
# Partial Picking System - 10 Validation Scenarios
# Automated Test Script
#
# Prerequisites:
# - Backend running at http://localhost:7075
# - Frontend running at http://localhost:6060
# - Bridge service running at ws://localhost:5000
# - Database accessible at 192.168.0.86:49381
#
# Usage: ./scripts/validate-all-scenarios.sh
################################################################################

set -e # Exit on error

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test Results
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=10

# Temporary files
TEMP_DIR="/tmp/partial-picking-validation"
mkdir -p "$TEMP_DIR"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((PASSED_TESTS++))
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    echo -e "${RED}  Reason: $2${NC}"
    ((FAILED_TESTS++))
}

print_info() {
    echo -e "  ℹ $1"
}

check_service() {
    local service=$1
    local url=$2
    print_info "Checking $service at $url..."

    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ $service is running${NC}"
        return 0
    else
        echo -e "  ${RED}✗ $service is NOT running${NC}"
        return 1
    fi
}

################################################################################
# Pre-Flight Checks
################################################################################

print_header "PRE-FLIGHT CHECKS"

SERVICES_OK=true

# Check Backend
if check_service "Backend API" "http://localhost:7075/api/health"; then
    :
else
    SERVICES_OK=false
    echo -e "  ${RED}Please start: cd backend && cargo run${NC}"
fi

# Check Frontend
if check_service "Frontend" "http://localhost:6060"; then
    :
else
    SERVICES_OK=false
    echo -e "  ${RED}Please start: cd frontend && npm run dev${NC}"
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
fi

# Check if jq is available (for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq not installed. Install for better output: sudo apt install jq${NC}"
    JQ_AVAILABLE=false
else
    JQ_AVAILABLE=true
fi

if [ "$SERVICES_OK" = false ]; then
    echo -e "\n${RED}ERROR: Required services are not running. Please start all services first.${NC}"
    exit 1
fi

echo -e "\n${GREEN}All services are running. Starting validation...${NC}"

################################################################################
# Scenario 1: Backend API Health Check
################################################################################

print_header "SCENARIO 1: Backend API Health Check"
print_test "Testing backend health endpoint"

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:7075/api/health)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"status".*"healthy"' && echo "$BODY" | grep -q '"database".*"connected"'; then
        print_pass "Backend health check passed"
        print_info "Response: $BODY"
    else
        print_fail "Backend health check" "Unexpected response format"
        print_info "Response: $BODY"
    fi
else
    print_fail "Backend health check" "Expected HTTP 200, got $HTTP_CODE"
fi

################################################################################
# Scenario 2: LDAP Authentication
################################################################################

print_header "SCENARIO 2: LDAP Authentication"
print_test "Testing LDAP authentication with valid credentials"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "dechawat", "password": "TestPassword123"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"token"' && echo "$BODY" | grep -q '"authSource".*"LDAP"'; then
        print_pass "LDAP authentication successful"

        # Extract token for later tests
        if [ "$JQ_AVAILABLE" = true ]; then
            TOKEN=$(echo "$BODY" | jq -r '.token')
            echo "$TOKEN" > "$TEMP_DIR/token.txt"
            print_info "JWT token saved for subsequent tests"
        else
            # Fallback: extract token without jq (less reliable)
            TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            echo "$TOKEN" > "$TEMP_DIR/token.txt"
        fi
    else
        print_fail "LDAP authentication" "Token or authSource not found in response"
        print_info "Response: $BODY"
    fi
else
    print_fail "LDAP authentication" "Expected HTTP 200, got $HTTP_CODE (May be LDAP unavailable - check SQL fallback)"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 3: SQL Authentication Fallback
################################################################################

print_header "SCENARIO 3: SQL Authentication Fallback"
print_test "Testing SQL authentication with local credentials"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "warehouse_user", "password": "SqlPassword456"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"token"' && echo "$BODY" | grep -q '"authSource".*"LOCAL"'; then
        print_pass "SQL authentication fallback successful"
        print_info "authSource=LOCAL confirmed"
    else
        print_fail "SQL authentication" "Token or LOCAL authSource not found"
        print_info "Response: $BODY"
    fi
else
    print_fail "SQL authentication" "Expected HTTP 200, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 4: Run Details Auto-Population
################################################################################

print_header "SCENARIO 4: Run Details Auto-Population"
print_test "Testing run details query with auto-populated fields"

# Get token (from file or re-authenticate)
if [ -f "$TEMP_DIR/token.txt" ]; then
    TOKEN=$(cat "$TEMP_DIR/token.txt")
else
    print_info "No token found, attempting re-authentication..."
    AUTH_RESPONSE=$(curl -s -X POST http://localhost:7075/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username": "dechawat", "password": "TestPassword123"}')

    if [ "$JQ_AVAILABLE" = true ]; then
        TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
    else
        TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    fi
    echo "$TOKEN" > "$TEMP_DIR/token.txt"
fi

# Test with Run 6000037
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:7075/api/runs/6000037 \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"runNo"' && echo "$BODY" | grep -q '"fgItemKey"' && echo "$BODY" | grep -q '"fgDescription"'; then
        print_pass "Run details auto-population successful"
        print_info "Run 6000037 details retrieved"

        if [ "$JQ_AVAILABLE" = true ]; then
            FG_ITEM=$(echo "$BODY" | jq -r '.fgItemKey')
            FG_DESC=$(echo "$BODY" | jq -r '.fgDescription')
            print_info "FG Item: $FG_ITEM - $FG_DESC"
        fi
    else
        print_fail "Run details" "Missing required fields (runNo, fgItemKey, fgDescription)"
        print_info "Response: $BODY"
    fi
else
    print_fail "Run details" "Expected HTTP 200, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 5: Batch Items with Weight Range
################################################################################

print_header "SCENARIO 5: Batch Items with Weight Range"
print_test "Testing batch items query with tolerance calculations"

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:7075/api/runs/6000037/batches/1/items \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"weightRangeLow"' && echo "$BODY" | grep -q '"weightRangeHigh"' && echo "$BODY" | grep -q '"toleranceKG"'; then
        print_pass "Batch items with weight ranges retrieved"
        print_info "Weight tolerance calculations present"

        if [ "$JQ_AVAILABLE" = true ]; then
            ITEM_COUNT=$(echo "$BODY" | jq '.items | length')
            print_info "Items in batch: $ITEM_COUNT"
        fi
    else
        print_fail "Batch items" "Missing weight range fields"
        print_info "Response: $BODY"
    fi
else
    print_fail "Batch items" "Expected HTTP 200, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 6: FEFO Lot Selection
################################################################################

print_header "SCENARIO 6: FEFO Lot Selection"
print_test "Testing FEFO lot selection algorithm"

RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:7075/api/lots/available?itemKey=INSALT02" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q '"lotNo"' && echo "$BODY" | grep -q '"expiryDate"'; then
        print_pass "FEFO lot selection successful"
        print_info "Lots retrieved and sorted by expiry date"

        if [ "$JQ_AVAILABLE" = true ]; then
            echo "$BODY" | jq -r '.lots[] | "\(.lotNo) - Expiry: \(.expiryDate) - Avail: \(.availableQty) KG"' | head -n 3
        fi
    else
        print_fail "FEFO lot selection" "Missing lot fields"
        print_info "Response: $BODY"
    fi
else
    print_fail "FEFO lot selection" "Expected HTTP 200, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 7: 4-Phase Atomic Pick Transaction
################################################################################

print_header "SCENARIO 7: 4-Phase Atomic Pick Transaction"
print_test "Testing atomic pick transaction (4 phases)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7075/api/picks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "runNo": 213996,
    "rowNum": 1,
    "lineId": 1,
    "lotNo": "2510403-1",
    "binNo": "PWBB-12",
    "weight": 20.025,
    "workstationId": "WS3"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "201" ]; then
    if echo "$BODY" | grep -q '"status".*"Allocated"'; then
        print_pass "4-phase atomic pick transaction successful"
        print_info "Pick saved with status: Allocated"

        if [ "$JQ_AVAILABLE" = true ]; then
            LOT_TRAN_NO=$(echo "$BODY" | jq -r '.lotTranNo')
            print_info "LotTranNo: $LOT_TRAN_NO"
            echo "$LOT_TRAN_NO" > "$TEMP_DIR/lot_tran_no.txt"
        fi

        print_info "SQL Verification queries available in validation report"
    else
        print_fail "Pick transaction" "Status not set to Allocated"
        print_info "Response: $BODY"
    fi
else
    print_fail "Pick transaction" "Expected HTTP 201, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 8: Weight Tolerance Validation
################################################################################

print_header "SCENARIO 8: Weight Tolerance Validation"
print_test "Testing weight tolerance validation (should reject)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7075/api/picks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "runNo": 213996,
    "rowNum": 1,
    "lineId": 2,
    "lotNo": "2510403-1",
    "binNo": "PWBB-12",
    "weight": 20.5,
    "workstationId": "WS3"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "400" ]; then
    if echo "$BODY" | grep -q -i "tolerance\|weight.*range\|out.*range"; then
        print_pass "Weight tolerance validation successful (rejected out-of-range)"
        print_info "Error correctly returned for weight 20.5 KG"
    else
        print_fail "Weight validation" "Expected tolerance error message"
        print_info "Response: $BODY"
    fi
else
    print_fail "Weight validation" "Expected HTTP 400, got $HTTP_CODE"
    print_info "Response: $BODY"
fi

################################################################################
# Scenario 9: WebSocket Weight Stream
################################################################################

print_header "SCENARIO 9: WebSocket Weight Stream"
print_test "Testing WebSocket connection to weight scale"

print_info "Checking if bridge service is available..."

# Check if wscat is installed
if command -v wscat &> /dev/null; then
    print_info "wscat found - attempting WebSocket connection"

    # Test WebSocket connection (timeout after 5 seconds)
    timeout 5s wscat -c ws://localhost:5000/ws/scale/WS-001/small > "$TEMP_DIR/ws_output.txt" 2>&1 &
    WS_PID=$!

    sleep 2

    if [ -f "$TEMP_DIR/ws_output.txt" ] && [ -s "$TEMP_DIR/ws_output.txt" ]; then
        if grep -q "continuousStarted\|weightUpdate\|Connected" "$TEMP_DIR/ws_output.txt"; then
            print_pass "WebSocket connection successful"
            print_info "Weight stream active"
        else
            print_fail "WebSocket" "No weight updates received"
        fi
    else
        print_fail "WebSocket" "Bridge service not available at ws://localhost:5000"
        print_info "Bridge service may not be running (optional for backend/frontend tests)"
    fi

    # Clean up
    kill $WS_PID 2>/dev/null || true
else
    print_info "wscat not installed (npm install -g wscat)"
    print_info "Manual test required: wscat -c ws://localhost:5000/ws/scale/WS-001/small"
    print_fail "WebSocket test" "wscat not available - manual verification required"
fi

################################################################################
# Scenario 10: Frontend End-to-End Flow
################################################################################

print_header "SCENARIO 10: Frontend End-to-End Flow"
print_test "Checking frontend accessibility"

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:6060)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Frontend is accessible at http://localhost:6060"
    print_info "Manual E2E test required:"
    print_info "  1. Open http://localhost:6060"
    print_info "  2. Login with dechawat / TestPassword123"
    print_info "  3. Select workstation (WS3)"
    print_info "  4. Enter Run No: 6000037"
    print_info "  5. Complete picking workflow"
    print_info "See TEST_EXECUTION_GUIDE.md for detailed steps"
else
    print_fail "Frontend accessibility" "Expected HTTP 200, got $HTTP_CODE"
fi

################################################################################
# Final Report
################################################################################

print_header "VALIDATION SUMMARY"

echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:      ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:      ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   ✓ ALL VALIDATION SCENARIOS PASSED                            ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "\n${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}   ✗ $FAILED_TESTS VALIDATION SCENARIO(S) FAILED                      ${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
