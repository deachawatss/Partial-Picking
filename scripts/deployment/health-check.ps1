# ==============================================================================
# Partial Picking System PWA - Health Check Script
# ==============================================================================
# Purpose: Verify all services are running and responding correctly
# Services: Backend (7075), Frontend (6060), Bridge (5000), Database
# ==============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$BackendUrl = "http://192.168.0.10:7075",

    [Parameter(Mandatory=$false)]
    [string]$FrontendUrl = "http://192.168.0.10:6060",

    [Parameter(Mandatory=$false)]
    [string]$BridgeUrl = "ws://192.168.0.10:5000",

    [Parameter(Mandatory=$false)]
    [string]$DatabaseServer = "192.168.0.86",

    [Parameter(Mandatory=$false)]
    [int]$DatabasePort = 49381,

    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false,

    [Parameter(Mandatory=$false)]
    [switch]$ContinuousMonitoring = $false,

    [Parameter(Mandatory=$false)]
    [int]$MonitoringIntervalSeconds = 60
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ==============================================================================
# HEALTH CHECK RESULTS
# ==============================================================================

$script:healthResults = @{
    Backend = @{ Status = "UNKNOWN"; ResponseTime = 0; Details = "" }
    Frontend = @{ Status = "UNKNOWN"; ResponseTime = 0; Details = "" }
    Bridge = @{ Status = "UNKNOWN"; ResponseTime = 0; Details = "" }
    Database = @{ Status = "UNKNOWN"; ResponseTime = 0; Details = "" }
}

$script:allHealthy = $true

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

function Write-HealthLog {
    param(
        [string]$Service,
        [string]$Status,
        [string]$Message,
        [int]$ResponseTime = 0
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Status) {
        "HEALTHY" { "Green" }
        "DEGRADED" { "Yellow" }
        "UNHEALTHY" { "Red" }
        default { "White" }
    }

    $statusIcon = switch ($Status) {
        "HEALTHY" { "✓" }
        "DEGRADED" { "⚠" }
        "UNHEALTHY" { "✗" }
        default { "?" }
    }

    $rtInfo = if ($ResponseTime -gt 0) { " ($($ResponseTime)ms)" } else { "" }

    Write-Host "$statusIcon $Service - $Status$rtInfo : $Message" -ForegroundColor $color

    if ($Verbose) {
        Write-Host "    [$timestamp]" -ForegroundColor Gray
    }
}

function Test-BackendHealth {
    Write-Host ""
    Write-Host "Checking Backend Service..." -ForegroundColor Cyan

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
        $stopwatch.Stop()

        $responseTime = $stopwatch.ElapsedMilliseconds

        if ($response.StatusCode -eq 200) {
            $healthData = $response.Content | ConvertFrom-Json

            if ($healthData.status -eq "healthy" -and $healthData.database -eq "connected") {
                $script:healthResults.Backend.Status = "HEALTHY"
                $script:healthResults.Backend.ResponseTime = $responseTime
                $script:healthResults.Backend.Details = "Version: $($healthData.version)"

                Write-HealthLog -Service "Backend API" -Status "HEALTHY" -Message "Service responding, database connected" -ResponseTime $responseTime

                if ($responseTime -gt 1000) {
                    Write-HealthLog -Service "Backend API" -Status "DEGRADED" -Message "Response time above 1000ms threshold"
                }
            } else {
                $script:healthResults.Backend.Status = "DEGRADED"
                $script:healthResults.Backend.Details = "Status: $($healthData.status), DB: $($healthData.database)"
                $script:allHealthy = $false

                Write-HealthLog -Service "Backend API" -Status "DEGRADED" -Message "Service responding but degraded - $($script:healthResults.Backend.Details)"
            }
        } else {
            throw "Unexpected status code: $($response.StatusCode)"
        }
    } catch {
        $script:healthResults.Backend.Status = "UNHEALTHY"
        $script:healthResults.Backend.Details = $_.Exception.Message
        $script:allHealthy = $false

        Write-HealthLog -Service "Backend API" -Status "UNHEALTHY" -Message $_.Exception.Message
    }
}

