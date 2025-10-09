# Monitoring & Alerting Setup Guide
## Partial Picking System PWA

**Version**: 1.0.0
**Target Environment**: Windows Server @ 192.168.0.10
**Last Updated**: 2025-10-07

---

## Table of Contents

1. [Overview](#overview)
2. [Logging Configuration](#logging-configuration)
3. [Health Check Monitoring](#health-check-monitoring)
4. [Performance Monitoring](#performance-monitoring)
5. [Alerting System](#alerting-system)
6. [Log Rotation](#log-rotation)
7. [Metrics Collection](#metrics-collection)
8. [Dashboard Setup](#dashboard-setup)

---

## Overview

This guide configures monitoring and alerting for the Partial Picking System PWA in production.

### Monitoring Components

| Component | What to Monitor | Alert Threshold |
|-----------|----------------|-----------------|
| **Backend Service** | Health, CPU, Memory, Logs | Service down, >80% CPU, >2GB RAM |
| **Frontend (IIS)** | Site status, Response time | Site stopped, >3s load time |
| **Bridge Service** | WebSocket connectivity | Port 5000 closed, >200ms latency |
| **Database** | Connection, Query time | Connection failed, >100ms queries |
| **Disk Space** | Free space on C: drive | <10% free space |
| **Logs** | Error rate, Warnings | >10 errors/minute |

### Monitoring Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Monitoring Stack                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  Health Checks   │    │  Performance     │           │
│  │  (PowerShell)    │    │  Counters        │           │
│  │  Every 60s       │    │  (CPU/RAM/Disk)  │           │
│  └────────┬─────────┘    └────────┬─────────┘           │
│           │                       │                       │
│           └───────────┬───────────┘                       │
│                       ↓                                   │
│           ┌──────────────────────┐                       │
│           │  Scheduled Tasks     │                       │
│           │  (Windows)           │                       │
│           └──────────┬───────────┘                       │
│                      │                                    │
│           ┌──────────▼──────────┐                        │
│           │  Log Aggregation    │                        │
│           │  (Event Viewer +    │                        │
│           │   File Logs)        │                        │
│           └──────────┬──────────┘                        │
│                      │                                    │
│           ┌──────────▼──────────┐                        │
│           │  Alerting System    │                        │
│           │  (Email/SMS)        │                        │
│           └─────────────────────┘                        │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Logging Configuration

### Backend Logging (Rust + tracing)

The backend uses `tracing` and `tracing-subscriber` for structured JSON logging.

**Log Configuration** (already configured in `backend/src/main.rs`):

```rust
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

// Initialize logging
tracing_subscriber::registry()
    .with(
        EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("info"))
    )
    .with(fmt::layer().json())
    .init();
```

**Log Levels**:
- `error` - Critical errors requiring immediate attention
- `warn` - Warning conditions (degraded performance, retries)
- `info` - Informational messages (API calls, transactions) **← PRODUCTION DEFAULT**
- `debug` - Debugging information (query details, state changes)
- `trace` - Verbose tracing (request/response bodies)

**Production `.env` Configuration**:
```bash
# Logging
RUST_LOG=info,partial_picking_backend=info,sqlx=warn
LOG_FORMAT=json
LOG_LEVEL=info

# Log file paths
BACKEND_LOG_FILE=C:\inetpub\partial-picking\logs\backend.log
BACKEND_ERROR_LOG=C:\inetpub\partial-picking\logs\backend-error.log
```

### Frontend Logging (Browser Console)

Frontend logging uses custom logger with error reporting to backend.

**Configuration** (`frontend/src/utils/logger.ts`):

```typescript
export const logger = {
  error: (message: string, error?: Error) => {
    console.error(message, error);
    // Send to backend /api/logs/error
    fetch('/api/logs/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, error: error?.stack, timestamp: new Date() })
    });
  },
  warn: (message: string) => console.warn(message),
  info: (message: string) => console.log(message),
};
```

### Log File Locations

**Backend Logs**:
```
C:\inetpub\partial-picking\logs\
├── backend.log           (All logs - JSON format)
├── backend-error.log     (Error logs only)
├── deployment.log        (Deployment script logs)
└── rollback.log          (Rollback script logs)
```

**IIS Logs**:
```
C:\inetpub\logs\LogFiles\W3SVC1\
├── u_ex251007.log        (Daily IIS access logs)
```

**Windows Event Logs**:
- Application Log → Source: `PartialPickingBackend`
- System Log → Source: `W3SVC` (IIS)

---

## Health Check Monitoring

### Automated Health Checks

Use the provided `health-check.ps1` script to continuously monitor all services.

#### Setup Scheduled Task

Create scheduled task to run health checks every 5 minutes:

```powershell
# Create health check scheduled task
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\inetpub\partial-picking\scripts\deployment\health-check.ps1"

$trigger = New-ScheduledTaskTrigger `
    -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -RestartCount 3

Register-ScheduledTask `
    -TaskName "PartialPicking-HealthMonitor" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Monitors Partial Picking System health every 5 minutes"
```

#### Manual Health Check

```powershell
# Run once
cd C:\inetpub\partial-picking\scripts\deployment
.\health-check.ps1

# Continuous monitoring (Ctrl+C to stop)
.\health-check.ps1 -ContinuousMonitoring -MonitoringIntervalSeconds 60
```

#### Health Check Endpoints

**Backend Health Endpoint**:
```powershell
Invoke-RestMethod -Uri "http://192.168.0.10:7075/api/health"

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "version": "1.0.0",
#   "uptime_seconds": 12345
# }
```

**Frontend Availability**:
```powershell
$response = Invoke-WebRequest -Uri "http://192.168.0.10:6060" -UseBasicParsing
$response.StatusCode  # Expected: 200
```

**Bridge Service**:
```powershell
Test-NetConnection -ComputerName 192.168.0.10 -Port 5000
# TcpTestSucceeded: True
```

---

## Performance Monitoring

### Windows Performance Counters

Monitor system performance using Performance Monitor (perfmon.msc):

#### Key Metrics to Track

**CPU Usage**:
```powershell
Get-Counter '\Processor(_Total)\% Processor Time' -Continuous
# Alert if: > 80% for 5+ minutes
```

**Memory Usage**:
```powershell
Get-Counter '\Memory\Available MBytes' -Continuous
# Alert if: < 1024 MB (1 GB) available
```

**Disk Space**:
```powershell
Get-PSDrive C | Select-Object Used, Free, @{Name='PercentFree';Expression={($_.Free / ($_.Used + $_.Free)) * 100}}
# Alert if: PercentFree < 10%
```

**Network Traffic**:
```powershell
Get-Counter '\Network Interface(*)\Bytes Total/sec' -Continuous
```

### Application-Specific Metrics

#### API Response Time Monitoring

Create monitoring script: `C:\inetpub\partial-picking\scripts\monitor-api-performance.ps1`

```powershell
# API Performance Monitor
param(
    [int]$IntervalSeconds = 60,
    [int]$ThresholdMs = 1000
)

$logFile = "C:\inetpub\partial-picking\logs\api-performance.log"

while ($true) {
    $start = Get-Date

    try {
        $response = Invoke-WebRequest -Uri "http://192.168.0.10:7075/api/health" -TimeoutSec 5
        $duration = ((Get-Date) - $start).TotalMilliseconds

        $logEntry = @{
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            endpoint = "/api/health"
            status = $response.StatusCode
            duration_ms = [math]::Round($duration, 2)
            threshold_exceeded = $duration -gt $ThresholdMs
        } | ConvertTo-Json -Compress

        Add-Content -Path $logFile -Value $logEntry

        if ($duration -gt $ThresholdMs) {
            Write-Host "⚠️ WARNING: API response time $duration ms exceeds threshold $ThresholdMs ms" -ForegroundColor Yellow
        } else {
            Write-Host "✓ API health check: $duration ms" -ForegroundColor Green
        }

    } catch {
        $errorEntry = @{
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            endpoint = "/api/health"
            error = $_.Exception.Message
        } | ConvertTo-Json -Compress

        Add-Content -Path $logFile -Value $errorEntry
        Write-Host "✗ API health check FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Seconds $IntervalSeconds
}
```

**Setup as Scheduled Task**:
```powershell
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-File C:\inetpub\partial-picking\scripts\monitor-api-performance.ps1"

$trigger = New-ScheduledTaskTrigger `
    -AtStartup

Register-ScheduledTask `
    -TaskName "PartialPicking-APIPerformanceMonitor" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest `
    -User "SYSTEM"
```

### Database Query Performance

Monitor slow queries using SQL Server tools:

```sql
-- Find slow queries (> 100ms)
SELECT
    execution_count,
    total_elapsed_time / execution_count AS avg_elapsed_time_ms,
    SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2) + 1) AS query_text
FROM sys.dm_exec_query_stats AS qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS st
WHERE st.text LIKE '%Partial%'
    AND (total_elapsed_time / execution_count / 1000) > 100
ORDER BY avg_elapsed_time_ms DESC;
```

---

## Alerting System

### Email Alerts

Configure SMTP for email alerting:

#### Setup Email Function

Create: `C:\inetpub\partial-picking\scripts\send-alert-email.ps1`

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$Subject,

    [Parameter(Mandatory=$true)]
    [string]$Body,

    [Parameter(Mandatory=$false)]
    [string]$Priority = "Normal"
)

$smtpServer = "smtp.company.com"
$smtpPort = 587
$from = "alerts@nwfth.com"
$to = @("devops@nwfth.com", "it@nwfth.com")

$smtp = New-Object Net.Mail.SmtpClient($smtpServer, $smtpPort)
$smtp.EnableSsl = $true
$smtp.Credentials = New-Object System.Net.NetworkCredential("alerts@nwfth.com", "password")

$message = New-Object System.Net.Mail.MailMessage
$message.From = $from
$to | ForEach-Object { $message.To.Add($_) }
$message.Subject = "[Partial Picking] $Subject"
$message.Body = $Body
$message.Priority = $Priority

try {
    $smtp.Send($message)
    Write-Host "✓ Alert email sent: $Subject"
} catch {
    Write-Error "Failed to send alert email: $_"
}

$message.Dispose()
```

### Alert Scenarios

#### 1. Service Down Alert

```powershell
# monitor-service-status.ps1
$service = Get-Service -Name "PartialPickingBackend" -ErrorAction SilentlyContinue

if (-not $service -or $service.Status -ne "Running") {
    $body = @"
CRITICAL ALERT: Partial Picking Backend Service Down

Service Status: $($service.Status)
Server: 192.168.0.10
Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Action Required: Investigate service logs and restart if needed.
Logs: C:\inetpub\partial-picking\logs\backend-error.log

Rollback: .\rollback.ps1 (if deployment failed)
"@

    .\send-alert-email.ps1 -Subject "CRITICAL: Backend Service Down" -Body $body -Priority "High"

    # Log to Windows Event Log
    Write-EventLog -LogName Application -Source "PartialPickingBackend" `
        -EventId 1001 -EntryType Error -Message $body
}
```

#### 2. Health Check Failure Alert

```powershell
# monitor-health-check.ps1
try {
    $response = Invoke-RestMethod -Uri "http://192.168.0.10:7075/api/health" -TimeoutSec 10

    if ($response.status -ne "healthy" -or $response.database -ne "connected") {
        $body = @"
WARNING: Partial Picking Health Check Failed

Status: $($response.status)
Database: $($response.database)
Server: 192.168.0.10
Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Action Required: Check database connectivity and backend logs.
"@
        .\send-alert-email.ps1 -Subject "WARNING: Health Check Failed" -Body $body -Priority "High"
    }
} catch {
    $body = @"
CRITICAL: Partial Picking Health Endpoint Unreachable

Error: $($_.Exception.Message)
Server: 192.168.0.10
Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Action Required: Service may be down. Check immediately.
"@
    .\send-alert-email.ps1 -Subject "CRITICAL: Health Endpoint Unreachable" -Body $body -Priority "High"
}
```

#### 3. Performance Degradation Alert

```powershell
# monitor-performance.ps1
$cpuUsage = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
$memoryAvailable = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue

if ($cpuUsage -gt 80) {
    $body = "WARNING: CPU usage at $cpuUsage%. Investigate high CPU processes."
    .\send-alert-email.ps1 -Subject "WARNING: High CPU Usage" -Body $body
}

if ($memoryAvailable -lt 1024) {
    $body = "WARNING: Available memory at $memoryAvailable MB. Risk of memory exhaustion."
    .\send-alert-email.ps1 -Subject "WARNING: Low Memory" -Body $body
}
```

#### 4. Disk Space Alert

```powershell
# monitor-disk-space.ps1
$drive = Get-PSDrive C
$percentFree = ($drive.Free / ($drive.Used + $drive.Free)) * 100

if ($percentFree -lt 10) {
    $body = @"
WARNING: Low Disk Space on C: Drive

Free Space: $([math]::Round($drive.Free / 1GB, 2)) GB
Used Space: $([math]::Round($drive.Used / 1GB, 2)) GB
Percent Free: $([math]::Round($percentFree, 2))%

Action Required: Clean up old logs and temporary files.
"@
    .\send-alert-email.ps1 -Subject "WARNING: Low Disk Space" -Body $body
}
```

### Alert Consolidation

Create master monitoring script that runs all checks:

`C:\inetpub\partial-picking\scripts\monitor-all.ps1`

```powershell
# Master Monitoring Script
$scriptsPath = "C:\inetpub\partial-picking\scripts"

# Service status
& "$scriptsPath\monitor-service-status.ps1"

# Health check
& "$scriptsPath\monitor-health-check.ps1"

# Performance
& "$scriptsPath\monitor-performance.ps1"

# Disk space
& "$scriptsPath\monitor-disk-space.ps1"
```

**Schedule to run every 5 minutes**:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File C:\inetpub\partial-picking\scripts\monitor-all.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask -TaskName "PartialPicking-Monitoring" `
    -Action $action -Trigger $trigger -RunLevel Highest
```

---

## Log Rotation

### Backend Log Rotation

Create log rotation script: `C:\inetpub\partial-picking\scripts\rotate-logs.ps1`

```powershell
# Log Rotation Script
param(
    [int]$RetentionDays = 30,
    [string]$LogPath = "C:\inetpub\partial-picking\logs"
)

Write-Host "Starting log rotation..."

# Get all log files older than retention period
$oldLogs = Get-ChildItem -Path $LogPath -Filter "*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }

foreach ($log in $oldLogs) {
    Write-Host "Deleting old log: $($log.Name) (Last modified: $($log.LastWriteTime))"
    Remove-Item $log.FullName -Force
}

# Archive current logs if they exceed 100MB
$currentLogs = Get-ChildItem -Path $LogPath -Filter "*.log" |
    Where-Object { $_.Length -gt 100MB }

foreach ($log in $currentLogs) {
    $archiveName = "$($log.BaseName)-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    $archivePath = Join-Path $LogPath "archive\$archiveName"

    # Create archive directory if it doesn't exist
    $archiveDir = Join-Path $LogPath "archive"
    if (-not (Test-Path $archiveDir)) {
        New-Item -ItemType Directory -Path $archiveDir | Out-Null
    }

    Write-Host "Archiving large log: $($log.Name) → $archiveName"
    Move-Item $log.FullName $archivePath -Force

    # Create new empty log file
    New-Item -ItemType File -Path $log.FullName | Out-Null
}

Write-Host "Log rotation complete"
```

**Schedule Daily at 2 AM**:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File C:\inetpub\partial-picking\scripts\rotate-logs.ps1"

$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

Register-ScheduledTask -TaskName "PartialPicking-LogRotation" `
    -Action $action -Trigger $trigger -RunLevel Highest
```

### IIS Log Rotation

IIS handles log rotation automatically (daily by default).

**Verify IIS log rotation**:
```powershell
Import-Module WebAdministration
Get-WebConfigurationProperty '/system.applicationHost/sites/siteDefaults' `
    -Name logFile.period
# Expected: Daily
```

---

## Metrics Collection

### Collect Custom Metrics

Create metrics collection script:

`C:\inetpub\partial-picking\scripts\collect-metrics.ps1`

```powershell
# Collect system and application metrics
$metrics = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # System metrics
    cpu_percent = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
    memory_available_mb = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue
    disk_free_gb = [math]::Round((Get-PSDrive C).Free / 1GB, 2)

    # Service status
    backend_service_running = (Get-Service -Name "PartialPickingBackend").Status -eq "Running"
    iis_running = (Get-Service -Name "W3SVC").Status -eq "Running"
    bridge_port_open = (Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet)

    # Health check
    backend_healthy = $false
    database_connected = $false
}

# Try health check
try {
    $health = Invoke-RestMethod -Uri "http://localhost:7075/api/health" -TimeoutSec 5
    $metrics.backend_healthy = $health.status -eq "healthy"
    $metrics.database_connected = $health.database -eq "connected"
} catch {
    # Health check failed
}

# Export metrics (JSON format for easy parsing)
$metricsJson = $metrics | ConvertTo-Json
$metricsFile = "C:\inetpub\partial-picking\logs\metrics-$(Get-Date -Format 'yyyyMMdd').json"
Add-Content -Path $metricsFile -Value $metricsJson

# Output to console
Write-Host $metricsJson
```

**Schedule Every 1 Minute**:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File C:\inetpub\partial-picking\scripts\collect-metrics.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask -TaskName "PartialPicking-MetricsCollection" `
    -Action $action -Trigger $trigger -RunLevel Highest
```

---

## Dashboard Setup

### PowerShell Dashboard (Simple)

Create simple monitoring dashboard:

`C:\inetpub\partial-picking\scripts\show-dashboard.ps1`

```powershell
# Live Monitoring Dashboard
while ($true) {
    Clear-Host

    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "     Partial Picking System - Monitoring Dashboard" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""

    # Services Status
    Write-Host "Services Status:" -ForegroundColor Yellow
    $backendSvc = Get-Service -Name "PartialPickingBackend" -ErrorAction SilentlyContinue
    $iisSvc = Get-Service -Name "W3SVC"

    if ($backendSvc.Status -eq "Running") {
        Write-Host "  ✓ Backend Service: Running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Backend Service: $($backendSvc.Status)" -ForegroundColor Red
    }

    if ($iisSvc.Status -eq "Running") {
        Write-Host "  ✓ IIS Service: Running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ IIS Service: $($iisSvc.Status)" -ForegroundColor Red
    }

    Write-Host ""

    # Health Check
    Write-Host "Health Check:" -ForegroundColor Yellow
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:7075/api/health" -TimeoutSec 5
        Write-Host "  ✓ Backend API: Healthy" -ForegroundColor Green
        Write-Host "  ✓ Database: $($health.database)" -ForegroundColor Green
        Write-Host "  ℹ Version: $($health.version)" -ForegroundColor Cyan
    } catch {
        Write-Host "  ✗ Backend API: Unreachable" -ForegroundColor Red
    }

    Write-Host ""

    # Performance Metrics
    Write-Host "Performance Metrics:" -ForegroundColor Yellow
    $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
    $mem = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue
    $disk = (Get-PSDrive C).Free / 1GB

    $cpuColor = if ($cpu -gt 80) { "Red" } elseif ($cpu -gt 60) { "Yellow" } else { "Green" }
    $memColor = if ($mem -lt 1024) { "Red" } elseif ($mem -lt 2048) { "Yellow" } else { "Green" }
    $diskColor = if ($disk -lt 10) { "Red" } elseif ($disk -lt 20) { "Yellow" } else { "Green" }

    Write-Host "  CPU Usage: $([math]::Round($cpu, 1))%" -ForegroundColor $cpuColor
    Write-Host "  Available RAM: $([math]::Round($mem, 0)) MB" -ForegroundColor $memColor
    Write-Host "  Free Disk (C:): $([math]::Round($disk, 2)) GB" -ForegroundColor $diskColor

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray

    Start-Sleep -Seconds 5
}
```

### Windows Event Viewer Filtering

Create custom Event Viewer filter for Partial Picking events:

1. Open Event Viewer (`eventvwr.msc`)
2. Right-click "Custom Views" → "Create Custom View"
3. Configure filter:
   - Event level: Critical, Warning, Error
   - By source: `PartialPickingBackend`, `W3SVC`
   - Event IDs: 1000-1999 (application events)
4. Save as "Partial Picking System"

---

## Summary

### Monitoring Checklist

- [ ] Backend logging configured (JSON format, info level)
- [ ] Log rotation scheduled (daily, 30-day retention)
- [ ] Health check monitoring scheduled (every 5 minutes)
- [ ] Performance monitoring configured (CPU, RAM, disk)
- [ ] Email alerting configured (SMTP setup)
- [ ] Alert scenarios implemented (service down, health fail, performance)
- [ ] Metrics collection scheduled (every 1 minute)
- [ ] Dashboard created or monitoring console configured
- [ ] Windows Event Viewer custom view created

### Quick Commands

```powershell
# Run health checks
.\scripts\deployment\health-check.ps1

# View dashboard
.\scripts\show-dashboard.ps1

# Check service status
Get-Service -Name "PartialPickingBackend"

# View recent errors
Get-Content C:\inetpub\partial-picking\logs\backend-error.log -Tail 50

# View performance metrics
Get-Content C:\inetpub\partial-picking\logs\metrics-$(Get-Date -Format 'yyyyMMdd').json -Tail 1

# Test email alerting
.\scripts\send-alert-email.ps1 -Subject "Test Alert" -Body "This is a test"
```

---

**Document Version**: 1.0.0
**Created**: 2025-10-07
**Maintainer**: DevOps Team
**Next Review**: 2025-11-07
