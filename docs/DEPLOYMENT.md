# Deployment Guide

**Partial Picking System PWA - Production Deployment**

Version: 1.0.0 | Last Updated: 2025-10-07

---

## Table of Contents

1. [Overview](#overview)
2. [Production Architecture](#production-architecture)
3. [Prerequisites](#prerequisites)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Bridge Service Configuration](#bridge-service-configuration)
8. [Database Configuration](#database-configuration)
9. [Health Checks](#health-checks)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Rollback Procedures](#rollback-procedures)
12. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying the Partial Picking System PWA to the production environment at Newly Weds Foods Thailand.

**Production Environment**:
- **Application Server**: 192.168.0.10 (Windows Server 2019/2022)
- **Database Server**: 192.168.0.86:49381 (SQL Server TFCPILOT3)
- **Workstations**: WS1, WS2, WS3, WS4 (1280x1024 touchscreen displays)
- **Weight Scales**: SMALL (COM1), BIG (COM2) per workstation

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│        Warehouse Network (192.168.0.x)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WS1         │  │  WS2         │  │  WS3         │     │
│  │  Browser     │  │  Browser     │  │  Browser     │ ... │
│  │  1280x1024   │  │  1280x1024   │  │  1280x1024   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                  HTTP + WebSocket                           │
│                            ↓                                │
│         ┌──────────────────────────────────┐               │
│         │   192.168.0.10 (Windows Server)  │               │
│         ├──────────────────────────────────┤               │
│         │  Frontend (IIS :6060)            │               │
│         │  Backend (Service :7075)         │               │
│         │  Bridge (Service :5000)          │               │
│         └─────────┬──────────────┬─────────┘               │
│                   │              │                          │
│         SQL       │              │ Serial (Weight Scales)   │
│                   ↓              ↓                          │
│         ┌─────────────────┐  ┌──────────────────────┐     │
│         │  SQL Server     │  │  Weight Scales       │     │
│         │  192.168.0.86   │  │  COM1, COM2 per WS   │     │
│         │  :49381         │  │  (SMALL, BIG)        │     │
│         └─────────────────┘  └──────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Server Requirements

**Windows Server @ 192.168.0.10**:
- Windows Server 2019/2022 or later
- 4 GB RAM minimum (8 GB recommended)
- 50 GB available disk space
- IIS 10.0 or later installed
- .NET 8 Runtime installed
- Access to database server (192.168.0.86:49381)

### Software Dependencies

1. **IIS (Internet Information Services)**
   - Installed and configured
   - Static Content feature enabled
   - URL Rewrite module installed

2. **.NET 8 Runtime**
   ```powershell
   # Download from: https://dotnet.microsoft.com/download/dotnet/8.0
   # Install ASP.NET Core Runtime 8.0.x
   ```

3. **NSSM (Non-Sucking Service Manager)** - for backend service
   ```powershell
   # Download from: https://nssm.cc/download
   # Extract to C:\Tools\nssm\
   ```

### Network Requirements

- Port 6060 open for frontend (HTTP)
- Port 7075 open for backend (HTTP API)
- Port 5000 open for bridge service (WebSocket)
- Access to 192.168.0.86:49381 (SQL Server)
- Access to 192.168.0.1 (LDAP server)

### Database Access

Verify database connectivity:
```powershell
# Test SQL Server connection
Test-NetConnection -ComputerName 192.168.0.86 -Port 49381
```

---

## Pre-Deployment Checklist

### ✅ Code Preparation

- [ ] All tests passing (backend + frontend)
- [ ] Code review completed
- [ ] Constitutional compliance verified
- [ ] Production .env configured
- [ ] Release builds successful

### ✅ Environment Setup

- [ ] Windows Server 192.168.0.10 accessible
- [ ] IIS installed and configured
- [ ] .NET 8 Runtime installed
- [ ] NSSM installed for Windows services
- [ ] Database connectivity verified
- [ ] LDAP connectivity verified

### ✅ Backup Plan

- [ ] Previous version backed up
- [ ] Database backup created
- [ ] Rollback procedure documented
- [ ] Downtime window scheduled

---

## Backend Deployment

### Step 1: Build Release Binary

On development machine or build server:

```bash
cd backend
cargo build --release
```

**Output**: `backend/target/release/backend.exe` (Windows) or `backend` (Linux)

### Step 2: Prepare Production Environment

Create directory structure on 192.168.0.10:

```powershell
# Create application directories
New-Item -Path "C:\PartialPicking\backend" -ItemType Directory -Force
New-Item -Path "C:\PartialPicking\logs" -ItemType Directory -Force
New-Item -Path "C:\PartialPicking\config" -ItemType Directory -Force
```

### Step 3: Transfer Files

Copy build artifacts to production server:

```powershell
# From development machine (using PowerShell remoting or file share)
Copy-Item -Path "backend\target\release\backend.exe" -Destination "\\192.168.0.10\C$\PartialPicking\backend\"
```

### Step 4: Configure Production Environment

Create `C:\PartialPicking\config\.env`:

```bash
# Production Environment Configuration
RUST_ENV=production
RUST_LOG=info
RUST_BACKTRACE=0

# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=7075

# CORS (allow production frontend origin)
CORS_ALLOWED_ORIGINS=http://192.168.0.10:6060

# Database Configuration
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
DATABASE_NAME=TFCPILOT3
DATABASE_USER=NSW
DATABASE_PASSWORD=B3sp0k3
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=5

# Authentication
LDAP_URL=ldap://192.168.0.1
LDAP_BASE_DN=DC=NWFTH,DC=com
LDAP_ENABLED=true

# JWT Configuration (CRITICAL: Use strong secret in production)
JWT_SECRET=PRODUCTION_SECRET_CHANGE_THIS_TO_STRONG_RANDOM_VALUE
JWT_DURATION_HOURS=168

# Application Information
APP_NAME=Partial Picking System
APP_VERSION=1.0.0
ENABLE_REQUEST_LOGGING=true
LOG_LEVEL=info
```

**⚠️ SECURITY**: Generate a strong JWT secret:
```powershell
# Generate random JWT secret (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Step 5: Install as Windows Service (Using NSSM)

```powershell
# Navigate to NSSM directory
cd C:\Tools\nssm\win64

# Install service
.\nssm.exe install PartialPickingBackend "C:\PartialPicking\backend\backend.exe"

# Configure service
.\nssm.exe set PartialPickingBackend AppDirectory "C:\PartialPicking\backend"
.\nssm.exe set PartialPickingBackend AppEnvironmentExtra "ENV_FILE=C:\PartialPicking\config\.env"
.\nssm.exe set PartialPickingBackend DisplayName "Partial Picking Backend Service"
.\nssm.exe set PartialPickingBackend Description "Rust backend service for Partial Picking System PWA"
.\nssm.exe set PartialPickingBackend Start SERVICE_AUTO_START
.\nssm.exe set PartialPickingBackend AppStdout "C:\PartialPicking\logs\backend-stdout.log"
.\nssm.exe set PartialPickingBackend AppStderr "C:\PartialPicking\logs\backend-stderr.log"
.\nssm.exe set PartialPickingBackend AppRotateFiles 1
.\nssm.exe set PartialPickingBackend AppRotateOnline 1
.\nssm.exe set PartialPickingBackend AppRotateSeconds 86400
.\nssm.exe set PartialPickingBackend AppRotateBytes 10485760

# Start service
.\nssm.exe start PartialPickingBackend

# Verify service status
.\nssm.exe status PartialPickingBackend
```

**Alternative: Manual Service Creation**

```powershell
# Create Windows Service using sc.exe
sc.exe create PartialPickingBackend binPath="C:\PartialPicking\backend\backend.exe" start=auto
sc.exe description PartialPickingBackend "Partial Picking Backend Service"
sc.exe start PartialPickingBackend
```

### Step 6: Verify Backend Service

```powershell
# Check service status
Get-Service -Name PartialPickingBackend

# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:7075/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0"
}
```

---

## Frontend Deployment

### Step 1: Build Production Bundle

On development machine:

```bash
cd frontend
npm run build
```

**Output**: `frontend/dist/` directory containing static files

### Step 2: Configure IIS Website

On production server (192.168.0.10):

```powershell
# Import IIS module
Import-Module WebAdministration

# Create website directory
New-Item -Path "C:\inetpub\wwwroot\PartialPicking" -ItemType Directory -Force

# Create IIS website
New-Website -Name "PartialPickingFrontend" `
  -Port 6060 `
  -PhysicalPath "C:\inetpub\wwwroot\PartialPicking" `
  -ApplicationPool "DefaultAppPool"

# Set permissions
icacls "C:\inetpub\wwwroot\PartialPicking" /grant "IIS_IUSRS:(OI)(CI)R"
```

### Step 3: Transfer Frontend Files

Copy built files to IIS directory:

```powershell
# From development machine
Copy-Item -Path "frontend\dist\*" -Destination "\\192.168.0.10\C$\inetpub\wwwroot\PartialPicking\" -Recurse -Force
```

### Step 4: Configure URL Rewrite (for SPA Routing)

Create `C:\inetpub\wwwroot\PartialPicking\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".woff" mimeType="application/font-woff" />
      <mimeMap fileExtension=".woff2" mimeType="application/font-woff2" />
    </staticContent>
  </system.webServer>
</configuration>
```

### Step 5: Configure Frontend Environment Variables

Edit `C:\inetpub\wwwroot\PartialPicking\assets\config.js`:

```javascript
window.__APP_CONFIG__ = {
  apiUrl: 'http://192.168.0.10:7075/api',
  wsUrl: 'ws://192.168.0.10:5000',
  environment: 'production'
};
```

**Note**: If using Vite env vars, ensure `.env.production` was used during build.

### Step 6: Verify Frontend Deployment

```powershell
# Test frontend endpoint
Invoke-WebRequest -Uri "http://localhost:6060" -UseBasicParsing
```

Access from workstation browser: **http://192.168.0.10:6060**

---

## Bridge Service Configuration

### Overview

The bridge service (Weight Scale WebSocket) should **already be running** at port 5000. This deployment guide assumes the existing bridge service is operational.

### Verify Bridge Service

```powershell
# Check if bridge service is running
Get-Service -Name "WeightScaleBridge" -ErrorAction SilentlyContinue

# Test WebSocket health
# Install wscat if needed: npm install -g wscat
wscat -c ws://localhost:5000/ws/health
```

### If Bridge Service Needs Deployment

1. Build .NET 8 bridge service:
   ```bash
   cd bridge
   dotnet publish -c Release -o C:\PartialPicking\bridge
   ```

2. Install as Windows Service:
   ```powershell
   sc.exe create WeightScaleBridge binPath="C:\PartialPicking\bridge\bridge.exe" start=auto
   sc.exe start WeightScaleBridge
   ```

3. Configure workstation scale assignments in database (`TFC_Weightscale2`, `TFC_workstation2` tables)

**⚠️ IMPORTANT**: Do NOT modify the existing bridge service unless required. It handles weight scale communication for other applications.

---

## Database Configuration

### Verify Database Connectivity

```powershell
# Test SQL Server connection
$connectionString = "Server=192.168.0.86,49381;Database=TFCPILOT3;User Id=NSW;Password=B3sp0k3;TrustServerCertificate=True"

# Using SqlClient (PowerShell)
$connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
try {
    $connection.Open()
    Write-Host "Database connection successful"
    $connection.Close()
} catch {
    Write-Error "Database connection failed: $_"
}
```

### Database Migrations

**Current Version**: No migrations required (using existing database schema)

**Future Migrations**: Use Rust migrations or SQL scripts in `backend/migrations/`

---

## Health Checks

### Backend Health Check

```powershell
# Health endpoint
Invoke-RestMethod -Uri "http://192.168.0.10:7075/api/health" -Method Get
```

**Expected Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0",
  "uptime": "3h 24m"
}
```

### Frontend Health Check

```powershell
# Check frontend accessibility
Invoke-WebRequest -Uri "http://192.168.0.10:6060" -UseBasicParsing | Select-Object StatusCode
```

**Expected**: Status Code 200

### Bridge Service Health Check

```powershell
# WebSocket health check (requires wscat)
wscat -c ws://192.168.0.10:5000/ws/health
```

### End-to-End Health Check

```powershell
# Test complete workflow
$token = (Invoke-RestMethod -Uri "http://192.168.0.10:7075/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"dechawat","password":"TestPassword123"}').token

Invoke-RestMethod -Uri "http://192.168.0.10:7075/api/runs/6000037" `
  -Headers @{ Authorization = "Bearer $token" }
```

---

## Monitoring and Logging

### Log Locations

**Backend Logs**:
- **Stdout**: `C:\PartialPicking\logs\backend-stdout.log`
- **Stderr**: `C:\PartialPicking\logs\backend-stderr.log`
- **Rotation**: Daily, 30-day retention

**Frontend Logs**:
- **IIS Logs**: `C:\inetpub\logs\LogFiles\W3SVC1\`
- **Browser Console**: Client-side errors

**Bridge Logs**:
- **Location**: `C:\Weight-scale\bridge-service\logs\`
- **Rotation**: Daily

### Log Rotation Configuration

NSSM handles backend log rotation automatically (configured in Step 5).

For manual log rotation:

```powershell
# Create scheduled task for log cleanup
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-File C:\PartialPicking\scripts\rotate-logs.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "PartialPicking-LogRotation" `
  -Action $action -Trigger $trigger -User "SYSTEM"
```

### Monitoring Recommendations

1. **Windows Event Viewer**: Monitor service start/stop events
2. **Performance Monitor**: Track CPU, memory, disk usage
3. **SQL Server Monitoring**: Monitor database performance
4. **Network Monitoring**: Track API response times

---

## Rollback Procedures

### Rollback Checklist

- [ ] Stop services before rollback
- [ ] Verify backup availability
- [ ] Test rollback in staging (if available)
- [ ] Notify users of rollback

### Backend Rollback

```powershell
# Stop current service
Stop-Service -Name PartialPickingBackend

# Restore previous version
Copy-Item -Path "C:\PartialPicking\backup\backend-v0.9.0\backend.exe" `
  -Destination "C:\PartialPicking\backend\backend.exe" -Force

# Restore previous .env (if needed)
Copy-Item -Path "C:\PartialPicking\backup\config\.env.v0.9.0" `
  -Destination "C:\PartialPicking\config\.env" -Force

# Start service
Start-Service -Name PartialPickingBackend

# Verify health
Invoke-RestMethod -Uri "http://localhost:7075/api/health"
```

### Frontend Rollback

```powershell
# Stop IIS website
Stop-Website -Name "PartialPickingFrontend"

# Restore previous version
Remove-Item -Path "C:\inetpub\wwwroot\PartialPicking\*" -Recurse -Force
Copy-Item -Path "C:\PartialPicking\backup\frontend-v0.9.0\*" `
  -Destination "C:\inetpub\wwwroot\PartialPicking\" -Recurse -Force

# Start IIS website
Start-Website -Name "PartialPickingFrontend"
```

### Database Rollback

**⚠️ WARNING**: Database rollback requires careful planning.

```sql
-- Restore from backup (SQL Server Management Studio)
RESTORE DATABASE TFCPILOT3
FROM DISK = 'C:\Backups\TFCPILOT3_PreDeploy.bak'
WITH REPLACE;
```

---

## Troubleshooting

### Backend Service Won't Start

**Symptoms**: Service fails to start or crashes immediately

**Diagnosis**:
```powershell
# Check service status
Get-Service -Name PartialPickingBackend | Select-Object Status, StartType

# Check logs
Get-Content "C:\PartialPicking\logs\backend-stderr.log" -Tail 50

# Test manually
cd C:\PartialPicking\backend
.\backend.exe
```

**Common Causes**:
- Database connection failure (check .env credentials)
- Port 7075 already in use
- Missing .env file
- File permissions issue

---

### Frontend Shows 404 Errors

**Symptoms**: Navigation works initially but 404 on refresh

**Fix**: Ensure `web.config` with URL Rewrite rules is present (see Step 4 of Frontend Deployment)

---

### WebSocket Connection Fails

**Symptoms**: Weight updates not received

**Diagnosis**:
```powershell
# Check bridge service
Get-Service -Name "WeightScaleBridge"

# Test WebSocket manually
wscat -c ws://192.168.0.10:5000/ws/scale/WS-001/small
```

**Common Causes**:
- Bridge service not running
- Firewall blocking port 5000
- Incorrect workstation/scale configuration in database

---

### LDAP Authentication Fails

**Symptoms**: Login fails for LDAP users, works for SQL users

**Diagnosis**:
```powershell
# Test LDAP connectivity
Test-NetConnection -ComputerName 192.168.0.1 -Port 389

# Check .env LDAP configuration
Get-Content "C:\PartialPicking\config\.env" | Select-String "LDAP"
```

**Fix**: Verify LDAP_URL and LDAP_BASE_DN in .env

---

### Database Connection Timeout

**Symptoms**: API returns 500 errors with database timeout

**Diagnosis**:
```sql
-- Check active connections (SQL Server)
SELECT * FROM sys.dm_exec_sessions WHERE program_name LIKE '%Partial%';
```

**Fix**:
- Increase `DATABASE_MAX_CONNECTIONS` in .env
- Optimize slow queries
- Check database server performance

---

## Post-Deployment Validation

### Validation Checklist

Execute all 10 validation scenarios from [quickstart.md](../specs/001-i-have-an/quickstart.md):

- [ ] Scenario 1: Backend API Health Check
- [ ] Scenario 2: LDAP Authentication
- [ ] Scenario 3: SQL Authentication
- [ ] Scenario 4: Run Details Auto-Population
- [ ] Scenario 5: Batch Items with Weight Range
- [ ] Scenario 6: FEFO Lot Selection
- [ ] Scenario 7: 4-Phase Atomic Pick Transaction
- [ ] Scenario 8: Weight Tolerance Validation
- [ ] Scenario 9: WebSocket Weight Stream
- [ ] Scenario 10: Frontend End-to-End Flow

### Performance Baseline

- API Response Time: < 500ms
- WebSocket Latency: < 200ms
- Frontend Load Time: < 3 seconds
- Database Query Time: < 100ms (average)

---

## Support

**Documentation**: [docs/](../docs/)
**Troubleshooting**: [docs/API.md](./API.md), [specs/001-i-have-an/quickstart.md](../specs/001-i-have-an/quickstart.md)
**Email**: support@nwfth.com

---

*Last Updated: 2025-10-07 | Version 1.0.0*
