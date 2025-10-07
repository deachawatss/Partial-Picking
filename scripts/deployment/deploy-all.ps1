# ==============================================================================
# Partial Picking System PWA - Complete Deployment Script
# ==============================================================================
# Purpose: Orchestrate full deployment (Backend + Frontend)
# Target: 192.168.0.10 (Windows Server)
# Usage: .\deploy-all.ps1 [-SkipBackup] [-SkipTests] [-Force]
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipBackup = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipTests = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Force = $false,

    [Parameter(Mandatory=$false)]
    [switch]$BackendOnly = $false,

    [Parameter(Mandatory=$false)]
    [switch]$FrontendOnly = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ==============================================================================
# CONFIGURATION
# ==============================================================================

$script:deploymentConfig = @{
    ProjectRoot = $PSScriptRoot | Split-Path -Parent | Split-Path -Parent
    LogPath = "C:\inetpub\partial-picking\logs\deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    BackupPath = ""
    DeploymentStartTime = Get-Date
    BackendDeployed = $false
    FrontendDeployed = $false
    HealthCheckPassed = $false
}

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage

    $logDir = Split-Path $script:deploymentConfig.LogPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -Path $script:deploymentConfig.LogPath -Value $logMessage
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Prerequisites {
    Write-Host ""
    Write-Host "Checking prerequisites..." -ForegroundColor Cyan
    Write-Log "Checking deployment prerequisites" "INFO"

    $issues = @()

    # Check administrator privileges
    if (-not (Test-Administrator)) {
        $issues += "Administrator privileges required"
    } else {
        Write-Log "✓ Administrator privileges confirmed" "SUCCESS"
    }

    # Check IIS installed
    $iisFeature = Get-WindowsFeature -Name "Web-Server" -ErrorAction SilentlyContinue
    if (-not $iisFeature -or $iisFeature.InstallState -ne "Installed") {
        $issues += "IIS is not installed"
    } else {
        Write-Log "✓ IIS is installed" "SUCCESS"
    }

    # Check if database is reachable
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("192.168.0.86", 49381)
        if ($tcpClient.Connected) {
            Write-Log "✓ Database server is reachable" "SUCCESS"
            $tcpClient.Close()
        }
    } catch {
        $issues += "Database server (192.168.0.86:49381) is not reachable"
    }

    # Check backend binary exists
    $backendBinary = Join-Path $script:deploymentConfig.ProjectRoot "backend\target\release\partial-picking-backend.exe"
    if (-not (Test-Path $backendBinary)) {
        $issues += "Backend binary not found. Run: cargo build --release"
    } else {
        Write-Log "✓ Backend binary found" "SUCCESS"
    }

    # Check frontend dist exists
    $frontendDist = Join-Path $script:deploymentConfig.ProjectRoot "frontend\dist"
    if (-not (Test-Path $frontendDist)) {
        $issues += "Frontend dist not found. Run: npm run build"
    } else {
        Write-Log "✓ Frontend dist found" "SUCCESS"
    }

    # Check .env.production exists
    $envFile = Join-Path $script:deploymentConfig.ProjectRoot ".env.production"
    if (-not (Test-Path $envFile)) {
        $issues += "Production environment file (.env.production) not found"
    } else {
        Write-Log "✓ Production environment file found" "SUCCESS"
    }

    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-Host "Prerequisites check FAILED:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  ✗ $issue" -ForegroundColor Red
        }
        Write-Host ""
        throw "Prerequisites not met. Fix issues above before deploying."
    }

    Write-Host ""
    Write-Host "All prerequisites met ✓" -ForegroundColor Green
    Write-Log "All prerequisites met" "SUCCESS"
}

