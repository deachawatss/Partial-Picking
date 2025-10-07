# Production Readiness Checklist
## Partial Picking System PWA

**Version**: 1.0.0
**Target Environment**: Windows Server @ 192.168.0.10
**Date**: 2025-10-07

---

## Overview

This checklist ensures the Partial Picking System PWA is production-ready before deployment. Complete all items before proceeding with production deployment.

**Status Legend**:
- ✅ Complete and verified
- ⚠️ Complete but needs attention
- ❌ Incomplete or blocked
- 🔄 In progress

---

## 1. Code Quality & Testing

### Backend (Rust)

- [ ] All 30 unit tests passing
- [ ] All 4 contract tests passing (auth, runs, picking, lots)
- [ ] Performance tests passing (<100ms API response)
- [ ] Code formatted with `cargo fmt`
- [ ] No linting errors from `cargo clippy`
- [ ] Release build successful (`cargo build --release`)
- [ ] Binary size acceptable (<30 MB)
- [ ] No unsafe code blocks (or documented/justified)
- [ ] Error handling comprehensive
- [ ] Logging configured for production (info level)

**Verification**:
```bash
cd backend
cargo test
cargo fmt -- --check
cargo clippy -- -D warnings
cargo build --release
ls -lh target/release/partial-picking-backend.exe
```

### Frontend (React)

- [ ] All unit tests passing (Vitest)
- [ ] All 31+ E2E tests passing (Playwright)
- [ ] Tests run at 1280x1024 resolution
- [ ] Production build successful (`npm run build`)
- [ ] Bundle size acceptable (<500KB gzipped)
- [ ] No console errors in production build
- [ ] PWA manifest validated
- [ ] Service worker registered correctly
- [ ] Offline functionality tested
- [ ] TypeScript compilation successful (strict mode)
- [ ] ESLint checks passing
- [ ] Code formatted with Prettier

**Verification**:
```bash
cd frontend
npm test
npm run test:e2e
npm run build
npm run lint
ls -lh dist/assets/*.js
```

### Bridge Service (.NET 8)

- [ ] Bridge service already deployed and running at :5000
- [ ] WebSocket endpoints responding
- [ ] Weight scale communication verified
- [ ] No changes required for this deployment

---

## 2. Constitutional Compliance

### 8 Core Principles

- [ ] **Contract-First Development**: All APIs match openapi.yaml
- [ ] **Type Safety**: TypeScript strict mode + Rust compile-time guarantees
- [ ] **TDD with Failing Tests**: All tests written first (and passed)
- [ ] **Atomic Transactions**: 4-phase picking executes atomically
- [ ] **Real-Time Performance**: WebSocket latency <200ms verified
- [ ] **Security by Default**: JWT auth, CORS, input validation, parameterized queries
- [ ] **Audit Trail Preservation**: Audit metadata preserved (ItemBatchStatus, PickingDate)
- [ ] **No Artificial Keys**: Composite keys used (RunNo, RowNum, LineId)

**Verification**:
- Review: `CONSTITUTIONAL_COMPLIANCE_VERIFICATION.md`
- Review: Contract tests in `backend/tests/contract/`
- Review: 4-phase transaction in `picking_service.rs`

---

## 3. Environment Configuration

### Production Environment File

- [ ] `.env.production` created
- [ ] Database credentials configured
- [ ] JWT secret generated (secure, 64+ characters)
- [ ] LDAP configuration verified
- [ ] CORS origins updated for production
- [ ] Service ports configured (6060, 7075, 5000)
- [ ] Production URLs set correctly
- [ ] Log level set to `info`
- [ ] Sensitive values secured (not in version control)

**Critical Values**:
```bash
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
DATABASE_NAME=TFCPILOT3
FRONTEND_URL=http://192.168.0.10:6060
BACKEND_URL=http://192.168.0.10:7075
BRIDGE_URL=ws://192.168.0.10:5000
JWT_SECRET=<SECURE_64_CHAR_SECRET>
```

### Environment Validation

- [ ] Database connectivity tested from production server
- [ ] LDAP connectivity tested from production server
- [ ] Network ports available (6060, 7075)
- [ ] Bridge service reachable at port 5000
- [ ] SQL Server firewall allows connection from 192.168.0.10
- [ ] LDAP server accessible from 192.168.0.10

**Verification**:
```powershell
Test-NetConnection -ComputerName 192.168.0.86 -Port 49381
Test-NetConnection -ComputerName 192.168.0.1 -Port 389
Test-NetConnection -ComputerName localhost -Port 5000
```

---

## 4. Infrastructure Readiness

### Windows Server (192.168.0.10)

- [ ] Windows Server 2016+ installed
- [ ] IIS 10+ installed and configured
- [ ] .NET 8 Runtime installed
- [ ] Administrator access available
- [ ] Sufficient disk space (50+ GB free)
- [ ] Sufficient RAM (8+ GB)
- [ ] Firewall rules configured (ports 6060, 7075)
- [ ] Directory structure created:
  - `C:\inetpub\partial-picking\backend`
  - `C:\inetpub\partial-picking\frontend`
  - `C:\inetpub\partial-picking\logs`

