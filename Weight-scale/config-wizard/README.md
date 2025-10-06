# PK Bridge Configuration Wizard

WPF application (.NET 8) for configuring PK Bridge Service workstations with dual-scale support.

## Features

✅ **8-Step Wizard Workflow**:
1. Welcome - Auto-detect workstation info
2. Database Configuration - SQL Server connection with testing
3. Server URLs - Frontend/Backend URLs
4. COM Port Detection - Auto-detect and assign COM2 (SMALL) + COM3 (BIG)
5. Scale Testing - Verify weight readings (placeholder)
6. Advanced Settings - Polling intervals, logging (placeholder)
7. Review - Configuration summary (placeholder)
8. Install - Service installation and startup (placeholder)

✅ **NWFTH Brown Theme** - Consistent brand styling
✅ **AES-256 Password Encryption** - Machine-specific encryption keys
✅ **Administrator Privileges Check** - Required for Windows Service installation
✅ **Database Connection Testing** - Verifies TFC_Weighup_*2 tables exist
✅ **COM Port Auto-Detection** - System.IO.Ports integration
✅ **Dual-Scale Support** - SMALL (0-5kg) + BIG (0-100kg) simultaneous operation

## Project Structure

```
config-wizard/
├── PKBridgeConfigWizard.csproj
├── App.xaml / App.xaml.cs
├── MainWindow.xaml / MainWindow.xaml.cs
├── Models/
│   ├── ConfigurationData.cs (main config model)
│   └── IValidatable.cs (validation interface)
├── Pages/
│   ├── WelcomePage.xaml / .cs
│   ├── DatabaseConfigPage.xaml / .cs
│   ├── ServerUrlsPage.xaml / .cs
│   ├── ScaleDetectionPage.xaml / .cs
│   ├── ScaleTestingPage.xaml / .cs (placeholder)
│   ├── AdvancedSettingsPage.xaml / .cs (placeholder)
│   ├── ReviewPage.xaml / .cs (placeholder)
│   └── InstallPage.xaml / .cs (placeholder)
└── Services/
    └── ConfigurationGenerator.cs (config file + encryption)
```

## Dependencies

```xml
<PackageReference Include="Microsoft.Data.SqlClient" Version="5.1.5" />
<PackageReference Include="System.IO.Ports" Version="8.0.0" />
<PackageReference Include="System.Management" Version="8.0.0" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
```

## Build & Run

```bash
cd /home/deachawat/dev/projects/BPP/PK/apps/config-wizard
dotnet build
dotnet run
```

**Important**: Must run with administrator privileges for Windows Service installation.

## Generated Configuration

**Output**: `C:\ProgramData\PKBridgeService\appsettings.json`

```json
{
  "Database": {
    "Server": "192.168.0.86",
    "Port": 49381,
    "Name": "TFCPILOT3",
    "Username": "NSW",
    "Password": "encrypted:AES256:base64...",
    "ConnectionTimeout": 30
  },
  "Workstation": {
    "WorkstationName": "PC-KANINNAT",
    "WorkstationIP": "192.168.1.105",
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

## Next Implementation Steps

1. **Complete Scale Testing Page** - Add System.IO.Ports serial communication for weight reading verification
2. **Implement Advanced Settings Page** - Polling intervals, logging levels, timeouts
3. **Build Review Page** - Display complete configuration summary
4. **Create Install Page** - Windows Service installation, database registration, service startup
5. **Add Service Installer** - Copy bridge service files, register Windows Service
6. **Database Integration** - Insert workstation + scales into TFC_Weighup_*2 tables

## Security

- Passwords encrypted with AES-256
- Machine-specific encryption keys (MachineName + UserName + ProcessorCount)
- Encrypted passwords stored with `encrypted:AES256:` prefix
- Configuration file readable only by SYSTEM and Administrators

## Integration with Bridge Service

The wizard generates `appsettings.json` that the bridge service reads on startup:

```csharp
// Bridge service reads config
var config = new ConfigurationBuilder()
    .SetBasePath("C:\\ProgramData\\PKBridgeService")
    .AddJsonFile("appsettings.json")
    .Build();
```

## Testing

1. Install SQL Server with TFCPILOT3 database
2. Run migration script to create TFC_Weighup_*2 tables
3. Connect USB scales to COM2 and COM3
4. Run wizard as administrator
5. Complete all configuration steps
6. Verify appsettings.json generated correctly
7. Test database connection and COM port detection
