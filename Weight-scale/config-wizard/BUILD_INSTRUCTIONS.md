# Build Instructions for Windows

## Prerequisites

1. **Windows 10/11** (WPF requires Windows)
2. **.NET 8 SDK** - Download from https://dotnet.microsoft.com/download/dotnet/8.0
3. **Visual Studio 2022** (optional, recommended for debugging)

## Build from Command Line (Windows PowerShell)

```powershell
# Navigate to project directory
cd \\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard

# Restore NuGet packages
dotnet restore

# Build Release configuration
dotnet build --configuration Release

# Output location
# bin\Release\net8.0-windows\PKBridgeConfigWizard.exe
```

## Build from Visual Studio 2022

1. Open Visual Studio 2022
2. File → Open → Project/Solution
3. Navigate to: `\\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard\PKBridgeConfigWizard.csproj`
4. Build → Build Solution (Ctrl+Shift+B)
5. Build → Configuration Manager → Set to "Release"
6. Build → Rebuild Solution

## Run the Application

**Method 1: From Explorer**
```
Double-click: bin\Release\net8.0-windows\PKBridgeConfigWizard.exe
```

**Method 2: From PowerShell**
```powershell
cd \\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard
dotnet run --configuration Release
```

**Method 3: From Visual Studio**
```
Press F5 (Debug) or Ctrl+F5 (Run without debugging)
```

## Important Notes

⚠️ **Administrator Privileges Required**
- Right-click PKBridgeConfigWizard.exe → "Run as administrator"
- Required for Windows Service installation

⚠️ **Database Prerequisites**
- SQL Server must be running at 192.168.0.86:49381
- Database TFCPILOT3 must exist
- Tables TFC_Weighup_Controllers2 and TFC_Weighup_WorkStations2 must be created
- User NSW must have appropriate permissions

⚠️ **USB Scale Prerequisites**
- Connect USB scales to COM2 (SMALL) and COM3 (BIG) before starting wizard
- Scale drivers must be installed

## Output Files

After successful build, you'll find:

```
bin\Release\net8.0-windows\
├── PKBridgeConfigWizard.exe           ← Main executable
├── PKBridgeConfigWizard.dll
├── PKBridgeConfigWizard.pdb
├── Microsoft.Data.SqlClient.dll       (NuGet dependency)
├── Newtonsoft.Json.dll                (NuGet dependency)
└── ... (other dependencies)
```

## Testing the Wizard

1. **Welcome Page**: Should auto-detect workstation name and IP
2. **Database Page**:
   - Enter: Server=192.168.0.86, Port=49381, Database=TFCPILOT3, User=NSW
   - Click "Test Connection" - should succeed
3. **Server URLs**: Default values should work (192.168.0.10:6060, :7075, bridge:5000)
4. **Scale Detection**:
   - Click "Detect Available COM Ports"
   - Should find COM2 and COM3 if scales connected
   - Auto-assigns COM2→SMALL, COM3→BIG
5. **Navigation**: Use "Next →" and "← Back" buttons to navigate

## Troubleshooting

**Build Error: "WindowsDesktop SDK not found"**
- Install .NET 8 SDK for Windows from Microsoft
- Ensure `dotnet --version` shows 8.0.x

**Build Error: "NuGet package restore failed"**
```powershell
dotnet restore --force
dotnet clean
dotnet build
```

**Runtime Error: "Administrator privileges required"**
- Right-click .exe → Run as administrator

**Database Connection Failed**
- Verify SQL Server is running
- Check firewall allows port 49381
- Verify database exists: `SELECT name FROM sys.databases WHERE name='TFCPILOT3'`
- Verify tables exist: Run queries from database/migrations/README.md

**COM Ports Not Detected**
- Check Device Manager → Ports (COM & LPT)
- Verify USB scales are connected
- Install scale drivers if needed
- Run wizard as administrator

## Next Steps After Build

1. Run the wizard and complete configuration
2. Verify `C:\ProgramData\PKBridgeService\appsettings.json` is generated
3. Inspect the JSON to verify password encryption works
4. Test that configuration can be read by bridge service

## Development Tips

**Hot Reload in Visual Studio**
- Edit XAML files while debugging
- Changes apply immediately without restart

**Debug Database Connection**
- Set breakpoint in DatabaseConfigPage.xaml.cs → TestDatabaseConnection()
- Inspect connection string and exception details

**Test COM Port Detection**
- Debug ScaleDetectionPage.xaml.cs → DetectComPorts()
- Check SerialPort.GetPortNames() output
