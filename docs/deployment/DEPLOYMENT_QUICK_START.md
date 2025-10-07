# Deployment Quick Start Guide
## Partial Picking System PWA - Production Deployment

**Version**: 1.0.0 | **Target**: Windows Server 192.168.0.10

---

## ⚡ Quick Reference

### Prerequisites Checklist (5 Minutes)

```powershell
# 1. Verify you're on production server
hostname  # Should be: 192.168.0.10 or server name

# 2. Check IIS installed
Get-WindowsFeature -Name Web-Server

# 3. Check database connectivity
Test-NetConnection -ComputerName 192.168.0.86 -Port 49381

# 4. Check bridge service
Test-NetConnection -ComputerName localhost -Port 5000

# 5. Verify administrator privileges
[Security.Principal.WindowsPrincipal] $principal = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
# Should return: True
```

---

## 🚀 Deployment (3 Steps)

### STEP 1: Build Artifacts (5 Minutes)

On development machine or build server:

```bash
# Backend
cd backend
cargo build --release
# Output: backend/target/release/partial-picking-backend.exe

# Frontend
cd frontend
npm ci --production
npm run build
# Output: frontend/dist/
```

### STEP 2: Configure Production Environment (2 Minutes)

Edit `.env.production`:

```bash
# Generate JWT Secret
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))

# Update .env.production
notepad .env.production

# Required changes:
# - JWT_SECRET=<paste_generated_secret>
# - LDAP_BIND_PASSWORD=<ldap_service_password>
# - Verify all other values
```

### STEP 3: Execute Deployment (10 Minutes)

On production server (192.168.0.10):

```powershell
# Navigate to project
cd C:\path\to\Partial-Picking

# Copy deployment files to server (if not already there)
# Option A: Git clone/pull
# Option B: Copy from network share
# Option C: SCP/RDP transfer

# Run complete deployment
cd scripts\deployment
.\deploy-all.ps1

# Follow on-screen prompts
# - Confirm deployment: yes
# - Wait for completion (~5-10 minutes)
# - Review summary

# If deployment succeeds:
# ✓ Backend Service: Running
# ✓ Frontend Site: Started
# ✓ Health Checks: PASSED

# If deployment fails:
.\rollback.ps1
```

---

## 🔍 Verification (5 Minutes)

### Quick Health Check

```powershell
# Run automated health checks
.\health-check.ps1

# Expected output:
# ✓ Backend API: Healthy
# ✓ Frontend PWA: Accessible
# ✓ Bridge Service: Port open
# ✓ SQL Server: Reachable
# ✓ Windows Service: Running
# ✓ IIS Site: Started
```

### Manual Verification

```powershell
# 1. Backend health
Invoke-RestMethod http://192.168.0.10:7075/api/health

# 2. Frontend access
Start-Process http://192.168.0.10:6060

# 3. Test login
# Open browser: http://192.168.0.10:6060
# Login with: dechawat / TestPassword123
```

### Test from Workstation

```
# From WS1, WS2, WS3, or WS4:
1. Open browser
2. Navigate to: http://192.168.0.10:6060
3. Login with warehouse credentials
4. Select workstation (e.g., WS3)
5. Enter Run No: 6000037
6. Verify data loads correctly
```

---

## 🔧 Common Commands

### Service Management

```powershell
# Backend Service
Get-Service -Name "PartialPickingBackend"
Start-Service -Name "PartialPickingBackend"
Stop-Service -Name "PartialPickingBackend"
Restart-Service -Name "PartialPickingBackend"

# Frontend (IIS)
Get-WebSite -Name "PartialPickingFrontend"
Start-WebSite -Name "PartialPickingFrontend"
Stop-WebSite -Name "PartialPickingFrontend"
Restart-WebAppPool -Name "PartialPickingAppPool"
```

### View Logs

```powershell
# Backend logs
Get-Content C:\inetpub\partial-picking\logs\backend.log -Tail 50
Get-Content C:\inetpub\partial-picking\logs\backend-error.log -Tail 50

# Deployment logs
Get-Content C:\inetpub\partial-picking\logs\deployment.log -Tail 50

# IIS logs
Get-Content C:\inetpub\logs\LogFiles\W3SVC1\u_ex*.log -Tail 50
```

### Health Checks

```powershell
# Single health check
.\health-check.ps1

# Continuous monitoring (Ctrl+C to stop)
.\health-check.ps1 -ContinuousMonitoring -MonitoringIntervalSeconds 60
```

---

## 🚨 Troubleshooting

### Problem: Backend Service Won't Start