**Verification**:
```powershell
Get-WindowsFeature -Name Web-Server
dotnet --list-runtimes
Get-NetFirewallRule -DisplayName "*Partial*"
Get-PSDrive C | Select-Object Free
```

### SQL Server Database (192.168.0.86:49381)

- [ ] TFCPILOT3 database exists
- [ ] User `NSW` has appropriate permissions
- [ ] All required tables exist:
  - `Cust_PartialRun`
  - `cust_PartialPicked`
  - `Cust_PartialLotPicked`
  - `LotMaster`
  - `LotTransaction`
  - `INMAST`
  - `tbl_user`
  - `TFC_Weightscale2`
  - `TFC_workstation2`
- [ ] Indexes created for performance
- [ ] Database backup created before deployment
- [ ] Transaction log space available

**Verification**:
```sql
SELECT name FROM sys.databases WHERE name='TFCPILOT3';
SELECT name FROM sys.tables WHERE name LIKE '%Partial%';
SELECT name FROM sys.tables WHERE name IN ('LotMaster', 'LotTransaction', 'INMAST');
```

---

## 5. Deployment Artifacts

### Build Artifacts

- [ ] Backend binary built (`backend/target/release/partial-picking-backend.exe`)
- [ ] Frontend dist built (`frontend/dist/`)
- [ ] `.env.production` prepared
- [ ] Deployment scripts ready (`scripts/deployment/*.ps1`)
- [ ] Documentation updated (DEPLOYMENT.md, ARCHITECTURE.md)

### Deployment Scripts

- [ ] `deploy-all.ps1` - Complete deployment orchestration
- [ ] `install-backend.ps1` - Backend Windows Service installation
- [ ] `install-frontend.ps1` - Frontend IIS deployment
- [ ] `health-check.ps1` - Post-deployment verification
- [ ] `rollback.ps1` - Emergency rollback procedure

**Verification**:
```powershell
Test-Path backend/target/release/partial-picking-backend.exe
Test-Path frontend/dist/index.html
Test-Path .env.production
Test-Path scripts/deployment/deploy-all.ps1
```

---

## 6. Security Checklist

### Authentication & Authorization

- [ ] JWT secret is strong and unique (64+ characters)
- [ ] JWT expiration configured (168 hours = 7 days)
- [ ] LDAP authentication working
- [ ] SQL fallback authentication working
- [ ] Password hashing using bcrypt
- [ ] No credentials in source code or logs

### Network Security

- [ ] CORS configured to allow only production frontend origin
- [ ] HTTPS considered (optional for internal network)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection not needed (no cookies, JWT in headers)

### Data Security

- [ ] Database credentials secured
- [ ] `.env.production` not committed to Git
- [ ] Audit trail preserved (no deletion of ItemBatchStatus)
- [ ] SQL queries use parameterized inputs
- [ ] Sensitive data logged only at trace level (not production)

**Verification**:
- Review: Input validation in `backend/src/models/`
- Review: SQL queries use `sqlx::query!` macros (parameterized)
- Review: CORS configuration in `backend/src/main.rs`

---

## 7. Performance Validation

### API Performance

- [ ] Health check endpoint responds in <100ms
- [ ] Authentication endpoint responds in <500ms
- [ ] Runs endpoint responds in <100ms
- [ ] Lots endpoint (FEFO query) responds in <100ms
- [ ] Save pick endpoint (4-phase transaction) responds in <200ms
- [ ] Performance tests passing

**Verification**:
```bash
cd backend
cargo test --test api_performance_test -- --nocapture
```

### Frontend Performance

- [ ] Initial page load <3 seconds
- [ ] PWA installs successfully
- [ ] Service worker caches assets
- [ ] Offline mode functional
- [ ] React 19 concurrent rendering working
- [ ] Bundle size <500KB gzipped

### WebSocket Performance

- [ ] Weight updates received in <200ms
- [ ] No dropped messages during continuous mode
- [ ] Stable connection for 1+ hour test
- [ ] Reconnection logic working

---

## 8. Monitoring & Logging

### Logging Configuration

- [ ] Backend logs to `C:\inetpub\partial-picking\logs\backend.log`
- [ ] Error logs to `C:\inetpub\partial-picking\logs\backend-error.log`
- [ ] Log level set to `info` for production
- [ ] Log rotation configured (daily, 30-day retention)
- [ ] Structured JSON logging enabled
- [ ] Sensitive data not logged (passwords, tokens)

### Monitoring Setup

- [ ] Health check endpoint operational
- [ ] Windows Service monitoring configured
- [ ] IIS site monitoring configured
- [ ] Database connection monitoring
- [ ] Disk space monitoring
- [ ] Log aggregation considered (optional)

**Monitoring Script**:
```powershell
# Run continuous health checks
.\scripts\deployment\health-check.ps1 -ContinuousMonitoring -MonitoringIntervalSeconds 60
```

