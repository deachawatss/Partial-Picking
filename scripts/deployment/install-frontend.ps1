# ==============================================================================
# Partial Picking System PWA - Frontend Deployment Script
# ==============================================================================
# Purpose: Deploy React frontend to IIS on Windows Server
# Target: 192.168.0.10:6060
# Requirements: Windows Server 2016+, IIS 10+, URL Rewrite Module
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$SiteName = "PartialPickingFrontend",

    [Parameter(Mandatory=$false)]
    [string]$AppPoolName = "PartialPickingAppPool",

    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\inetpub\partial-picking\frontend",

    [Parameter(Mandatory=$false)]
    [string]$DistPath = ".\frontend\dist",

    [Parameter(Mandatory=$false)]
    [int]$Port = 6060,

    [Parameter(Mandatory=$false)]
    [string]$HostName = "",

    [Parameter(Mandatory=$false)]
    [switch]$Backup = $true,

    [Parameter(Mandatory=$false)]
    [switch]$EnableSSL = $false,

    [Parameter(Mandatory=$false)]
    [string]$CertificateThumbprint = ""
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
    Add-Content -Path "$logDir\deployment.log" -Value $logMessage
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-IISInstalled {
    $iisFeature = Get-WindowsFeature -Name "Web-Server" -ErrorAction SilentlyContinue
    if (-not $iisFeature -or $iisFeature.InstallState -ne "Installed") {
        throw "IIS is not installed. Install IIS first: Install-WindowsFeature -Name Web-Server -IncludeManagementTools"
    }
    Write-Log "IIS is installed" "SUCCESS"
}

function Test-URLRewriteModule {
    $rewriteModule = Get-WebGlobalModule | Where-Object { $_.Name -eq "RewriteModule" }
    if (-not $rewriteModule) {
        Write-Log "URL Rewrite Module not found. Installing is recommended for SPA routing." "WARN"
        Write-Log "Download from: https://www.iis.net/downloads/microsoft/url-rewrite" "INFO"
    } else {
        Write-Log "URL Rewrite Module is installed" "SUCCESS"
    }
}