```powershell
# Check service status
Get-Service -Name "PartialPickingBackend"

# Check error logs
Get-Content C:\inetpub\partial-picking\logs\backend-error.log -Tail 100

# Try manual start
cd C:\inetpub\partial-picking\backend
.\partial-picking-backend.exe

# Common fixes:
# - Verify .env file exists
# - Check database connectivity
# - Verify port 7075 not in use
Get-NetTCPConnection -LocalPort 7075 -ErrorAction SilentlyContinue
```

### Problem: Frontend Shows 404

```powershell
# Check IIS site status
Get-WebSite -Name "PartialPickingFrontend"

# Verify files exist
Get-ChildItem C:\inetpub\partial-picking\frontend

# Check web.config
Get-Content C:\inetpub\partial-picking\frontend\web.config

# Restart IIS
Restart-WebAppPool -Name "PartialPickingAppPool"
Stop-WebSite -Name "PartialPickingFrontend"
Start-WebSite -Name "PartialPickingFrontend"
```

### Problem: Database Connection Failed

```powershell
# Test database connectivity
Test-NetConnection -ComputerName 192.168.0.86 -Port 49381

# Test SQL authentication
sqlcmd -S 192.168.0.86,49381 -d TFCPILOT3 -U NSW -P B3sp0k3 -Q "SELECT @@VERSION"

# Check firewall
Get-NetFirewallRule -DisplayName "*Partial*" | Where-Object {$_.Enabled -eq $true}
```

### Problem: Health Check Fails

```powershell
# Check all services
Get-Service -Name "PartialPickingBackend"
Get-WebSite -Name "PartialPickingFrontend"
Test-NetConnection -ComputerName localhost -Port 5000

# Try individual health checks
Invoke-RestMethod http://localhost:7075/api/health
Invoke-WebRequest http://localhost:6060
```

---

## 🔄 Rollback Procedure

If deployment fails or issues detected:

```powershell
# Automatic rollback (uses latest backup)
cd scripts\deployment
.\rollback.ps1

# Rollback backend only
.\rollback.ps1 -BackendOnly

# Rollback frontend only
.\rollback.ps1 -FrontendOnly

# Rollback to specific backup
.\rollback.ps1 -BackupPath "C:\inetpub\partial-picking\backend-backup-20251007-103045"

# Force rollback (skip confirmation)
.\rollback.ps1 -Force
```

After rollback:
1. Verify health: `.\health-check.ps1`
2. Test from workstation
3. Review logs to identify failure cause
4. Fix issues before re-deploying

---

## 📞 Support Contacts

| Issue | Contact | Action |
|-------|---------|--------|
| Deployment Failure | DevOps Team | Review logs, consider rollback |
| Database Issues | DBA Team | Check connectivity, permissions |
| Bridge Service Issues | IT Infrastructure | Bridge service is pre-existing |
| LDAP Issues | IT Security | Verify LDAP configuration |
| User Issues | Support Team | User training, troubleshooting |

**Emergency Contact**: support@nwfth.com

---

## 📚 Documentation

**Full Documentation**:
- **DEPLOYMENT.md** - Complete deployment runbook (21.5 KB)
- **PRODUCTION_READINESS_CHECKLIST.md** - Pre-deployment checklist (14 KB)
- **MONITORING_SETUP.md** - Monitoring and alerting (26 KB)
- **quickstart.md** - 10 validation scenarios

**Scripts**:
- `deploy-all.ps1` - Complete orchestration
- `install-backend.ps1` - Backend deployment
- `install-frontend.ps1` - Frontend deployment
- `health-check.ps1` - Health verification
- `rollback.ps1` - Emergency rollback

---

## ⏱️ Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Preparation** | 10 min | Build artifacts, configure .env |
| **Deployment** | 10 min | Run deploy-all.ps1 |
| **Verification** | 5 min | Health checks, manual testing |
| **Monitoring Setup** | 10 min | Configure scheduled tasks |
| **Total** | **35 min** | Complete deployment |

**Recommended Window**: 2 hours (includes buffer for issues)

---

## ✅ Success Criteria

- ✅ Backend service running
- ✅ Frontend site accessible
- ✅ Health checks passing
- ✅ Database connected
- ✅ Bridge service reachable
- ✅ Login working (LDAP + SQL)
- ✅ Workstations can access system
- ✅ No errors in logs
- ✅ All 10 validation scenarios pass

---

**Document Version**: 1.0.0
**Created**: 2025-10-07
**Quick Start Guide for**: Production Deployment Team
