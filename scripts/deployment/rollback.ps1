# ==============================================================================
# Partial Picking System PWA - Rollback Script
# ==============================================================================
# Purpose: Rollback to previous deployment in case of issues
# Target: Restore both backend and frontend from backup
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$BackupPath = "",

    [Parameter(Mandatory=$false)]
    [string]$BackendInstallPath = "C:\inetpub\partial-picking\backend",

    [Parameter(Mandatory=$false)]
    [string]$FrontendInstallPath = "C:\inetpub\partial-picking\frontend",

    [Parameter(Mandatory=$false)]
    [switch]$BackendOnly = $false,

    [Parameter(Mandatory=$false)]
    [switch]$FrontendOnly = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage

    $logDir = "C:\inetpub\partial-picking\logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -Path "$logDir\rollback.log" -Value $logMessage
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-LatestBackup {
    param([string]$BasePath)

    $backups = Get-ChildItem -Path (Split-Path $BasePath -Parent) -Directory |
               Where-Object { $_.Name -like "$(Split-Path $BasePath -Leaf)-backup-*" } |
               Sort-Object Name -Descending

    if ($backups) {
        return $backups[0].FullName
    } else {
        return $null
    }
}

function Confirm-Rollback {
    param([string]$BackupPath, [string]$Target)

    if ($Force) {
        return $true
    }

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                         ROLLBACK CONFIRMATION"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "You are about to rollback: $Target" -ForegroundColor Yellow
    Write-Host "Backup source: $BackupPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This will:" -ForegroundColor Yellow
    Write-Host "  1. Stop the current service" -ForegroundColor Yellow
    Write-Host "  2. Replace current files with backup files" -ForegroundColor Yellow
    Write-Host "  3. Restart the service" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Current deployment will be overwritten!" -ForegroundColor Red
    Write-Host ""

    $response = Read-Host "Do you want to continue? (yes/no)"

    return ($response -eq "yes" -or $response -eq "y")
}

function Rollback-Backend {
    param([string]$BackupPath)

    Write-Log "Starting backend rollback from: $BackupPath" "INFO"

    # Stop backend service
    Write-Log "Stopping backend service" "INFO"
    $service = Get-Service -Name "PartialPickingBackend" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Stop-Service -Name "PartialPickingBackend" -Force -ErrorAction Stop
        Start-Sleep -Seconds 3
        Write-Log "Backend service stopped" "SUCCESS"
    }

    # Create emergency backup of current state
    if (Test-Path $BackendInstallPath) {
        $emergencyBackup = "$BackendInstallPath-before-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Log "Creating emergency backup: $emergencyBackup" "INFO"
        Copy-Item -Path $BackendInstallPath -Destination $emergencyBackup -Recurse -Force
    }

    # Remove current installation
    Write-Log "Removing current backend installation" "INFO"
    if (Test-Path $BackendInstallPath) {
        Remove-Item -Path "$BackendInstallPath\*" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Path $BackendInstallPath -Force | Out-Null
    }

    # Restore from backup
    Write-Log "Restoring backend from backup" "INFO"
    Copy-Item -Path "$BackupPath\*" -Destination $BackendInstallPath -Recurse -Force

    # Start backend service
    Write-Log "Starting backend service" "INFO"
    Start-Service -Name "PartialPickingBackend" -ErrorAction Stop
    Start-Sleep -Seconds 5

    # Verify service started
    $service = Get-Service -Name "PartialPickingBackend"
    if ($service.Status -eq "Running") {
        Write-Log "Backend service started successfully" "SUCCESS"

        # Run health check
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:7075/api/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Log "Backend health check PASSED" "SUCCESS"
            } else {
                Write-Log "Backend health check returned status: $($response.StatusCode)" "WARN"
            }
        } catch {
            Write-Log "Backend health check FAILED: $_" "ERROR"
            throw "Backend rollback completed but health check failed"
        }
    } else {
        throw "Backend service failed to start after rollback"
    }

    Write-Log "Backend rollback completed successfully" "SUCCESS"
}

function Rollback-Frontend {
    param([string]$BackupPath)

    Write-Log "Starting frontend rollback from: $BackupPath" "INFO"

    # Stop IIS site
    Write-Log "Stopping IIS site" "INFO"
    Import-Module WebAdministration -ErrorAction Stop

    $site = Get-WebSite -Name "PartialPickingFrontend" -ErrorAction SilentlyContinue
    if ($site -and $site.State -eq "Started") {
        Stop-WebSite -Name "PartialPickingFrontend" -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Log "IIS site stopped" "SUCCESS"
    }

    # Create emergency backup of current state
    if (Test-Path $FrontendInstallPath) {
        $emergencyBackup = "$FrontendInstallPath-before-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Log "Creating emergency backup: $emergencyBackup" "INFO"
        Copy-Item -Path $FrontendInstallPath -Destination $emergencyBackup -Recurse -Force
    }

    # Remove current installation
    Write-Log "Removing current frontend installation" "INFO"
    if (Test-Path $FrontendInstallPath) {
        Remove-Item -Path "$FrontendInstallPath\*" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Path $FrontendInstallPath -Force | Out-Null
    }

    # Restore from backup
    Write-Log "Restoring frontend from backup" "INFO"
    Copy-Item -Path "$BackupPath\*" -Destination $FrontendInstallPath -Recurse -Force

    # Start IIS site
    Write-Log "Starting IIS site" "INFO"
    Start-WebSite -Name "PartialPickingFrontend" -ErrorAction Stop
    Start-Sleep -Seconds 3

    # Verify site started
    $site = Get-WebSite -Name "PartialPickingFrontend"
    if ($site.State -eq "Started") {
        Write-Log "IIS site started successfully" "SUCCESS"

        # Run availability check
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:6060" -Method Get -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Log "Frontend availability check PASSED" "SUCCESS"
            } else {
                Write-Log "Frontend availability check returned status: $($response.StatusCode)" "WARN"
            }
        } catch {
            Write-Log "Frontend availability check FAILED: $_" "ERROR"
            throw "Frontend rollback completed but availability check failed"
        }
    } else {
        throw "IIS site failed to start after rollback"
    }

    Write-Log "Frontend rollback completed successfully" "SUCCESS"
}

