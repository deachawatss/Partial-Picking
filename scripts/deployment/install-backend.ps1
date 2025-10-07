# ==============================================================================
# Partial Picking System PWA - Backend Deployment Script
# ==============================================================================
# Purpose: Deploy Rust backend to Windows Server as Windows Service
# Target: 192.168.0.10:7075
# Requirements: Windows Server 2016+, .NET Framework 4.7.2+
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "PartialPickingBackend",

    [Parameter(Mandatory=$false)]
    [string]$ServiceDisplayName = "Partial Picking Backend Service",

    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\inetpub\partial-picking\backend",

    [Parameter(Mandatory=$false)]
    [string]$BinaryPath = ".\backend\target\release\partial-picking-backend.exe",

    [Parameter(Mandatory=$false)]
    [string]$EnvFile = ".\.env.production",

    [Parameter(Mandatory=$false)]
    [switch]$Backup = $true,

    [Parameter(Mandatory=$false)]
    [switch]$SkipServiceStop = $false
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
    Add-Content -Path "$InstallPath\logs\deployment.log" -Value $logMessage
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Stop-ServiceSafely {
    param([string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Log "Stopping service: $Name" "INFO"
            Stop-Service -Name $Name -Force -ErrorAction Stop

            # Wait for service to stop (max 30 seconds)
            $timeout = 30
            $elapsed = 0
            while ((Get-Service -Name $Name).Status -ne "Stopped" -and $elapsed -lt $timeout) {
                Start-Sleep -Seconds 1
                $elapsed++
            }

            if ((Get-Service -Name $Name).Status -ne "Stopped") {
                throw "Failed to stop service $Name within $timeout seconds"
            }

            Write-Log "Service stopped successfully" "SUCCESS"
        } else {
            Write-Log "Service is already stopped" "INFO"
        }
    } else {
        Write-Log "Service does not exist (first install)" "INFO"
    }
}

function Backup-ExistingInstallation {
    if (Test-Path $InstallPath) {
        $backupPath = "$InstallPath-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Log "Creating backup: $backupPath" "INFO"
        Copy-Item -Path $InstallPath -Destination $backupPath -Recurse -Force
        Write-Log "Backup created successfully" "SUCCESS"
        return $backupPath
    } else {
        Write-Log "No existing installation to backup" "INFO"
        return $null
    }
}

function Test-BinaryExists {
    if (-not (Test-Path $BinaryPath)) {
        throw "Backend binary not found: $BinaryPath. Build the backend first with: cargo build --release"
    }
    Write-Log "Backend binary found: $BinaryPath" "SUCCESS"
}

function Test-EnvFileExists {
    if (-not (Test-Path $EnvFile)) {
        throw "Production environment file not found: $EnvFile"
    }
    Write-Log "Environment file found: $EnvFile" "SUCCESS"
}

function New-InstallationDirectory {
    if (-not (Test-Path $InstallPath)) {
        Write-Log "Creating installation directory: $InstallPath" "INFO"
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }

    # Create subdirectories
    $subdirs = @("logs", "config", "temp")
    foreach ($dir in $subdirs) {
        $path = Join-Path $InstallPath $dir
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }

    Write-Log "Installation directory structure created" "SUCCESS"
}

function Copy-BinaryFiles {
    Write-Log "Copying backend binary to $InstallPath" "INFO"
    Copy-Item -Path $BinaryPath -Destination "$InstallPath\partial-picking-backend.exe" -Force

    Write-Log "Copying environment file" "INFO"
    Copy-Item -Path $EnvFile -Destination "$InstallPath\.env" -Force

    Write-Log "Files copied successfully" "SUCCESS"
}