function Test-FrontendAvailability {
    Write-Host ""
    Write-Host "Checking Frontend Service..." -ForegroundColor Cyan

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $FrontendUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
        $stopwatch.Stop()

        $responseTime = $stopwatch.ElapsedMilliseconds

        if ($response.StatusCode -eq 200) {
            $script:healthResults.Frontend.Status = "HEALTHY"
            $script:healthResults.Frontend.ResponseTime = $responseTime
            $script:healthResults.Frontend.Details = "Content-Length: $($response.RawContentLength) bytes"

            Write-HealthLog -Service "Frontend PWA" -Status "HEALTHY" -Message "Service responding, content loaded" -ResponseTime $responseTime

            # Check for index.html
            if ($response.Content -match "<title>") {
                Write-HealthLog -Service "Frontend PWA" -Status "HEALTHY" -Message "HTML content validated"
            } else {
                Write-HealthLog -Service "Frontend PWA" -Status "DEGRADED" -Message "HTML content may be incomplete"
                $script:healthResults.Frontend.Status = "DEGRADED"
            }
        } else {
            throw "Unexpected status code: $($response.StatusCode)"
        }
    } catch {
        $script:healthResults.Frontend.Status = "UNHEALTHY"
        $script:healthResults.Frontend.Details = $_.Exception.Message
        $script:allHealthy = $false

        Write-HealthLog -Service "Frontend PWA" -Status "UNHEALTHY" -Message $_.Exception.Message
    }
}

function Test-BridgeService {
    Write-Host ""
    Write-Host "Checking Bridge Service..." -ForegroundColor Cyan

    try {
        # Check if bridge service process is running
        $bridgePort = 5000
        $tcpConnection = Test-NetConnection -ComputerName "localhost" -Port $bridgePort -InformationLevel Quiet -WarningAction SilentlyContinue

        if ($tcpConnection) {
            $script:healthResults.Bridge.Status = "HEALTHY"
            $script:healthResults.Bridge.Details = "Port $bridgePort is open and accepting connections"

            Write-HealthLog -Service "Bridge Service" -Status "HEALTHY" -Message "WebSocket endpoint available on port $bridgePort"
        } else {
            throw "Port $bridgePort is not open"
        }

        # Additional check: Try to resolve the endpoint
        try {
            $httpUrl = "http://localhost:$bridgePort"
            $testResponse = Invoke-WebRequest -Uri $httpUrl -Method Get -TimeoutSec 3 -ErrorAction Stop
            Write-HealthLog -Service "Bridge Service" -Status "HEALTHY" -Message "HTTP endpoint responding"
        } catch {
            # WebSocket-only service may not respond to HTTP
            Write-HealthLog -Service "Bridge Service" -Status "HEALTHY" -Message "Port open (WebSocket-only service)"
        }

    } catch {
        $script:healthResults.Bridge.Status = "UNHEALTHY"
        $script:healthResults.Bridge.Details = $_.Exception.Message
        $script:allHealthy = $false

        Write-HealthLog -Service "Bridge Service" -Status "UNHEALTHY" -Message $_.Exception.Message
        Write-Host "    Note: Bridge service should already be running (pre-existing service)" -ForegroundColor Yellow
    }
}

