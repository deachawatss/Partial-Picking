namespace PK.BridgeService.ConfigWizard.Models;

public class ConfigurationData
{
    // Workstation Information
    public string WorkstationName { get; set; } = string.Empty;
    public string WorkstationIP { get; set; } = string.Empty;

    // Database Configuration (Production defaults for easier setup)
    public string DatabaseServer { get; set; } = "192.168.0.86";
    public int DatabasePort { get; set; } = 49381;
    public string DatabaseName { get; set; } = "TFCPILOT3";
    public string DatabaseUsername { get; set; } = "NSW";
    public string DatabasePassword { get; set; } = "B3sp0k3"; // Pre-filled for easier wizard completion
    public int ConnectionTimeout { get; set; } = 30;

    // Server URLs
    public string FrontendUrl { get; set; } = "http://192.168.0.10:6060";
    public string BackendUrl { get; set; } = "http://192.168.0.10:7075";
    public int BridgePort { get; set; } = 5000;

    // Scale Configuration
    public ScaleMode ScaleMode { get; set; } = ScaleMode.Dual;
    public ScaleConfig? SmallScale { get; set; }
    public ScaleConfig? BigScale { get; set; }
    public string DefaultScale { get; set; } = "BIG";

    // Advanced Settings
    public int PollingIntervalMs { get; set; } = 400;
    public int ReadTimeoutMs { get; set; } = 500;
    public bool VerboseLogging { get; set; } = false;
    public string LogLevel { get; set; } = "Information";

    // Installation
    public string ServiceInstallPath { get; set; } = @"C:\Program Files\PKBridgeService";
    public string ConfigFilePath { get; set; } = @"C:\ProgramData\PKBridgeService\appsettings.json";
    public bool AutoStartService { get; set; } = true;
}

public enum ScaleMode
{
    Single,
    Dual
}

public class ScaleConfig
{
    public string PortName { get; set; } = string.Empty;
    public string ScaleId { get; set; } = string.Empty;
    public string ScaleType { get; set; } = string.Empty; // "SMALL" or "BIG"
    public int BaudRate { get; set; } = 9600;
    public string Parity { get; set; } = "None";
    public int DataBits { get; set; } = 8;
    public string StopBits { get; set; } = "One";
    public bool Enabled { get; set; } = true;
    public string? Model { get; set; }

    // Test results
    public bool TestPassed { get; set; }
    public string? TestMessage { get; set; }
    public decimal? LastTestWeight { get; set; }
}
