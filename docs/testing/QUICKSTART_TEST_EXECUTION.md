# Quickstart Validation - Test Execution
## Quick Reference Card

**Phase**: 3.9 - Step 4
**Task**: T093 - Execute 10 Validation Scenarios
**Status**: Ready for Execution ⏳

---

## Prerequisites Checklist

Before running tests, verify:

```bash
# ✅ Backend running
curl http://localhost:7075/api/health
# Expected: {"status":"healthy","database":"connected"}

# ✅ Frontend running
curl -I http://localhost:6060
# Expected: HTTP 200 OK

# ⚠️ Bridge service (optional - Scenario 9 only)
# Windows only: cd bridge && dotnet run

# ✅ jq installed (recommended for JSON parsing)
sudo apt install jq

# ✅ wscat installed (for WebSocket testing)
npm install -g wscat
```

---

## One-Command Test Execution

### Run All Automated Tests (Scenarios 1-8)

```bash
./scripts/validate-all-scenarios.sh
```

**Expected Output**:
```
═══════════════════════════════════════════════════════════════
PRE-FLIGHT CHECKS
═══════════════════════════════════════════════════════════════

  ✓ Backend API is running
  ✓ Frontend is running

═══════════════════════════════════════════════════════════════
SCENARIO 1: Backend API Health Check
═══════════════════════════════════════════════════════════════

▶ Testing backend health endpoint
✓ PASS: Backend health check passed

[... continues for all scenarios ...]

═══════════════════════════════════════════════════════════════
VALIDATION SUMMARY
═══════════════════════════════════════════════════════════════

Total Tests: 10
Passed:      8/10
Failed:      0/10

   ✓ ALL VALIDATION SCENARIOS PASSED
```

---

## Individual Test Execution

### Scenario 1: Backend Health ✅

```bash
curl http://localhost:7075/api/health
```

**Expected**: `{"status":"healthy","database":"connected"}`

---

### Scenario 2: LDAP Authentication ✅

```bash
curl -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dechawat","password":"TestPassword123"}'
```

**Expected**: JWT token with `"authSource":"LDAP"`

---

### Scenario 3: SQL Authentication ✅

```bash
curl -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"warehouse_user","password":"SqlPassword456"}'
```

**Expected**: JWT token with `"authSource":"LOCAL"`

---

### Scenario 4: Run Details ✅

```bash
# Get token first
TOKEN=$(curl -s -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dechawat","password":"TestPassword123"}' \
  | jq -r '.token')

# Get run details
curl http://localhost:7075/api/runs/6000037 \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected**: `fgItemKey`, `fgDescription`, `batches` populated

---

### Scenario 5: Batch Items ✅

```bash
curl http://localhost:7075/api/runs/6000037/batches/1/items \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected**: Items with `weightRangeLow`, `weightRangeHigh`, `toleranceKG`

---

### Scenario 6: FEFO Lots ✅

```bash
curl "http://localhost:7075/api/lots/available?itemKey=INSALT02" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected**: Lots sorted by `expiryDate` ASC (earliest first)

---

### Scenario 7: 4-Phase Pick ✅

```bash
# Save pick
curl -X POST http://localhost:7075/api/picks \
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
  }' | jq
```

**Expected**: Status 201, `"status":"Allocated"`, `lotTranNo` returned

**SQL Verification**:
```bash
sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3 \
  -i scripts/verify-scenario7-sql.sql
```

---

### Scenario 8: Weight Tolerance ✅

```bash
# Try out-of-range weight (should fail)
curl -X POST http://localhost:7075/api/picks \
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
  }' | jq
```

**Expected**: Status 400, error code `VALIDATION_WEIGHT_OUT_OF_TOLERANCE`

---

### Scenario 9: WebSocket Weight Stream ✅

```bash
# Automated test (5 seconds)
node scripts/test-websocket-scenario9.js

# Manual test (interactive)
wscat -c ws://localhost:5000/ws/scale/WS-001/small
```

**Expected**:
- Connection established
- Continuous mode started
- Weight updates every ~100ms
- Latency < 200ms

---

### Scenario 10: Frontend E2E ✅

**Manual Test**: Follow `/scripts/SCENARIO_10_E2E_GUIDE.md`

**Steps**:
1. Open http://localhost:6060
2. Login: dechawat / TestPassword123
3. Workstation: WS3
4. Run: 6000037
5. Complete full picking workflow (16 steps)

**Duration**: ~15-20 minutes

---

## Test Results Quick Check

### Automated Tests

```bash
# Run all tests
./scripts/validate-all-scenarios.sh

# Check exit code
echo $?
# 0 = all passed
# 1 = one or more failed
```

### WebSocket Test

```bash
node scripts/test-websocket-scenario9.js

echo $?
# 0 = passed
# 1 = failed
```

### SQL Verification

```bash
# Run SQL script
sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3 \
  -i scripts/verify-scenario7-sql.sql > sql_results.txt