function Test-DatabaseConnection {
    Write-Host ""
    Write-Host "Checking Database Connection..." -ForegroundColor Cyan

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($DatabaseServer, $DatabasePort)
        $stopwatch.Stop()

        $responseTime = $stopwatch.ElapsedMilliseconds

        if ($tcpClient.Connected) {
            $script:healthResults.Database.Status = "HEALTHY"
            $script:healthResults.Database.ResponseTime = $responseTime
            $script:healthResults.Database.Details = "$DatabaseServer:$DatabasePort - TCP connection successful"

            Write-HealthLog -Service "SQL Server" -Status "HEALTHY" -Message "Database server reachable" -ResponseTime $responseTime

            $tcpClient.Close()
        } else {
            throw "Failed to connect to $DatabaseServer:$DatabasePort"
        }
    } catch {
        $script:healthResults.Database.Status = "UNHEALTHY"
        $script:healthResults.Database.Details = $_.Exception.Message
        $script:allHealthy = $false

        Write-HealthLog -Service "SQL Server" -Status "UNHEALTHY" -Message $_.Exception.Message
    }
}

function Test-WindowsServices {
    Write-Host ""
    Write-Host "Checking Windows Services..." -ForegroundColor Cyan

    # Check backend Windows service
    $backendService = Get-Service -Name "PartialPickingBackend" -ErrorAction SilentlyContinue
    if ($backendService) {
        if ($backendService.Status -eq "Running") {
            Write-HealthLog -Service "Windows Service" -Status "HEALTHY" -Message "PartialPickingBackend service is running"
        } else {
            Write-HealthLog -Service "Windows Service" -Status "UNHEALTHY" -Message "PartialPickingBackend service is $($backendService.Status)"
            $script:allHealthy = $false
        }
    } else {
        Write-HealthLog -Service "Windows Service" -Status "UNHEALTHY" -Message "PartialPickingBackend service not found"
        $script:allHealthy = $false
    }

    # Check IIS
    $iisService = Get-Service -Name "W3SVC" -ErrorAction SilentlyContinue
    if ($iisService) {
        if ($iisService.Status -eq "Running") {
            Write-HealthLog -Service "IIS" -Status "HEALTHY" -Message "IIS (W3SVC) is running"
        } else {
            Write-HealthLog -Service "IIS" -Status "UNHEALTHY" -Message "IIS (W3SVC) is $($iisService.Status)"
            $script:allHealthy = $false
        }
    }
}

function Test-IISSite {
    Write-Host ""
    Write-Host "Checking IIS Site..." -ForegroundColor Cyan

    try {
        Import-Module WebAdministration -ErrorAction Stop

        $site = Get-WebSite -Name "PartialPickingFrontend" -ErrorAction SilentlyContinue
        if ($site) {
            if ($site.State -eq "Started") {
                Write-HealthLog -Service "IIS Site" -Status "HEALTHY" -Message "PartialPickingFrontend site is started"
            } else {
                Write-HealthLog -Service "IIS Site" -Status "UNHEALTHY" -Message "PartialPickingFrontend site is $($site.State)"
                $script:allHealthy = $false
            }
        } else {
            Write-HealthLog -Service "IIS Site" -Status "UNHEALTHY" -Message "PartialPickingFrontend site not found"
            $script:allHealthy = $false
        }

        # Check app pool
        $appPool = Get-WebAppPool -Name "PartialPickingAppPool" -ErrorAction SilentlyContinue
        if ($appPool) {
            if ($appPool.State -eq "Started") {
                Write-HealthLog -Service "App Pool" -Status "HEALTHY" -Message "PartialPickingAppPool is started"
            } else {
                Write-HealthLog -Service "App Pool" -Status "UNHEALTHY" -Message "PartialPickingAppPool is $($appPool.State)"
                $script:allHealthy = $false
            }
        }
    } catch {
        Write-HealthLog -Service "IIS Site" -Status "UNKNOWN" -Message "Unable to check IIS site: $_"
    }
}

