# Quickstart Validation Scenarios - Test Scripts

This directory contains automated test scripts for validating all 10 scenarios from `/specs/001-i-have-an/quickstart.md`.

## Quick Start

```bash
# Run all automated tests (Scenarios 1-8)
./scripts/validate-all-scenarios.sh

# Run WebSocket test (Scenario 9)
node scripts/test-websocket-scenario9.js

# Run SQL verification (Scenario 7)
sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3 \
  -i scripts/verify-scenario7-sql.sql

# Manual E2E test (Scenario 10)
# Follow: scripts/SCENARIO_10_E2E_GUIDE.md
```

## Test Scripts

### 1. validate-all-scenarios.sh

**Purpose**: Master automation script for Scenarios 1-8

**Features**:
- Pre-flight service checks
- JWT token management
- Automated API testing
- Color-coded output
- Exit codes for CI/CD

**Usage**:
```bash
./scripts/validate-all-scenarios.sh
```

**Output**: Pass/fail status for 8 scenarios + summary

**Duration**: ~5 minutes

---

### 2. test-websocket-scenario9.js

**Purpose**: WebSocket latency and performance testing

**Features**:
- Connection establishment validation
- Continuous mode testing
- Latency measurement (<200ms)
- Message format validation
- Average/max latency calculation

**Usage**:
```bash
# Default workstation and scale
node scripts/test-websocket-scenario9.js

# Custom workstation and scale
node scripts/test-websocket-scenario9.js WS-002 big
```

**Output**: Pass/fail with latency metrics

**Duration**: 5 seconds

---

### 3. verify-scenario7-sql.sql

**Purpose**: 4-phase atomic transaction verification

**Features**:
- Phase 1: Cust_PartialLotPicked check
- Phase 2: cust_PartialPicked update verification
- Phase 3: LotTransaction creation validation
- Phase 4: LotMaster inventory commitment
- Audit trail preservation verification

**Usage**:
```bash
sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3 \
  -i scripts/verify-scenario7-sql.sql
```

**Output**: SQL query results for all 4 phases

**Duration**: ~5 minutes

---

### 4. SCENARIO_10_E2E_GUIDE.md

**Purpose**: Complete manual E2E test guide

**Features**:
- 16-step detailed workflow
- Screenshot requirements
- PWA validation checklist
- Performance benchmarks
- Test report template

**Usage**: Follow step-by-step instructions in the guide

**Duration**: 15-20 minutes

---

## Prerequisites

### Required Services

```bash
# Backend (Terminal 1)
cd backend && cargo run
# Running at: http://localhost:7075

# Frontend (Terminal 2)
cd frontend && npm run dev
# Running at: http://localhost:6060

# Bridge Service (Terminal 3) - Optional
cd bridge && dotnet run
# Running at: ws://localhost:5000
```

### Required Tools

```bash
# curl (for API testing)
sudo apt install curl

# jq (for JSON parsing - optional but recommended)
sudo apt install jq

# wscat (for manual WebSocket testing - optional)
npm install -g wscat

# Node.js (for WebSocket test script)
# Already installed (v20.x)

# SQL Server client (for SQL verification)
# Already available
```

---

## Test Scenarios

### Scenario 1: Backend API Health Check ✅
- **Script**: validate-all-scenarios.sh
- **Test**: curl http://localhost:7075/api/health
- **Expected**: 200 OK, database connected

### Scenario 2: LDAP Authentication ✅
- **Script**: validate-all-scenarios.sh
- **Test**: POST /api/auth/login (LDAP)
- **Expected**: JWT token, authSource=LDAP

### Scenario 3: SQL Authentication Fallback ✅
- **Script**: validate-all-scenarios.sh
- **Test**: POST /api/auth/login (SQL)
- **Expected**: JWT token, authSource=LOCAL

### Scenario 4: Run Details Auto-Population ✅
- **Script**: validate-all-scenarios.sh
- **Test**: GET /api/runs/6000037
- **Expected**: FG fields populated

### Scenario 5: Batch Items with Weight Range ✅
- **Script**: validate-all-scenarios.sh
- **Test**: GET /api/runs/.../batches/.../items
- **Expected**: Weight ranges calculated

