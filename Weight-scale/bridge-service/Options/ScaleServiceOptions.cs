using System;

namespace PK.BridgeService.Options;

public sealed class ScaleServiceOptions
{
    public required string DatabaseServer { get; init; }
    public required int DatabasePort { get; init; }
    public required string DatabaseName { get; init; }
    public required string DatabaseUsername { get; init; }
    public required string DatabasePassword { get; init; }

    public string ComputerName { get; init; } = Environment.GetEnvironmentVariable("CLIENTNAME")
        ?? Environment.MachineName;

    public int DefaultBaudRate { get; init; } = 9600;
    public int PollingIntervalMilliseconds { get; init; } = ParseInt(Environment.GetEnvironmentVariable("WEIGHT_POLLING_INTERVAL_MS"), 400);
    public int SerialReadTimeoutMilliseconds { get; init; } = ParseInt(Environment.GetEnvironmentVariable("SCALE_READ_TIMEOUT_MS"), 500);
    public string DefaultUnit { get; init; } = "KG";
    public bool VerboseLogging { get; init; }
    public bool DisableSerialAccess { get; init; }
    public bool RunningUnderWsl { get; init; }
    public bool ContinuousMode { get; init; } = true; // Default to continuous mode (no "P" command)

    public string? ManualPortName { get; init; } = Environment.GetEnvironmentVariable("SCALE_MANUAL_PORT");
    public string ManualScaleId { get; init; } = Environment.GetEnvironmentVariable("SCALE_MANUAL_SCALE_ID")
        ?? Environment.MachineName;
    public int ManualBaudRate { get; init; } = ParseInt(Environment.GetEnvironmentVariable("SCALE_MANUAL_BAUD_RATE"), 0);
    public int ManualDataBits { get; init; } = ParseInt(Environment.GetEnvironmentVariable("SCALE_MANUAL_DATA_BITS"), 8);
    public string ManualParity { get; init; } = Environment.GetEnvironmentVariable("SCALE_MANUAL_PARITY") ?? "None";
    public string ManualStopBits { get; init; } = Environment.GetEnvironmentVariable("SCALE_MANUAL_STOP_BITS") ?? "One";
    public string? ManualNativePortName { get; init; } = Environment.GetEnvironmentVariable("SCALE_MANUAL_NATIVE_PORT");

    public string BuildConnectionString()
    {
        return $"Server={DatabaseServer},{DatabasePort};Database={DatabaseName};User Id={DatabaseUsername};Password={DatabasePassword};Encrypt=False;TrustServerCertificate=True";
    }

    private static int ParseInt(string? value, int fallback)
        => int.TryParse(value, out var parsed) ? parsed : fallback;
}