function Show-RollbackSummary {
    param([bool]$BackendRolledBack, [bool]$FrontendRolledBack)

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      ROLLBACK SUMMARY"
    Write-Host "=============================================================================="
    Write-Host ""

    if ($BackendRolledBack) {
        Write-Host "✓ Backend rolled back successfully" -ForegroundColor Green
        Write-Host "  Service:  Running" -ForegroundColor Green
        Write-Host "  Health:   Verified" -ForegroundColor Green
    }

    if ($FrontendRolledBack) {
        Write-Host "✓ Frontend rolled back successfully" -ForegroundColor Green
        Write-Host "  Site:     Started" -ForegroundColor Green
        Write-Host "  Access:   Verified" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Emergency backups created before rollback:" -ForegroundColor Yellow

    if ($BackendRolledBack) {
        $backendEmergency = Get-ChildItem -Path (Split-Path $BackendInstallPath -Parent) -Directory |
                           Where-Object { $_.Name -like "*backend-before-rollback-*" } |
                           Sort-Object Name -Descending |
                           Select-Object -First 1
        if ($backendEmergency) {
            Write-Host "  Backend:  $($backendEmergency.FullName)" -ForegroundColor Yellow
        }
    }

    if ($FrontendRolledBack) {
        $frontendEmergency = Get-ChildItem -Path (Split-Path $FrontendInstallPath -Parent) -Directory |
                            Where-Object { $_.Name -like "*frontend-before-rollback-*" } |
                            Sort-Object Name -Descending |
                            Select-Object -First 1
        if ($frontendEmergency) {
            Write-Host "  Frontend: $($frontendEmergency.FullName)" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Run health checks: .\health-check.ps1" -ForegroundColor White
    Write-Host "  2. Test all 10 validation scenarios" -ForegroundColor White
    Write-Host "  3. Investigate root cause of deployment failure" -ForegroundColor White
    Write-Host "  4. Re-deploy when issues are resolved" -ForegroundColor White
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host ""
}

# ==============================================================================
# MAIN ROLLBACK SCRIPT
# ==============================================================================

try {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "           Partial Picking System - Rollback Script"
    Write-Host "=============================================================================="
    Write-Host ""

    # Pre-flight checks
    Write-Log "Starting rollback process" "INFO"

    if (-not (Test-Administrator)) {
        throw "This script requires Administrator privileges. Run PowerShell as Administrator."
    }
    Write-Log "Administrator privileges confirmed" "SUCCESS"

    # Determine what to rollback
    $rollbackBackend = -not $FrontendOnly
    $rollbackFrontend = -not $BackendOnly

    # Find backup paths
    if (-not $BackupPath) {
        Write-Log "No backup path specified, searching for latest backups..." "INFO"

        if ($rollbackBackend) {
            $backendBackupPath = Find-LatestBackup -BasePath $BackendInstallPath
            if (-not $backendBackupPath) {
                throw "No backend backup found. Cannot rollback backend."
            }
            Write-Log "Found backend backup: $backendBackupPath" "INFO"
        }

        if ($rollbackFrontend) {
            $frontendBackupPath = Find-LatestBackup -BasePath $FrontendInstallPath
            if (-not $frontendBackupPath) {
                throw "No frontend backup found. Cannot rollback frontend."
            }
            Write-Log "Found frontend backup: $frontendBackupPath" "INFO"
        }
    } else {
        # Use specified backup path for both
        $backendBackupPath = $BackupPath
        $frontendBackupPath = $BackupPath
    }

    # Confirm rollback
    if ($rollbackBackend) {
        if (-not (Confirm-Rollback -BackupPath $backendBackupPath -Target "Backend")) {
            Write-Host "Rollback cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }

    if ($rollbackFrontend -and -not $rollbackBackend) {
        if (-not (Confirm-Rollback -BackupPath $frontendBackupPath -Target "Frontend")) {
            Write-Host "Rollback cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }

    # Perform rollback
    $backendRolledBack = $false
    $frontendRolledBack = $false

    if ($rollbackBackend) {
        Rollback-Backend -BackupPath $backendBackupPath
        $backendRolledBack = $true
    }

    if ($rollbackFrontend) {
        Rollback-Frontend -BackupPath $frontendBackupPath
        $frontendRolledBack = $true
    }

    # Show summary
    Show-RollbackSummary -BackendRolledBack $backendRolledBack -FrontendRolledBack $frontendRolledBack

    Write-Log "Rollback completed successfully" "SUCCESS"

} catch {
    Write-Log "Rollback failed: $_" "ERROR"
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                        ROLLBACK FAILED"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check rollback logs: C:\inetpub\partial-picking\logs\rollback.log" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Emergency backups were created before rollback attempt." -ForegroundColor Yellow
    Write-Host "You may need to manually restore from backups." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host ""
    exit 1
}