# Check results
cat sql_results.txt | grep "SUCCESS"
```

---

## Common Issues & Quick Fixes

### Issue: Backend not responding

```bash
# Check if backend is running
ps aux | grep "target/debug/backend"

# Restart backend
cd backend && cargo run
```

---

### Issue: "Token not found" errors

```bash
# Re-authenticate
TOKEN=$(curl -s -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dechawat","password":"TestPassword123"}' \
  | jq -r '.token')

echo $TOKEN
# Should output: eyJ...
```

---

### Issue: LDAP authentication fails

```bash
# Use SQL fallback
curl -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"warehouse_user","password":"SqlPassword456"}'
```

---

### Issue: WebSocket connection refused

```bash
# Bridge service may not be running (Windows only)
# Skip Scenario 9 and continue with others

# Or check if port is in use
netstat -an | grep 5000
```

---

### Issue: Database connection timeout

```bash
# Test database connectivity
ping 192.168.0.86

telnet 192.168.0.86 49381

# Check .env configuration
cat .env | grep DATABASE
```

---

## Performance Benchmarks

### Expected Timings

| Test | Expected Duration |
|------|------------------|
| Scenario 1 | < 1s |
| Scenario 2 | < 2s |
| Scenario 3 | < 2s |
| Scenario 4 | < 2s |
| Scenario 5 | < 2s |
| Scenario 6 | < 2s |
| Scenario 7 | < 3s |
| Scenario 8 | < 2s |
| Scenario 9 | 5s (automated) |
| Scenario 10 | 15-20 min (manual) |

**Total Automated**: ~5 minutes
**Total Manual**: ~20 minutes
**Grand Total**: ~25 minutes

---

## Success Criteria Summary

**All scenarios must meet these criteria**:

| Scenario | Pass Criteria |
|----------|--------------|
| 1 | HTTP 200, database connected |
| 2 | JWT token, authSource=LDAP |
| 3 | JWT token, authSource=LOCAL |
| 4 | FG fields populated correctly |
| 5 | Weight ranges calculated |
| 6 | FEFO order (earliest expiry first) |
| 7 | Status 201, all 4 phases execute |
| 8 | Status 400, tolerance error |
| 9 | <200ms latency, continuous mode |
| 10 | All 16 steps complete |

---

## Report Generation

### Automated Test Report

```bash
# Run tests and save output
./scripts/validate-all-scenarios.sh > test_results_$(date +%Y%m%d_%H%M%S).txt

# View results
cat test_results_*.txt
```

### WebSocket Test Report

```bash
# Run and save
node scripts/test-websocket-scenario9.js > ws_test_$(date +%Y%m%d_%H%M%S).txt
```

### SQL Verification Report

```bash
# Run and save
sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3 \
  -i scripts/verify-scenario7-sql.sql > sql_verification_$(date +%Y%m%d_%H%M%S).txt
```

---

## Constitutional Compliance Validation

**Verify all 8 principles**:

```bash
# Run validation script
./scripts/validate-all-scenarios.sh

# Check for constitutional compliance markers
grep -E "FEFO|4-phase|latency|audit|composite" test_results_*.txt
```

**Expected Confirmations**:
- ✅ Database Schema Fidelity (Scenarios 4, 5, 6)
- ✅ FEFO Compliance (Scenario 6)
- ✅ 4-Phase Atomicity (Scenario 7)
- ✅ Real-Time Weight <200ms (Scenario 9)
- ✅ Audit Trail Preservation (Scenario 7 SQL)
- ✅ Security by Default (Scenarios 2, 3)
- ✅ Production Quality (Scenarios 8, 10)
- ✅ No Artificial Keys (Scenarios 4, 7)

---

## Next Steps After Testing

### If All Tests Pass ✅

```bash
# 1. Generate final report
./scripts/validate-all-scenarios.sh > FINAL_VALIDATION_REPORT.txt

# 2. Commit test results
git add test-results/
git commit -m "Phase 3.9 Step 4: All 10 validation scenarios passed"

# 3. Update PHASE_3.9_STEP_4_COMPLETE.md
# 4. Notify team of successful validation
```

### If Any Tests Fail ❌

```bash
# 1. Review failure logs
cat test_results_*.txt | grep "FAIL"

# 2. Fix issues identified
# 3. Re-run failed scenarios
# 4. Repeat until all pass
```

---

## Contact & Support

**Test Scripts Location**:
- Master script: `/scripts/validate-all-scenarios.sh`
- WebSocket test: `/scripts/test-websocket-scenario9.js`
- SQL verification: `/scripts/verify-scenario7-sql.sql`
- E2E guide: `/scripts/SCENARIO_10_E2E_GUIDE.md`

**Full Documentation**: `/QUICKSTART_VALIDATION_REPORT.md`

**Quickstart Guide**: `/specs/001-i-have-an/quickstart.md`

---

**Quick Start**: `./scripts/validate-all-scenarios.sh` → 5 minutes → ✅ 8/10 automated tests complete

**Version**: 1.0
**Created**: 2025-10-07
**QA Engineer**: Claude Code Agent