function Test-DistExists {
    if (-not (Test-Path $DistPath)) {
        throw "Frontend dist folder not found: $DistPath. Build frontend first with: npm run build"
    }
    Write-Log "Frontend dist folder found: $DistPath" "SUCCESS"
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

function New-InstallationDirectory {
    if (-not (Test-Path $InstallPath)) {
        Write-Log "Creating installation directory: $InstallPath" "INFO"
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
    Write-Log "Installation directory ready" "SUCCESS"
}

function Copy-DistFiles {
    Write-Log "Copying frontend dist files to $InstallPath" "INFO"

    # Clear existing files
    if (Test-Path $InstallPath) {
        Get-ChildItem -Path $InstallPath -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    }

    # Copy all files from dist
    Copy-Item -Path "$DistPath\*" -Destination $InstallPath -Recurse -Force

    Write-Log "Frontend files copied successfully" "SUCCESS"
}

function New-IISAppPool {
    Import-Module WebAdministration

    # Remove existing app pool if it exists
    if (Test-Path "IIS:\AppPools\$AppPoolName") {
        Write-Log "Removing existing application pool: $AppPoolName" "INFO"
        Remove-WebAppPool -Name $AppPoolName
        Start-Sleep -Seconds 2
    }

    # Create new app pool
    Write-Log "Creating application pool: $AppPoolName" "INFO"
    New-WebAppPool -Name $AppPoolName

    # Configure app pool
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedPipelineMode" -Value "Integrated"
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "startMode" -Value "AlwaysRunning"
    Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "processModel.idleTimeout" -Value ([TimeSpan]::FromMinutes(0))

    Write-Log "Application pool configured successfully" "SUCCESS"
}

function New-IISSite {
    Import-Module WebAdministration

    # Remove existing site if it exists
    if (Test-Path "IIS:\Sites\$SiteName") {
        Write-Log "Removing existing IIS site: $SiteName" "INFO"
        Remove-WebSite -Name $SiteName
        Start-Sleep -Seconds 2
    }

    # Create new site
    Write-Log "Creating IIS site: $SiteName" "INFO"

    $binding = "*:${Port}:"
    if ($HostName) {
        $binding = "*:${Port}:${HostName}"
    }

    New-WebSite -Name $SiteName `
        -PhysicalPath $InstallPath `
        -ApplicationPool $AppPoolName `
        -Port $Port `
        -HostHeader $HostName `
        -ErrorAction Stop

    Write-Log "IIS site created successfully" "SUCCESS"
}

function Add-URLRewriteRules {
    Import-Module WebAdministration

    # Create web.config with URL rewrite rules for SPA
    $webConfigContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- URL Rewrite for React Router (SPA) -->
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

    <!-- Static content compression -->
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".woff" />
      <mimeMap fileExtension=".woff" mimeType="application/font-woff" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="application/font-woff2" />
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>

    <!-- HTTP Compression -->
    <urlCompression doStaticCompression="true" doDynamicCompression="true" />

    <!-- Caching policy -->
    <caching enabled="true" enableKernelCache="true">
      <profiles>
        <add extension=".js" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
        <add extension=".css" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
        <add extension=".png" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
        <add extension=".jpg" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
        <add extension=".svg" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
      </profiles>
    </caching>

    <!-- Security headers -->
    <httpProtocol>
      <customHeaders>
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-XSS-Protection" value="1; mode=block" />
        <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
      </customHeaders>
    </httpProtocol>

    <!-- Remove unnecessary headers -->
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
"@

    $webConfigPath = Join-Path $InstallPath "web.config"
    Set-Content -Path $webConfigPath -Value $webConfigContent -Force

    Write-Log "URL rewrite rules configured in web.config" "SUCCESS"
}

function Configure-Firewall {
    Write-Log "Configuring Windows Firewall for port $Port" "INFO"

    # Remove existing rule if it exists
    Remove-NetFirewallRule -DisplayName "Partial Picking Frontend" -ErrorAction SilentlyContinue

    # Add new rule
    New-NetFirewallRule -DisplayName "Partial Picking Frontend" `
        -Direction Inbound `
        -LocalPort $Port `
        -Protocol TCP `
        -Action Allow `
        -Profile Domain,Private `
        -ErrorAction Stop | Out-Null

    Write-Log "Firewall rule configured successfully" "SUCCESS"
}

function Start-IISSite {
    Import-Module WebAdministration

    Write-Log "Starting IIS site: $SiteName" "INFO"

    # Start app pool
    Start-WebAppPool -Name $AppPoolName -ErrorAction Stop

    # Start site
    Start-WebSite -Name $SiteName -ErrorAction Stop

    Start-Sleep -Seconds 3

    # Verify site is running
    $site = Get-WebSite -Name $SiteName
    if ($site.State -ne "Started") {
        throw "IIS site failed to start"
    }

    Write-Log "IIS site started successfully" "SUCCESS"
}

function Test-FrontendAvailability {
    param([int]$MaxRetries = 10, [int]$RetryDelaySeconds = 3)

    Write-Log "Testing frontend availability..." "INFO"

    $frontendUrl = "http://localhost:$Port"
    $retries = 0
    $success = $false

    while ($retries -lt $MaxRetries -and -not $success) {
        try {
            $response = Invoke-WebRequest -Uri $frontendUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Log "Frontend availability check PASSED" "SUCCESS"
                $success = $true
            }
        } catch {
            $retries++
            if ($retries -lt $MaxRetries) {
                Write-Log "Frontend check attempt $retries/$MaxRetries failed, retrying in $RetryDelaySeconds seconds..." "WARN"
                Start-Sleep -Seconds $RetryDelaySeconds
            }
        }
    }

    if (-not $success) {
        Write-Log "Frontend availability check FAILED after $MaxRetries attempts" "ERROR"
        throw "Frontend is not accessible. Check IIS logs and site configuration."
    }
}

function Show-DeploymentSummary {
    param([string]$BackupPath)

    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                  FRONTEND DEPLOYMENT SUMMARY"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "✓ Site Name:           $SiteName" -ForegroundColor Green
    Write-Host "✓ Application Pool:    $AppPoolName" -ForegroundColor Green
    Write-Host "✓ Installation Path:   $InstallPath" -ForegroundColor Green
    Write-Host "✓ Site Status:         Started" -ForegroundColor Green
    Write-Host "✓ Availability Check:  PASSED" -ForegroundColor Green
    Write-Host "✓ Frontend URL:        http://192.168.0.10:$Port" -ForegroundColor Green
    Write-Host ""

    if ($BackupPath) {
        Write-Host "Backup Location:     $BackupPath" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "IIS Management:" -ForegroundColor Cyan
    Write-Host "  Start Site:        Start-WebSite -Name '$SiteName'" -ForegroundColor White
    Write-Host "  Stop Site:         Stop-WebSite -Name '$SiteName'" -ForegroundColor White
    Write-Host "  Restart Site:      Restart-WebAppPool -Name '$AppPoolName'" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor White
    Write-Host "  1. Access frontend: http://192.168.0.10:$Port" -ForegroundColor White
    Write-Host "  2. Run health checks: .\health-check.ps1" -ForegroundColor White
    Write-Host "  3. Test workstation access from WS1-WS4" -ForegroundColor White
    Write-Host "  4. Run 10 validation scenarios" -ForegroundColor White
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
    Write-Host "         Partial Picking System - Frontend Deployment Script"
    Write-Host "=============================================================================="
    Write-Host ""

    # Pre-flight checks
    Write-Log "Starting frontend deployment" "INFO"

    if (-not (Test-Administrator)) {
        throw "This script requires Administrator privileges. Run PowerShell as Administrator."
    }
    Write-Log "Administrator privileges confirmed" "SUCCESS"

    Test-IISInstalled
    Test-URLRewriteModule
    Test-DistExists

    # Backup existing installation
    $backupPath = $null
    if ($Backup) {
        $backupPath = Backup-ExistingInstallation
    }

    # Create installation directory
    New-InstallationDirectory

    # Copy dist files
    Copy-DistFiles

    # Create IIS app pool
    New-IISAppPool

    # Create IIS site
    New-IISSite

    # Add URL rewrite rules
    Add-URLRewriteRules

    # Configure firewall
    Configure-Firewall

    # Start IIS site
    Start-IISSite

    # Test frontend availability
    Test-FrontendAvailability

    # Show deployment summary
    Show-DeploymentSummary -BackupPath $backupPath

    Write-Log "Frontend deployment completed successfully" "SUCCESS"

} catch {
    Write-Log "Deployment failed: $_" "ERROR"
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                        DEPLOYMENT FAILED"
    Write-Host "=============================================================================="
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check IIS logs and deployment logs for details" -ForegroundColor Yellow
    Write-Host ""

    if ($backupPath) {
        Write-Host "To rollback, run: .\rollback.ps1 -BackupPath '$backupPath'" -ForegroundColor Yellow
    }

    Write-Host "=============================================================================="
    Write-Host ""
    exit 1
}
