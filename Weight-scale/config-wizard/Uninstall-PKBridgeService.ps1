# PK Bridge Service Uninstaller
# Run as Administrator

param(
    [switch]$RemoveDatabaseEntries = $false
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "PK Bridge Service Uninstaller" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script requires administrator privileges!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Step 1: Stop running processes
Write-Host "[1/5] Stopping PKBridgeService processes..." -ForegroundColor Yellow
$processes = Get-Process -Name "PKBridgeService" -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Stop-Process -Force
    Write-Host "  ✓ Stopped $($processes.Count) process(es)" -ForegroundColor Green
} else {
    Write-Host "  ℹ No running processes found" -ForegroundColor Gray
}

# Step 2: Remove Windows Service
Write-Host "[2/5] Removing Windows Service..." -ForegroundColor Yellow
$service = Get-Service -Name "PKBridgeService" -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq 'Running') {
        Stop-Service -Name "PKBridgeService" -Force
    }
    sc.exe delete PKBridgeService | Out-Null
    Write-Host "  ✓ Windows Service removed" -ForegroundColor Green
} else {
    Write-Host "  ℹ No Windows Service found" -ForegroundColor Gray
}

# Step 3: Delete configuration files
Write-Host "[3/5] Removing configuration files..." -ForegroundColor Yellow
$configPath = "C:\ProgramData\PKBridgeService"
if (Test-Path $configPath) {
    Remove-Item $configPath -Recurse -Force
    Write-Host "  ✓ Removed: $configPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ Configuration directory not found" -ForegroundColor Gray
}

# Step 4: Delete program files
Write-Host "[4/5] Removing program files..." -ForegroundColor Yellow
$installPath = "C:\Program Files\PKBridgeService"
if (Test-Path $installPath) {
    Remove-Item $installPath -Recurse -Force
    Write-Host "  ✓ Removed: $installPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ Installation directory not found" -ForegroundColor Gray
}

# Step 5: Database entries (preserved for reinstallation)
Write-Host "[5/5] Database entries..." -ForegroundColor Yellow
Write-Host "  ℹ Database entries preserved for reinstallation (automatic update on next install)" -ForegroundColor Gray
Write-Host "  ℹ If reinstalling, the wizard will UPDATE existing records instead of creating duplicates" -ForegroundColor Gray
if ($RemoveDatabaseEntries) {
    Write-Host ""
    Write-Host "  ⚠ Manual database cleanup (if needed):" -ForegroundColor Yellow
    Write-Host "  DELETE FROM TFC_Weighup_WorkStations2 WHERE WorkstationName = '$env:COMPUTERNAME';" -ForegroundColor Cyan
    Write-Host "  DELETE FROM TFC_Weighup_Controllers2 WHERE WorkstationName = '$env:COMPUTERNAME';" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✓ Uninstall Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Reboot your workstation (optional)" -ForegroundColor White
Write-Host "2. Remove database entries manually if needed" -ForegroundColor White
Write-Host "3. Delete the config wizard executable if no longer needed" -ForegroundColor White
Write-Host ""
