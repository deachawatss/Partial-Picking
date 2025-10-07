# Performance Testing Guide

**Project:** Partial Picking System PWA
**Branch:** 001-i-have-an
**Constitutional Requirements:** v1.0.0
**Last Updated:** 2025-10-07

---

## Table of Contents

1. [Overview](#overview)
2. [Constitutional Requirements](#constitutional-requirements)
3. [Test Categories](#test-categories)
4. [Running Performance Tests](#running-performance-tests)
5. [Interpreting Results](#interpreting-results)
6. [Troubleshooting](#troubleshooting)
7. [Continuous Monitoring](#continuous-monitoring)

---

## Overview

This guide documents the performance testing framework for the Partial Picking System PWA. All tests validate constitutional performance requirements that MUST be met before production deployment.

**Performance Test Suite Location:**
- Backend: `/home/deachawat/dev/projects/BPP/Partial-Picking/backend/tests/performance/`
- Frontend: `/home/deachawat/dev/projects/BPP/Partial-Picking/frontend/tests/performance/`
- Scripts: `/home/deachawat/dev/projects/BPP/Partial-Picking/scripts/`

---

## Constitutional Requirements

The following performance requirements are NON-NEGOTIABLE and defined in `.specify/memory/constitution.md`:

### 1. Backend API Response Time
**Requirement:** <100ms p95 latency for all endpoints

**Tested Endpoints:**
- `GET /api/runs/{runNo}` - Run details retrieval
- `GET /api/runs/{runNo}/batches/{rowNum}/items` - Batch items with weight ranges
- `GET /api/lots/available` - FEFO lot selection query
- `POST /api/picks` - 4-phase atomic picking transaction

**Measurement:**
- 100 concurrent requests per endpoint
- Percentiles: p50, p95, p99
- Min, max, average latencies

### 2. Frontend Bundle Size
**Requirement:** <500KB gzipped total bundle size

**Measurement:**
- Production build output analysis
- Individual bundle files (main.js, vendor.js)
- Gzipped size calculation
- Total bundle size verification

### 3. WebSocket Weight Update Latency
**Requirement:** <200ms latency from scale to UI update

**Measurement:**
- 100 rapid weight update tests
- Round-trip time measurement
- React 19 concurrent rendering validation
- Percentiles: p50, p95, p99

### 4. Quickstart.md Validation Scenarios
**Requirement:** All 10 scenarios must pass

**Scenarios:**
1. Backend API Health Check
2. LDAP Authentication
3. SQL Authentication Fallback
4. Run Details Auto-Population
5. Batch Items with Weight Range
6. FEFO Lot Selection
7. 4-Phase Atomic Pick Transaction
8. Weight Tolerance Validation
9. WebSocket Weight Stream
10. Frontend End-to-End Flow

---

## Test Categories

### Category 1: Backend API Performance

**Test File:** `backend/tests/performance/api_performance_test.rs`

**Run Command:**
```bash
cd backend
cargo test --test api_performance_test run_all_performance_tests -- --nocapture
```

**Individual Tests:**
```bash
# Test specific endpoint
cargo test --test api_performance_test test_get_run_details_performance -- --nocapture
cargo test --test api_performance_test test_get_batch_items_performance -- --nocapture
cargo test --test api_performance_test test_get_available_lots_performance -- --nocapture
```

**Prerequisites:**
- Backend running on `http://localhost:7075`
- Valid test data in database (Run 6000037, etc.)
- Test user credentials in `.env`

**Expected Output:**
```
========================================
Endpoint: GET /api/runs/{runNo}
========================================
Total Requests:      100
Successful:          100
Failed:              0
----------------------------------------
Latency Percentiles:
  P50 (median):      45 ms
  P95:               78 ms
  P99:               92 ms
  Min:               12 ms
  Max:               105 ms
  Average:           52 ms
----------------------------------------
RESULT: ✅ PASS (p95 < 100ms)
========================================
```

---

### Category 2: Frontend Bundle Size

**Test File:** `frontend/tests/performance/bundle-size-test.ts`

**Run Command:**
```bash
cd frontend
npm run build
node tests/performance/bundle-size-test.ts
```

**Prerequisites:**
- Node.js v20+ installed
- All npm dependencies installed

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════╗
║      FRONTEND BUNDLE SIZE PERFORMANCE TEST                  ║
║      Constitutional Requirement: <500KB gzipped             ║
╚══════════════════════════════════════════════════════════════╝

Bundle Files Found:
─────────────────────────────────────────────────────────────

File: assets/index-abc123.js
  Raw Size:    842.15 KB
  Gzip Size:   245.32 KB

File: assets/vendor-xyz789.js
  Raw Size:    624.88 KB
  Gzip Size:   187.56 KB

═════════════════════════════════════════════════════════════
TOTAL BUNDLE SIZE SUMMARY
═════════════════════════════════════════════════════════════
Total Raw Size:      1467.03 KB
Total Gzip Size:     432.88 KB
Constitutional Limit: 500 KB
Difference:          67.12 KB
─────────────────────────────────────────────────────────────
RESULT: ✅ PASS - Bundle size within constitutional limit
═════════════════════════════════════════════════════════════
```

---

### Category 3: WebSocket Latency

**Test File:** `frontend/tests/performance/websocket-latency.spec.ts`

**Run Command:**
```bash
cd frontend
npm run test:e2e -- tests/performance/websocket-latency.spec.ts
```

**Prerequisites:**
- Bridge service running on `ws://localhost:5000`
- Frontend accessible on `http://localhost:6060`
- Playwright installed

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════╗
║      WEBSOCKET WEIGHT LATENCY PERFORMANCE TEST              ║
║      Constitutional Requirement: <200ms latency             ║
╚══════════════════════════════════════════════════════════════╝

✅ WebSocket connected

Starting 100 weight update latency tests...

  Tested 10/100 weight updates...
  Tested 20/100 weight updates...
  ...
  Tested 100/100 weight updates...

✅ WebSocket closed

─────────────────────────────────────────────────────────────
Latency Percentiles:
  P50 (median):        85.23 ms
  P95:                 142.67 ms
  P99:                 178.91 ms
  Min:                 32.15 ms
  Max:                 195.42 ms
  Average:             92.34 ms
─────────────────────────────────────────────────────────────

Constitutional Compliance:
  Requirement:         < 200 ms (p95)
  Actual (p95):        142.67 ms
  Difference:          57.33 ms
  RESULT:              ✅ PASS
═════════════════════════════════════════════════════════════
```

---

### Category 4: Quickstart Scenarios

**Test File:** `scripts/run-quickstart-scenarios.sh`

**Run Command:**
```bash
cd scripts
./run-quickstart-scenarios.sh
```

**Prerequisites:**
- All services running (backend, frontend, bridge)
- Valid test credentials
- `jq` and `curl` installed

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════╗
║    QUICKSTART.MD VALIDATION SCENARIOS (10/10)               ║
║    Partial Picking System PWA - Environment Validation      ║
╚══════════════════════════════════════════════════════════════╝

─────────────────────────────────────────────────────────────
Scenario 1: Backend API Health Check
─────────────────────────────────────────────────────────────
Backend health endpoint returned 200
✅ PASS

[... scenarios 2-10 ...]

╔══════════════════════════════════════════════════════════════╗
║                    VALIDATION SUMMARY                        ║
╚══════════════════════════════════════════════════════════════╝

✅ Scenario 1: PASS
✅ Scenario 2: PASS
...
✅ Scenario 10: PASS

─────────────────────────────────────────────────────────────
Total Tests: 10
Passed: 10
Failed: 0
─────────────────────────────────────────────────────────────

✅ ALL AUTOMATED SCENARIOS PASSED
```

---

## Running Performance Tests

### Option 1: Run All Tests (Recommended)

```bash
cd /home/deachawat/dev/projects/BPP/Partial-Picking/scripts
./run-performance-tests.sh
```

**Prerequisites:**
- All services running (backend, frontend, bridge)
- Production build completed
- All dependencies installed

**Output:**
- Comprehensive performance report
- Saved to `performance-reports/performance_report_TIMESTAMP.md`

---

### Option 2: Run Individual Test Categories

**Backend API Performance:**
```bash
cd backend
cargo test --test api_performance_test run_all_performance_tests -- --nocapture
```

**Frontend Bundle Size:**
```bash
cd frontend
npm run build
node tests/performance/bundle-size-test.ts
```

**WebSocket Latency:**
```bash
cd frontend
npm run test:e2e -- tests/performance/websocket-latency.spec.ts
```

**Quickstart Scenarios:**
```bash
cd scripts
./run-quickstart-scenarios.sh
```

---

## Interpreting Results

### Pass/Fail Criteria

**PASS Criteria:**
- ✅ Backend API: ALL endpoints p95 < 100ms
- ✅ Frontend Bundle: Total gzipped < 500KB
- ✅ WebSocket: p95 < 200ms
- ✅ Quickstart: 10/10 scenarios passing

**FAIL Criteria:**
- ❌ ANY endpoint p95 >= 100ms
- ❌ Total bundle >= 500KB gzipped
- ❌ WebSocket p95 >= 200ms
- ❌ ANY quickstart scenario failing

### Performance Metrics Explanation

**Percentiles (p50, p95, p99):**
- **p50 (median):** 50% of requests faster than this value
- **p95:** 95% of requests faster than this value (constitutional benchmark)
- **p99:** 99% of requests faster than this value

**Why p95?**
- p95 excludes outliers (network spikes, GC pauses)
- Represents typical production performance
- Industry standard for SLA compliance

---

## Troubleshooting

### Backend API Tests Fail

**Symptoms:**
- p95 >= 100ms
- High max latency
- Failed requests

**Diagnostic Steps:**
```bash
# Check database connection
cd backend
cargo test --test db_connection_test -- --nocapture

# Check database query performance
# Use SQL Server profiler or DMVs

# Check connection pool settings
grep -r "pool" backend/.env

# Check server load
top -p $(pgrep -f "partial-picking-backend")
```

**Common Fixes:**
- Increase connection pool size (`.env`: `DATABASE_POOL_SIZE=20`)
- Add database indexes on frequently queried columns
- Optimize SQL queries (avoid N+1 queries)
- Increase server resources (CPU, RAM)

---

### Frontend Bundle Size Exceeds Limit

**Symptoms:**
- Total gzipped >= 500KB
- Large vendor bundle

**Diagnostic Steps:**
```bash
# Analyze bundle composition
cd frontend
npm run build
npx vite-bundle-visualizer

# Check for duplicate dependencies
npm dedupe

# Check for large libraries
du -sh node_modules/* | sort -h | tail -20
```

**Common Fixes:**
- Enable code splitting in `vite.config.ts`
- Lazy load routes and components
- Replace large dependencies with lighter alternatives
- Enable tree shaking
- Remove unused dependencies

---

### WebSocket Latency Exceeds Limit

**Symptoms:**
- p95 >= 200ms
- High variance in latency
- Connection timeouts

**Diagnostic Steps:**
```bash
# Check bridge service logs
cd bridge
dotnet run

# Test WebSocket connection manually
wscat -c ws://localhost:5000/ws/scale/WS-001/small

# Check network latency
ping localhost
```

**Common Fixes:**
- Reduce WebSocket polling interval (`.env`: `WEIGHT_POLLING_INTERVAL_MS=50`)
- Optimize React state updates (use `useTransition` for concurrent rendering)
- Check serial port baud rate (`.env`: `DEFAULT_SCALE_BAUD_RATE=9600`)
- Reduce network overhead (use binary protocol instead of JSON)

---

### Quickstart Scenarios Fail

**Symptoms:**
- Authentication failures
- Database connection errors
- Missing test data

**Diagnostic Steps:**
```bash
# Check all services running
netstat -an | grep -E "7075|6060|5000"

# Check environment variables
cat .env | grep -E "DATABASE|LDAP|JWT"

# Verify test data exists
cd backend
cargo test --test runs_contract_test -- --nocapture
```

**Common Fixes:**
- Start all services (backend, frontend, bridge)
- Verify `.env` configuration
- Restore test data to database
- Check LDAP connectivity
- Verify JWT secret matches across services

---

## Continuous Monitoring

### Pre-Commit Checks

Add performance tests to git pre-commit hooks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
cd frontend
npm run build
node tests/performance/bundle-size-test.ts || exit 1
```

---

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: mcr.microsoft.com/mssql/server:2022-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: StrongPassword123!
    steps:
      - uses: actions/checkout@v3
      - name: Run performance tests
        run: |
          cd scripts
          ./run-performance-tests.sh
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-reports/
```

---

### Production Monitoring

**Recommended Tools:**
- **Backend:** Prometheus + Grafana (API latency metrics)
- **Frontend:** Lighthouse CI (bundle size, performance scores)
- **WebSocket:** Custom metrics endpoint (latency percentiles)

**Key Metrics to Track:**
- API endpoint p95 latency (alert if >= 100ms)
- Bundle size trends (alert if >= 500KB)
- WebSocket latency p95 (alert if >= 200ms)
- Error rates (alert if > 1%)

---

## Performance Test Checklist

Before approving deployment:

- [ ] Backend API tests: ALL endpoints p95 < 100ms ✅
- [ ] Frontend bundle: Total gzipped < 500KB ✅
- [ ] WebSocket latency: p95 < 200ms ✅
- [ ] Quickstart scenarios: 10/10 passing ✅
- [ ] Performance report generated and reviewed ✅
- [ ] No performance regressions vs. previous baseline ✅
- [ ] Constitutional compliance verified ✅

---

## References

- **Constitution:** `.specify/memory/constitution.md`
- **Quickstart Guide:** `specs/001-i-have-an/quickstart.md`
- **OpenAPI Contract:** `specs/001-i-have-an/contracts/openapi.yaml`
- **WebSocket Protocol:** `specs/001-i-have-an/contracts/websocket.md`

---

**Document Version:** 1.0
**Created:** 2025-10-07
**QA Engineer:** Claude Code
**Status:** ✅ Complete