function Install-WindowsService {
    # Remove existing service if it exists
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Log "Removing existing service: $ServiceName" "INFO"
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    # Create new service
    Write-Log "Installing Windows Service: $ServiceName" "INFO"

    $binaryFullPath = Join-Path $InstallPath "partial-picking-backend.exe"

    # Create service using sc.exe
    $result = sc.exe create $ServiceName `
        binPath= "`"$binaryFullPath`"" `
        DisplayName= "`"$ServiceDisplayName`"" `
        start= auto `
        obj= "LocalSystem"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Windows Service. Error: $result"
    }

    # Set service description
    sc.exe description $ServiceName "Partial Picking System Backend - Rust/Axum API Server" | Out-Null

    # Configure service recovery options (restart on failure)
    sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

    Write-Log "Windows Service installed successfully" "SUCCESS"
}

function Start-BackendService {
    Write-Log "Starting Windows Service: $ServiceName" "INFO"

    Start-Service -Name $ServiceName -ErrorAction Stop

    # Wait for service to start (max 30 seconds)
    $timeout = 30
    $elapsed = 0
    while ((Get-Service -Name $ServiceName).Status -ne "Running" -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
    }

    if ((Get-Service -Name $ServiceName).Status -ne "Running") {
        throw "Service failed to start within $timeout seconds"
    }

    Write-Log "Service started successfully" "SUCCESS"
}

function Test-HealthCheck {
    param([int]$MaxRetries = 10, [int]$RetryDelaySeconds = 5)

    Write-Log "Running health check..." "INFO"

    $healthUrl = "http://localhost:7075/api/health"
    $retries = 0
    $success = $false

    while ($retries -lt $MaxRetries -and -not $success) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $content = $response.Content | ConvertFrom-Json
                Write-Log "Health check PASSED - Status: $($content.status), Database: $($content.database)" "SUCCESS"
                $success = $true
            }
        } catch {
            $retries++
            if ($retries -lt $MaxRetries) {
                Write-Log "Health check attempt $retries/$MaxRetries failed, retrying in $RetryDelaySeconds seconds..." "WARN"
                Start-Sleep -Seconds $RetryDelaySeconds
            }
        }
    }

    if (-not $success) {
        Write-Log "Health check FAILED after $MaxRetries attempts" "ERROR"
        throw "Backend health check failed. Check logs at: $InstallPath\logs\backend.log"
    }
}

function Configure-Firewall {
    Write-Log "Configuring Windows Firewall for port 7075" "INFO"

    # Remove existing rule if it exists
    Remove-NetFirewallRule -DisplayName "Partial Picking Backend" -ErrorAction SilentlyContinue

    # Add new rule
    New-NetFirewallRule -DisplayName "Partial Picking Backend" `
        -Direction Inbound `
        -LocalPort 7075 `
        -Protocol TCP `
        -Action Allow `
        -Profile Domain,Private `
        -ErrorAction Stop | Out-Null

    Write-Log "Firewall rule configured successfully" "SUCCESS"
}

function Show-DeploymentSummary {
    param([string]$BackupPath)

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                   BACKEND DEPLOYMENT SUMMARY"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "✓ Service Name:        $ServiceName" -ForegroundColor Green
    Write-Host "✓ Installation Path:   $InstallPath" -ForegroundColor Green
    Write-Host "✓ Service Status:      Running" -ForegroundColor Green
    Write-Host "✓ Health Check:        PASSED" -ForegroundColor Green
    Write-Host "✓ Backend URL:         http://192.168.0.10:7075" -ForegroundColor Green
    Write-Host ""

    if ($BackupPath) {
        Write-Host "Backup Location:     $BackupPath" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Logs Location:       $InstallPath\logs\" -ForegroundColor Cyan
    Write-Host "Config Location:     $InstallPath\.env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor White
    Write-Host "  1. Deploy frontend using: .\install-frontend.ps1" -ForegroundColor White
    Write-Host "  2. Run health checks: .\health-check.ps1" -ForegroundColor White
    Write-Host "  3. Monitor logs: Get-Content $InstallPath\logs\backend.log -Wait" -ForegroundColor White
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host ""
}

# ==============================================================================
# MAIN DEPLOYMENT SCRIPT
# ==============================================================================

try {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "          Partial Picking System - Backend Deployment Script"
    Write-Host "=============================================================================="
    Write-Host ""

    # Pre-flight checks
    Write-Log "Starting backend deployment" "INFO"

    if (-not (Test-Administrator)) {
        throw "This script requires Administrator privileges. Run PowerShell as Administrator."
    }
    Write-Log "Administrator privileges confirmed" "SUCCESS"

    Test-BinaryExists
    Test-EnvFileExists

    # Stop existing service
    if (-not $SkipServiceStop) {
        Stop-ServiceSafely -Name $ServiceName
    }

    # Backup existing installation
    $backupPath = $null
    if ($Backup) {
        $backupPath = Backup-ExistingInstallation
    }

    # Create installation directory structure
    New-InstallationDirectory

    # Copy binary and configuration files
    Copy-BinaryFiles

    # Install Windows Service
    Install-WindowsService

    # Configure firewall
    Configure-Firewall

    # Start service
    Start-BackendService

    # Run health check
    Test-HealthCheck

    # Show deployment summary
    Show-DeploymentSummary -BackupPath $backupPath

    Write-Log "Backend deployment completed successfully" "SUCCESS"

} catch {
    Write-Log "Deployment failed: $_" "ERROR"
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                        DEPLOYMENT FAILED"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check deployment logs: $InstallPath\logs\deployment.log" -ForegroundColor Yellow
    Write-Host ""

    if ($backupPath) {
        Write-Host "To rollback, run: .\rollback.ps1 -BackupPath '$backupPath'" -ForegroundColor Yellow
    }

    Write-Host "=============================================================================="
    Write-Host ""
    exit 1
}
