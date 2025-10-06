# Quick Start Guide - PKBridgeConfigWizard

## 🚀 Build & Run (Windows Only)

### Option 1: Visual Studio 2022 (Recommended)
```
1. Open Windows Explorer
2. Navigate to: \\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard
3. Double-click: PKBridgeConfigWizard.sln (if exists) or PKBridgeConfigWizard.csproj
4. Press F5 to build and run
```

### Option 2: Windows PowerShell
```powershell
# From Windows PowerShell
cd \\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard

# Build
dotnet build --configuration Release

# Run
.\bin\Release\net8.0-windows\PKBridgeConfigWizard.exe
```

## ✅ Project Status

**✅ COMPLETED** (24 files, ready to build):
- Database migration script executed successfully
- Tables created: TFC_Weighup_Controllers2, TFC_Weighup_WorkStations2
- WPF wizard core framework complete
- Pages 1-4 fully functional
- AES-256 password encryption implemented
- Configuration file generator ready

**⏳ PENDING** (placeholder pages):
- Page 5: Scale Testing (weight reading verification)
- Page 6: Advanced Settings (polling intervals, logging)
- Page 7: Review (configuration summary display)
- Page 8: Install (Windows Service installation)

## 📋 What Works Now

### Page 1: Welcome
- ✅ Auto-detects workstation name (Environment.MachineName)
- ✅ Auto-detects IP address (Dns.GetHostEntry)

### Page 2: Database Configuration
- ✅ SQL Server connection testing
- ✅ Validates TFC_Weighup_Controllers2 and TFC_Weighup_WorkStations2 tables exist
- ✅ Connection string validation
- ✅ Real-time connection status feedback

### Page 3: Server URLs
- ✅ Frontend URL configuration (default: http://192.168.0.10:6060)
- ✅ Backend URL configuration (default: http://192.168.0.10:7075)
- ✅ Bridge port configuration (default: 5000)
- ✅ Input validation

### Page 4: COM Port Detection
- ✅ Auto-detects available COM ports using System.IO.Ports
- ✅ Dual-scale configuration (SMALL + BIG)
- ✅ Auto-assigns COM2→SMALL, COM3→BIG
- ✅ Baud rate selection (4800-19200)
- ✅ Scale model input (optional)
- ✅ Duplicate port validation

### Configuration Generator
- ✅ Generates appsettings.json structure
- ✅ AES-256 password encryption (machine-specific keys)
- ✅ JSON formatting with Newtonsoft.Json

## 🎯 Test Workflow

1. **Start Wizard** (as Administrator)
2. **Welcome Page**: Verify workstation info auto-detected
3. **Database Page**:
   - Server: `192.168.0.86`
   - Port: `49381`
   - Database: `TFCPILOT3`
   - Username: `NSW`
   - Password: `B3sp0k3` (from .env)
   - Click "Test Connection" → Should show ✓ Connection successful!
4. **Server URLs**: Keep defaults
5. **Scale Detection**:
   - Click "Detect Available COM Ports"
   - Verify COM2 and COM3 detected
   - Check dual-scale assignment correct
6. **Navigate**: Use Next/Back buttons (pages 5-8 are placeholders)

## 📦 Generated Output

**Configuration File**: `C:\ProgramData\PKBridgeService\appsettings.json`

```json
{
  "Database": {
    "Server": "192.168.0.86",
    "Port": 49381,
    "Name": "TFCPILOT3",
    "Username": "NSW",
    "Password": "encrypted:AES256:xxxx...",
    "ConnectionTimeout": 30
  },
  "Workstation": {
    "WorkstationName": "YOUR-PC-NAME",
    "WorkstationIP": "192.168.x.x",
    "DefaultScale": "BIG"
  },
  "Scales": {
    "Mode": "Dual",
    "SmallScale": {
      "Enabled": true,
      "PortName": "COM2",
      "ScaleID": "small",
      "BaudRate": 9600,
      "MaxCapacityKG": 5.0
    },
    "BigScale": {
      "Enabled": true,
      "PortName": "COM3",
      "ScaleID": "big",
      "BaudRate": 9600,
      "MaxCapacityKG": 100.0
    }
  },
  "Server": {
    "FrontendURL": "http://192.168.0.10:6060",
    "BackendURL": "http://192.168.0.10:7075",
    "BridgePort": 5000
  }
}
```

## ⚠️ Prerequisites

- ✅ Windows 10/11 (WPF requires Windows)
- ✅ .NET 8 SDK installed
- ✅ SQL Server running at 192.168.0.86:49381
- ✅ TFCPILOT3 database exists
- ✅ Migration script executed (tables created)
- ⚠️ USB scales connected to COM2 and COM3 (optional for testing)
- ⚠️ Administrator privileges (for service installation later)

## 🐛 Common Issues

**"WindowsDesktop SDK not found"**
→ Cannot build in WSL/Linux. Must build on Windows.

**"Administrator privileges required"**
→ Right-click .exe → Run as administrator

**"Database connection failed"**
→ Check SQL Server is running and accessible
→ Verify credentials: NSW / B3sp0k3
→ Check firewall allows port 49381

**"No COM ports detected"**
→ USB scales not connected or drivers not installed
→ Check Device Manager → Ports (COM & LPT)
→ Run wizard as administrator

**"Required tables not found"**
→ Run database migration script first:
```sql
-- From /home/deachawat/dev/projects/BPP/PK/database/migrations/001_create_dual_scale_tables.sql
-- Execute in SQL Server Management Studio
```

## 📁 Project Location

```
WSL Path:
/home/deachawat/dev/projects/BPP/PK/apps/config-wizard

Windows Path:
\\wsl$\Ubuntu\home\deachawat\dev\projects\BPP\PK\apps\config-wizard
```

## 🔧 Development

**To continue development**, open Windows Visual Studio 2022 and navigate to the project via `\\wsl$\Ubuntu\...` path.

**Next implementation tasks**:
1. Complete ScaleTestingPage - Read weight from SerialPort
2. Build ReviewPage - Display configuration summary
3. Implement InstallPage - Copy files, register Windows Service, insert to database
4. Add error handling and logging
5. Create WiX installer project

## 📞 Support

If you encounter build/runtime issues, check:
- BUILD_INSTRUCTIONS.md (detailed troubleshooting)
- README.md (complete project documentation)
- Database migration logs (verify tables created)
