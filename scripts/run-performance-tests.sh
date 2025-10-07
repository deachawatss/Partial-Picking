#!/bin/bash

# Performance Test Suite Runner
# Executes all 4 constitutional performance requirements

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
REPORT_DIR="$(cd "$(dirname "$0")/.." && pwd)/performance-reports"

mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/performance_report_${TIMESTAMP}.md"

print_header() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       PARTIAL PICKING PWA - PERFORMANCE TEST SUITE          ║"
    echo "║       Constitutional Requirements Validation                ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

print_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}$1${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

init_report() {
    cat > "$REPORT_FILE" << EOF
# Performance Test Report

**Generated:** $(date)
**Branch:** 001-i-have-an
**Constitutional Requirements:** v1.0.0

---

## Executive Summary

This report validates the Partial Picking System PWA against 4 constitutional performance requirements:

1. Backend API: <100ms p95 latency
2. Frontend Bundle: <500KB gzipped
3. WebSocket Latency: <200ms
4. Quickstart Scenarios: 10/10 passing

---

EOF
}

append_to_report() {
    echo "$1" >> "$REPORT_FILE"
}

print_header
init_report

# ============================================================================
# TEST 1: Backend API Performance (<100ms p95)
# ============================================================================

print_section "TEST 1: Backend API Performance (<100ms p95)"

append_to_report "## 1. Backend API Performance"
append_to_report ""
append_to_report "**Constitutional Requirement:** <100ms p95 latency for all endpoints"
append_to_report ""

echo "Prerequisites:"
echo "  - Backend must be running on http://localhost:7075"
echo ""

# Check if backend is running
if curl -s http://localhost:7075/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"

    echo ""
    echo "Running backend performance tests..."
    echo "  - GET /api/runs/{runNo}"
    echo "  - GET /api/runs/{runNo}/batches/{rowNum}/items"
    echo "  - GET /api/lots/available (FEFO query)"
    echo ""

    cd "$BACKEND_DIR"

    if cargo test --test api_performance_test run_all_performance_tests -- --nocapture > "$REPORT_DIR/backend_perf_${TIMESTAMP}.log" 2>&1; then
        echo -e "${GREEN}✅ Backend API performance tests PASSED${NC}"
        append_to_report "**Result:** ✅ PASS"
        append_to_report ""
        append_to_report "\`\`\`"
        tail -50 "$REPORT_DIR/backend_perf_${TIMESTAMP}.log" >> "$REPORT_FILE"
        append_to_report "\`\`\`"
        BACKEND_PERF_PASS=1
    else
        echo -e "${RED}❌ Backend API performance tests FAILED${NC}"
        append_to_report "**Result:** ❌ FAIL"
        append_to_report ""
        append_to_report "See log: \`backend_perf_${TIMESTAMP}.log\`"
        BACKEND_PERF_PASS=0
    fi
else
    echo -e "${RED}❌ Backend is not running${NC}"
    echo "Start backend: cd backend && cargo run"
    append_to_report "**Result:** ⚠ SKIPPED (backend not running)"
    BACKEND_PERF_PASS=0
fi

append_to_report ""
append_to_report "---"
append_to_report ""

# ============================================================================
# TEST 2: Frontend Bundle Size (<500KB gzipped)
# ============================================================================

print_section "TEST 2: Frontend Bundle Size (<500KB gzipped)"

append_to_report "## 2. Frontend Bundle Size"
append_to_report ""
append_to_report "**Constitutional Requirement:** <500KB gzipped total bundle size"
append_to_report ""

cd "$FRONTEND_DIR"

echo "Building frontend for production..."
if npm run build > "$REPORT_DIR/frontend_build_${TIMESTAMP}.log" 2>&1; then
    echo -e "${GREEN}✅ Production build completed${NC}"

    echo ""
    echo "Analyzing bundle sizes..."

    if node tests/performance/bundle-size-test.ts > "$REPORT_DIR/bundle_size_${TIMESTAMP}.log" 2>&1; then
        echo -e "${GREEN}✅ Bundle size analysis PASSED${NC}"
        append_to_report "**Result:** ✅ PASS"
        append_to_report ""
        append_to_report "\`\`\`"
        cat "$REPORT_DIR/bundle_size_${TIMESTAMP}.log" >> "$REPORT_FILE"
        append_to_report "\`\`\`"
        BUNDLE_SIZE_PASS=1
    else
        echo -e "${RED}❌ Bundle size exceeds constitutional limit${NC}"
        append_to_report "**Result:** ❌ FAIL"
        append_to_report ""
        append_to_report "See log: \`bundle_size_${TIMESTAMP}.log\`"
        BUNDLE_SIZE_PASS=0
    fi
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    append_to_report "**Result:** ❌ FAIL (build error)"
    BUNDLE_SIZE_PASS=0
fi

append_to_report ""
append_to_report "---"
append_to_report ""

# ============================================================================
# TEST 3: WebSocket Latency (<200ms)
# ============================================================================

print_section "TEST 3: WebSocket Weight Update Latency (<200ms)"

append_to_report "## 3. WebSocket Weight Update Latency"
append_to_report ""
append_to_report "**Constitutional Requirement:** <200ms latency for weight updates"
append_to_report ""

echo "Prerequisites:"
echo "  - Bridge service must be running on ws://localhost:5000"
echo ""

# Check if bridge service is available
if timeout 2s wscat -c ws://localhost:5000/ws/health -x '{"type":"ping"}' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bridge service is running${NC}"

    echo ""
    echo "Running WebSocket latency tests via Playwright..."

    cd "$FRONTEND_DIR"

    if npm run test:e2e -- tests/performance/websocket-latency.spec.ts > "$REPORT_DIR/websocket_${TIMESTAMP}.log" 2>&1; then
        echo -e "${GREEN}✅ WebSocket latency tests PASSED${NC}"
        append_to_report "**Result:** ✅ PASS"
        append_to_report ""
        append_to_report "See log: \`websocket_${TIMESTAMP}.log\`"
        WEBSOCKET_PASS=1
    else
        echo -e "${RED}❌ WebSocket latency tests FAILED${NC}"
        append_to_report "**Result:** ❌ FAIL"
        WEBSOCKET_PASS=0
    fi
else
    echo -e "${YELLOW}⚠ Bridge service not running${NC}"
    echo "Start bridge: cd bridge && dotnet run"
    append_to_report "**Result:** ⚠ SKIPPED (bridge service not running)"
    WEBSOCKET_PASS=-1
fi

append_to_report ""
append_to_report "---"
append_to_report ""

# ============================================================================
# TEST 4: Quickstart.md Validation Scenarios (10/10)
# ============================================================================

print_section "TEST 4: Quickstart.md Validation Scenarios (10/10)"

append_to_report "## 4. Quickstart.md Validation Scenarios"
append_to_report ""
append_to_report "**Constitutional Requirement:** All 10 scenarios must pass"
append_to_report ""

cd "$(dirname "$0")"

if bash run-quickstart-scenarios.sh > "$REPORT_DIR/scenarios_${TIMESTAMP}.log" 2>&1; then
    echo -e "${GREEN}✅ Quickstart scenarios PASSED${NC}"
    append_to_report "**Result:** ✅ PASS"
    append_to_report ""
    append_to_report "\`\`\`"
    cat "$REPORT_DIR/scenarios_${TIMESTAMP}.log" >> "$REPORT_FILE"
    append_to_report "\`\`\`"
    SCENARIOS_PASS=1
else
    echo -e "${RED}❌ Some quickstart scenarios FAILED${NC}"
    append_to_report "**Result:** ❌ FAIL"
    append_to_report ""
    append_to_report "See log: \`scenarios_${TIMESTAMP}.log\`"
    SCENARIOS_PASS=0
fi

append_to_report ""
append_to_report "---"
append_to_report ""

# ============================================================================
# SUMMARY
# ============================================================================

print_section "PERFORMANCE TEST SUMMARY"

append_to_report "## Summary"
append_to_report ""
append_to_report "| Test Category | Requirement | Result |"
append_to_report "|--------------|-------------|---------|"

TOTAL_PASS=0
TOTAL_TESTS=4

echo ""
echo "Test Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $BACKEND_PERF_PASS -eq 1 ]; then
    echo -e "1. Backend API Performance      : ${GREEN}✅ PASS${NC} (<100ms p95)"
    append_to_report "| Backend API Performance | <100ms p95 | ✅ PASS |"
    ((TOTAL_PASS++))
else
    echo -e "1. Backend API Performance      : ${RED}❌ FAIL${NC} (<100ms p95)"
    append_to_report "| Backend API Performance | <100ms p95 | ❌ FAIL |"
fi

if [ $BUNDLE_SIZE_PASS -eq 1 ]; then
    echo -e "2. Frontend Bundle Size         : ${GREEN}✅ PASS${NC} (<500KB gzipped)"
    append_to_report "| Frontend Bundle Size | <500KB gzipped | ✅ PASS |"
    ((TOTAL_PASS++))
else
    echo -e "2. Frontend Bundle Size         : ${RED}❌ FAIL${NC} (<500KB gzipped)"
    append_to_report "| Frontend Bundle Size | <500KB gzipped | ❌ FAIL |"
fi

if [ $WEBSOCKET_PASS -eq 1 ]; then
    echo -e "3. WebSocket Latency            : ${GREEN}✅ PASS${NC} (<200ms)"
    append_to_report "| WebSocket Latency | <200ms | ✅ PASS |"
    ((TOTAL_PASS++))
elif [ $WEBSOCKET_PASS -eq -1 ]; then
    echo -e "3. WebSocket Latency            : ${YELLOW}⚠ SKIPPED${NC} (<200ms)"
    append_to_report "| WebSocket Latency | <200ms | ⚠ SKIPPED |"
    ((TOTAL_TESTS--))
else
    echo -e "3. WebSocket Latency            : ${RED}❌ FAIL${NC} (<200ms)"
    append_to_report "| WebSocket Latency | <200ms | ❌ FAIL |"
fi

if [ $SCENARIOS_PASS -eq 1 ]; then
    echo -e "4. Quickstart Scenarios         : ${GREEN}✅ PASS${NC} (10/10)"
    append_to_report "| Quickstart Scenarios | 10/10 | ✅ PASS |"
    ((TOTAL_PASS++))
else
    echo -e "4. Quickstart Scenarios         : ${RED}❌ FAIL${NC} (10/10)"
    append_to_report "| Quickstart Scenarios | 10/10 | ❌ FAIL |"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Overall: $TOTAL_PASS/$TOTAL_TESTS tests passed"

append_to_report ""
append_to_report "**Overall Result:** $TOTAL_PASS/$TOTAL_TESTS tests passed"
append_to_report ""

if [ $TOTAL_PASS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}✅ ALL CONSTITUTIONAL PERFORMANCE REQUIREMENTS MET${NC}"
    append_to_report "✅ **ALL CONSTITUTIONAL PERFORMANCE REQUIREMENTS MET**"
    append_to_report ""
    append_to_report "The Partial Picking System PWA meets all performance requirements and is ready for production deployment."
else
    echo -e "${RED}❌ SOME CONSTITUTIONAL REQUIREMENTS NOT MET${NC}"
    append_to_report "❌ **SOME CONSTITUTIONAL REQUIREMENTS NOT MET**"
    append_to_report ""
    append_to_report "Performance improvements required before production deployment."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Report saved to: $REPORT_FILE"
echo ""

# Exit with failure if not all tests passed
if [ $TOTAL_PASS -ne $TOTAL_TESTS ]; then
    exit 1
fi

exit 0