### Scenario 6: FEFO Lot Selection ✅
- **Script**: validate-all-scenarios.sh
- **Test**: GET /api/lots/available
- **Expected**: Lots sorted by DateExpiry ASC

### Scenario 7: 4-Phase Atomic Pick Transaction ✅
- **Script**: validate-all-scenarios.sh + verify-scenario7-sql.sql
- **Test**: POST /api/picks
- **Expected**: Status 201, all 4 phases execute

### Scenario 8: Weight Tolerance Validation ✅
- **Script**: validate-all-scenarios.sh
- **Test**: POST /api/picks (out of range)
- **Expected**: Status 400, error code correct

### Scenario 9: WebSocket Weight Stream ✅
- **Script**: test-websocket-scenario9.js
- **Test**: WebSocket connection + latency measurement
- **Expected**: <200ms latency, continuous mode

### Scenario 10: Frontend End-to-End Flow ✅
- **Guide**: SCENARIO_10_E2E_GUIDE.md
- **Test**: Manual 16-step workflow
- **Expected**: All steps pass, PWA functional

---

## Success Criteria

**All 10 scenarios must pass**:
- ✅ Backend health check (200 OK)
- ✅ LDAP authentication (JWT token)
- ✅ SQL authentication (JWT token)
- ✅ Run details populated
- ✅ Weight ranges calculated
- ✅ FEFO lots sorted
- ✅ 4-phase transaction atomic
- ✅ Weight tolerance validated
- ✅ WebSocket <200ms latency
- ✅ E2E workflow complete

---

## Constitutional Compliance

All 8 principles validated:
1. **Database Schema Fidelity** → Scenarios 4, 5, 6
2. **FEFO Compliance** → Scenario 6 (CRITICAL)
3. **4-Phase Atomicity** → Scenario 7 (CRITICAL)
4. **Real-Time Weight <200ms** → Scenario 9 (CRITICAL)
5. **Audit Trail Preservation** → Scenario 7 SQL
6. **Security by Default** → Scenarios 2, 3
7. **Production Quality** → Scenario 8
8. **No Artificial Keys** → Scenarios 4, 7

---

## Troubleshooting

### Backend Not Running
```bash
# Check status
curl http://localhost:7075/api/health

# Restart
cd backend && cargo run
```

### Frontend Not Running
```bash
# Check status
curl -I http://localhost:6060

# Restart
cd frontend && npm run dev
```

### Bridge Service Not Available
- Bridge service is optional (Windows only)
- Frontend uses manual weight input as fallback
- Scenario 9 will show skip/warning

### Authentication Fails
```bash
# Use SQL fallback
# Scenario 3 tests SQL authentication
```

---

## Documentation

**Comprehensive Guides**:
- `/QUICKSTART_VALIDATION_REPORT.md` - Complete test plan
- `/QUICKSTART_TEST_EXECUTION.md` - Quick reference
- `/PHASE_3.9_STEP_4_COMPLETE.md` - Completion report
- `/10_SCENARIOS_QUICK_REFERENCE.txt` - Visual reference

**Original Requirements**:
- `/specs/001-i-have-an/quickstart.md`

---

## CI/CD Integration

All scripts support CI/CD:
```bash
# Exit codes
0 = All tests passed
1 = One or more tests failed

# Example CI/CD usage
./scripts/validate-all-scenarios.sh
if [ $? -eq 0 ]; then
  echo "✅ All tests passed"
  # Continue deployment
else
  echo "❌ Tests failed"
  # Stop deployment
fi
```

---

## Execution Time

| Test | Duration |
|------|----------|
| Scenarios 1-8 (automated) | ~5 minutes |
| Scenario 9 (WebSocket) | 5 seconds |
| Scenario 7 SQL verification | ~5 minutes |
| Scenario 10 (manual E2E) | 15-20 minutes |
| **Total** | **~25 minutes** |

---

## Contact

**QA Engineer**: Claude Code Agent
**Phase**: 3.9 - Step 4
**Task**: T093 - Quickstart Validation Scenarios
**Status**: ✅ COMPLETE - Infrastructure Ready

---

**Quick Start**: `./scripts/validate-all-scenarios.sh` → 5 minutes → ✅ 8/10 automated tests