function Confirm-Deployment {
    if ($Force) {
        return $true
    }

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      DEPLOYMENT CONFIRMATION"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "You are about to deploy to PRODUCTION:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Target Server:     192.168.0.10 (Windows Server)" -ForegroundColor White
    Write-Host "  Backend:           Port 7075 (Windows Service)" -ForegroundColor White
    Write-Host "  Frontend:          Port 6060 (IIS)" -ForegroundColor White
    Write-Host "  Database:          192.168.0.86:49381 (TFCPILOT3)" -ForegroundColor White
    Write-Host ""

    if (-not $SkipBackup) {
        Write-Host "  Backup:            Enabled ✓" -ForegroundColor Green
    } else {
        Write-Host "  Backup:            SKIPPED ⚠" -ForegroundColor Yellow
    }

    if (-not $SkipTests) {
        Write-Host "  Health Checks:     Enabled ✓" -ForegroundColor Green
    } else {
        Write-Host "  Health Checks:     SKIPPED ⚠" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "This will:" -ForegroundColor Yellow
    Write-Host "  1. Stop existing services" -ForegroundColor Yellow
    Write-Host "  2. Deploy new binaries" -ForegroundColor Yellow
    Write-Host "  3. Restart services" -ForegroundColor Yellow
    Write-Host "  4. Run health checks" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Production users may experience brief downtime!" -ForegroundColor Red
    Write-Host ""

    $response = Read-Host "Do you want to continue? (yes/no)"

    return ($response -eq "yes" -or $response -eq "y")
}

function Deploy-Backend {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      DEPLOYING BACKEND"
    Write-Host "=============================================================================="
    Write-Host ""

    Write-Log "Starting backend deployment" "INFO"

    $scriptPath = Join-Path $PSScriptRoot "install-backend.ps1"

    $params = @{}
    if ($SkipBackup) {
        $params['Backup'] = $false
    }

    try {
        & $scriptPath @params

        if ($LASTEXITCODE -eq 0) {
            Write-Log "Backend deployment completed successfully" "SUCCESS"
            $script:deploymentConfig.BackendDeployed = $true
            return $true
        } else {
            throw "Backend deployment script returned error code: $LASTEXITCODE"
        }
    } catch {
        Write-Log "Backend deployment failed: $_" "ERROR"
        throw $_
    }
}

function Deploy-Frontend {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      DEPLOYING FRONTEND"
    Write-Host "=============================================================================="
    Write-Host ""

    Write-Log "Starting frontend deployment" "INFO"

    $scriptPath = Join-Path $PSScriptRoot "install-frontend.ps1"

    $params = @{}
    if ($SkipBackup) {
        $params['Backup'] = $false
    }

    try {
        & $scriptPath @params

        if ($LASTEXITCODE -eq 0) {
            Write-Log "Frontend deployment completed successfully" "SUCCESS"
            $script:deploymentConfig.FrontendDeployed = $true
            return $true
        } else {
            throw "Frontend deployment script returned error code: $LASTEXITCODE"
        }
    } catch {
        Write-Log "Frontend deployment failed: $_" "ERROR"
        throw $_
    }
}

function Run-PostDeploymentHealthChecks {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                   POST-DEPLOYMENT HEALTH CHECKS"
    Write-Host "=============================================================================="
    Write-Host ""

    Write-Log "Running post-deployment health checks" "INFO"

    $scriptPath = Join-Path $PSScriptRoot "health-check.ps1"

    try {
        & $scriptPath

        if ($LASTEXITCODE -eq 0) {
            Write-Log "Health checks PASSED" "SUCCESS"
            $script:deploymentConfig.HealthCheckPassed = $true
            return $true
        } else {
            Write-Log "Health checks FAILED" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Health checks failed with error: $_" "ERROR"
        return $false
    }
}

function Show-DeploymentSummary {
    $duration = (Get-Date) - $script:deploymentConfig.DeploymentStartTime
    $durationFormatted = "{0:mm}m {0:ss}s" -f $duration

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      DEPLOYMENT SUMMARY"
    Write-Host "=============================================================================="
    Write-Host ""

    Write-Host "Deployment Status:" -ForegroundColor White
    Write-Host ""

    if ($script:deploymentConfig.BackendDeployed) {
        Write-Host "  ✓ Backend deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Backend not deployed" -ForegroundColor $(if ($BackendOnly -or -not $FrontendOnly) { "Red" } else { "Gray" })
    }

    if ($script:deploymentConfig.FrontendDeployed) {
        Write-Host "  ✓ Frontend deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Frontend not deployed" -ForegroundColor $(if ($FrontendOnly -or -not $BackendOnly) { "Red" } else { "Gray" })
    }

    if ($script:deploymentConfig.HealthCheckPassed) {
        Write-Host "  ✓ Health checks passed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Health checks failed or skipped" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Deployment Time:    $durationFormatted" -ForegroundColor Cyan
    Write-Host "Log File:           $($script:deploymentConfig.LogPath)" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Service URLs:" -ForegroundColor White
    Write-Host "  Backend:          http://192.168.0.10:7075/api/health" -ForegroundColor White
    Write-Host "  Frontend:         http://192.168.0.10:6060" -ForegroundColor White
    Write-Host "  Bridge:           ws://192.168.0.10:5000 (pre-existing)" -ForegroundColor White
    Write-Host ""

    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Test from workstations (WS1-WS4)" -ForegroundColor White
    Write-Host "  2. Run 10 validation scenarios" -ForegroundColor White
    Write-Host "  3. Monitor logs for errors" -ForegroundColor White
    Write-Host "  4. Update DNS/firewall rules if needed" -ForegroundColor White
    Write-Host ""

    if (-not $script:deploymentConfig.HealthCheckPassed) {
        Write-Host "IMPORTANT: Health checks failed!" -ForegroundColor Red
        Write-Host "Run: .\rollback.ps1 to rollback if needed" -ForegroundColor Yellow
        Write-Host ""
    }

    Write-Host "=============================================================================="
    Write-Host ""
}

# ==============================================================================
# MAIN DEPLOYMENT SCRIPT
# ==============================================================================

try {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "       Partial Picking System - Complete Deployment Script"
    Write-Host "=============================================================================="
    Write-Host ""

    Write-Log "Deployment started" "INFO"
    Write-Log "Project root: $($script:deploymentConfig.ProjectRoot)" "INFO"

    # Test prerequisites
    Test-Prerequisites

    # Confirm deployment
    if (-not (Confirm-Deployment)) {
        Write-Host "Deployment cancelled by user" -ForegroundColor Yellow
        Write-Log "Deployment cancelled by user" "INFO"
        exit 0
    }

    # Deploy components
    $deployBackend = -not $FrontendOnly
    $deployFrontend = -not $BackendOnly

    if ($deployBackend) {
        Deploy-Backend
    }

    if ($deployFrontend) {
        Deploy-Frontend
    }

    # Run health checks
    if (-not $SkipTests) {
        $healthCheckPassed = Run-PostDeploymentHealthChecks

        if (-not $healthCheckPassed) {
            Write-Host ""
            Write-Host "WARNING: Health checks failed after deployment!" -ForegroundColor Red
            Write-Host "Consider rolling back: .\rollback.ps1" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Log "Health checks skipped (SkipTests flag)" "WARN"
    }

    # Show summary
    Show-DeploymentSummary

    Write-Log "Deployment completed" "SUCCESS"

    # Exit with appropriate code
    if ($script:deploymentConfig.HealthCheckPassed -or $SkipTests) {
        exit 0
    } else {
        exit 1
    }

} catch {
    Write-Log "Deployment failed: $_" "ERROR"

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                        DEPLOYMENT FAILED"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Deployment log: $($script:deploymentConfig.LogPath)" -ForegroundColor Yellow
    Write-Host ""

    if ($script:deploymentConfig.BackendDeployed -or $script:deploymentConfig.FrontendDeployed) {
        Write-Host "Partial deployment detected. Consider rollback:" -ForegroundColor Red
        Write-Host "  .\rollback.ps1" -ForegroundColor Yellow
        Write-Host ""
    }

    Write-Host "=============================================================================="
    Write-Host ""
    exit 1
}
