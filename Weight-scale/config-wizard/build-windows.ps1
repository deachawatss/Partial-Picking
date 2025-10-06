# Build script for PKBridgeConfigWizard on Windows
# Run this from Windows PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PK Bridge Config Wizard - Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Navigate to config wizard directory
Set-Location $ScriptDir

Write-Host "Building Config Wizard..." -ForegroundColor Yellow
dotnet build --configuration Release

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output location:" -ForegroundColor Cyan
    Write-Host "  $ScriptDir\bin\Release\net8.0-windows\PKBridgeConfigWizard.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "To run the wizard:" -ForegroundColor Cyan
    Write-Host "  .\bin\Release\net8.0-windows\PKBridgeConfigWizard.exe" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Build failed. See errors above." -ForegroundColor Red
    exit 1
}