function Show-HealthSummary {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "                      HEALTH CHECK SUMMARY"
    Write-Host "=============================================================================="
    Write-Host ""

    $overallStatus = if ($script:allHealthy) { "HEALTHY" } else { "DEGRADED/UNHEALTHY" }
    $statusColor = if ($script:allHealthy) { "Green" } else { "Red" }

    Write-Host "Overall Status: " -NoNewline
    Write-Host $overallStatus -ForegroundColor $statusColor
    Write-Host ""

    Write-Host "Service Health:" -ForegroundColor White
    Write-Host "  Backend API:        $($script:healthResults.Backend.Status)" -ForegroundColor $(if ($script:healthResults.Backend.Status -eq "HEALTHY") { "Green" } else { "Red" })
    Write-Host "  Frontend PWA:       $($script:healthResults.Frontend.Status)" -ForegroundColor $(if ($script:healthResults.Frontend.Status -eq "HEALTHY") { "Green" } else { "Red" })
    Write-Host "  Bridge Service:     $($script:healthResults.Bridge.Status)" -ForegroundColor $(if ($script:healthResults.Bridge.Status -eq "HEALTHY") { "Green" } else { "Red" })
    Write-Host "  SQL Server:         $($script:healthResults.Database.Status)" -ForegroundColor $(if ($script:healthResults.Database.Status -eq "HEALTHY") { "Green" } else { "Red" })
    Write-Host ""

    Write-Host "Performance Metrics:" -ForegroundColor White
    if ($script:healthResults.Backend.ResponseTime -gt 0) {
        Write-Host "  Backend Response:   $($script:healthResults.Backend.ResponseTime) ms" -ForegroundColor Cyan
    }
    if ($script:healthResults.Frontend.ResponseTime -gt 0) {
        Write-Host "  Frontend Response:  $($script:healthResults.Frontend.ResponseTime) ms" -ForegroundColor Cyan
    }
    if ($script:healthResults.Database.ResponseTime -gt 0) {
        Write-Host "  Database Response:  $($script:healthResults.Database.ResponseTime) ms" -ForegroundColor Cyan
    }
    Write-Host ""

    if (-not $script:allHealthy) {
        Write-Host "Issues Detected:" -ForegroundColor Yellow
        foreach ($service in $script:healthResults.Keys) {
            if ($script:healthResults[$service].Status -ne "HEALTHY") {
                Write-Host "  $service : $($script:healthResults[$service].Details)" -ForegroundColor Yellow
            }
        }
        Write-Host ""
    }

    Write-Host "Service URLs:" -ForegroundColor Cyan
    Write-Host "  Backend:   $BackendUrl/api/health" -ForegroundColor White
    Write-Host "  Frontend:  $FrontendUrl" -ForegroundColor White
    Write-Host "  Bridge:    $BridgeUrl" -ForegroundColor White
    Write-Host ""

    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "=============================================================================="
    Write-Host ""

    return $script:allHealthy
}

# ==============================================================================
# MAIN HEALTH CHECK SCRIPT
# ==============================================================================

function Run-HealthCheck {
    Write-Host ""
    Write-Host "=============================================================================="
    Write-Host "           Partial Picking System - Health Check"
    Write-Host "=============================================================================="

    # Reset health status
    $script:allHealthy = $true

    # Run all health checks
    Test-BackendHealth
    Test-FrontendAvailability
    Test-BridgeService
    Test-DatabaseConnection
    Test-WindowsServices
    Test-IISSite

    # Show summary
    $isHealthy = Show-HealthSummary

    return $isHealthy
}

# ==============================================================================
# EXECUTION
# ==============================================================================

try {
    if ($ContinuousMonitoring) {
        Write-Host "Starting continuous monitoring (Interval: $MonitoringIntervalSeconds seconds)"
        Write-Host "Press Ctrl+C to stop"
        Write-Host ""

        while ($true) {
            Run-HealthCheck
            Start-Sleep -Seconds $MonitoringIntervalSeconds
        }
    } else {
        $isHealthy = Run-HealthCheck

        if ($isHealthy) {
            exit 0
        } else {
            exit 1
        }
    }
} catch {
    Write-Host ""
    Write-Host "Health check failed: $_" -ForegroundColor Red
    exit 1
}