---

## 9. Backup & Disaster Recovery

### Backups

- [ ] Database backup created before deployment
- [ ] Previous backend version backed up
- [ ] Previous frontend version backed up
- [ ] Backup location: `C:\Backups\partial-picking\`
- [ ] Backup retention policy defined (7 days)
- [ ] Backup restoration tested

### Rollback Plan

- [ ] Rollback procedure documented (DEPLOYMENT.md)
- [ ] Rollback script tested (`rollback.ps1`)
- [ ] Rollback decision criteria defined
- [ ] Rollback communication plan ready
- [ ] Emergency contact list available

**Rollback Triggers**:
- ❌ Health checks fail after deployment
- ❌ Critical functionality broken
- ❌ Performance degraded >500ms
- ❌ Data integrity issues

---

## 10. Documentation

### Technical Documentation

- [ ] DEPLOYMENT.md updated with production instructions
- [ ] ARCHITECTURE.md reflects current architecture
- [ ] API.md documents all endpoints
- [ ] TESTING.md covers test strategy
- [ ] quickstart.md validates 10 scenarios
- [ ] CLAUDE.md updated with deployment patterns (if needed)

### User Documentation

- [ ] Workstation setup instructions (WS1-WS4)
- [ ] User training materials prepared
- [ ] Quick reference guide created
- [ ] Troubleshooting guide available

### Operational Documentation

- [ ] Runbook created (DEPLOYMENT.md)
- [ ] Health check procedures documented
- [ ] Rollback procedures documented
- [ ] Monitoring setup documented
- [ ] Incident response plan created

---

## 11. Stakeholder Communication

### Pre-Deployment

- [ ] Deployment window scheduled
- [ ] Warehouse team notified
- [ ] Workstation users informed
- [ ] Downtime expectations communicated
- [ ] Support team briefed

### Post-Deployment

- [ ] Deployment success notification prepared
- [ ] Training session scheduled
- [ ] Feedback mechanism established
- [ ] Support hotline available

---

## 12. Post-Deployment Validation

### 10 Validation Scenarios

Run all scenarios from `quickstart.md`:

- [ ] **Scenario 1**: Backend API health check
- [ ] **Scenario 2**: LDAP authentication success
- [ ] **Scenario 3**: SQL fallback authentication
- [ ] **Scenario 4**: Run details auto-population
- [ ] **Scenario 5**: Batch items with weight range
- [ ] **Scenario 6**: FEFO lot selection
- [ ] **Scenario 7**: 4-phase atomic pick transaction
- [ ] **Scenario 8**: Weight tolerance validation
- [ ] **Scenario 9**: WebSocket weight stream
- [ ] **Scenario 10**: Frontend end-to-end flow

### Workstation Testing

Test from each workstation:

- [ ] **WS1**: Login + select run + view lots
- [ ] **WS2**: Complete pick with SMALL scale
- [ ] **WS3**: Complete pick with BIG scale
- [ ] **WS4**: Print labels + complete batch

### Performance Validation

- [ ] API response times <100ms (average)
- [ ] WebSocket latency <200ms
- [ ] Frontend load time <3 seconds
- [ ] No errors in logs after 1 hour
- [ ] Memory usage stable over 4 hours

---

## Final Sign-Off

### Checklist Completion

| Category | Completion | Sign-Off | Date |
|----------|-----------|----------|------|
| Code Quality & Testing | ___% | ________ | ____ |
| Constitutional Compliance | ___% | ________ | ____ |
| Environment Configuration | ___% | ________ | ____ |
| Infrastructure Readiness | ___% | ________ | ____ |
| Deployment Artifacts | ___% | ________ | ____ |
| Security Checklist | ___% | ________ | ____ |
| Performance Validation | ___% | ________ | ____ |
| Monitoring & Logging | ___% | ________ | ____ |
| Backup & Disaster Recovery | ___% | ________ | ____ |
| Documentation | ___% | ________ | ____ |
| Stakeholder Communication | ___% | ________ | ____ |
| Post-Deployment Validation | ___% | ________ | ____ |

**Overall Readiness**: ___% (Must be 100% before production deployment)

### Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Backend Engineer | __________ | __________ | ____ |
| Frontend Engineer | __________ | __________ | ____ |
| QA Engineer | __________ | __________ | ____ |
| DevOps Manager | __________ | __________ | ____ |
| Project Manager | __________ | __________ | ____ |
| IT Manager | __________ | __________ | ____ |

---

## Notes

**Blockers**: (List any items blocking deployment)

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Risk Assessment**:
- **Low Risk**: All checklist items complete, tested in staging
- **Medium Risk**: Minor items pending, workarounds available
- **High Risk**: Critical items incomplete, deployment not recommended

**Current Risk Level**: ____________

**Go/No-Go Decision**: ____________

---

**Document Version**: 1.0.0
**Created**: 2025-10-07
**Last Updated**: 2025-10-07
**Next Review**: Post-deployment
