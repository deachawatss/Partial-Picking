using System.IO;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PK.BridgeService.Options;
using PK.BridgeService.Services;

// Configure builder to use executable directory as content root
// This ensures appsettings.json is found when running as Windows Service
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

// Configure Windows Service lifetime
// This allows the app to run properly as a Windows Service
builder.Host.UseWindowsService();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(LogLevel.Information);  // Show only important logs (info, warning, error)

static int GetInt(string? value, int fallback)
    => int.TryParse(value, out var parsed) ? parsed : fallback;

static bool GetBool(string? value, bool fallback)
    => bool.TryParse(value, out var parsed) ? parsed : fallback;

// Helper to read from appsettings.json (via Configuration) OR environment variables
string? GetConfig(string configKey, string? envKey = null)
{
    // Try configuration first (reads from appsettings.json)
    var value = builder.Configuration[configKey];
    if (!string.IsNullOrWhiteSpace(value))
    {
        return value;
    }

    // Fallback to environment variable if specified
    if (envKey != null)
    {
        value = Environment.GetEnvironmentVariable(envKey);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    return null;
}

void LoadEnvironment()
{
    var candidates = new[]
    {
        Path.Combine(Environment.CurrentDirectory, ".env"),
        Path.Combine(Environment.CurrentDirectory, "..", ".env"),
        Path.Combine(Environment.CurrentDirectory, "..", "..", ".env"),
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".env")
    };

    foreach (var candidate in candidates)
    {
        var fullPath = Path.GetFullPath(candidate);
        if (File.Exists(fullPath))
        {
            LoadFile(fullPath);
            break;
        }
    }

    static void LoadFile(string filePath)
    {
        foreach (var rawLine in File.ReadAllLines(filePath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim();

            if (value.StartsWith('"') && value.EndsWith('"') && value.Length >= 2)
            {
                value = value[1..^1];
            }

            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }
}

LoadEnvironment();

bool IsRunningInWsl()
{
    if (!OperatingSystem.IsLinux())
    {
        return false;
    }

    if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WSL_DISTRO_NAME")))
    {
        return true;
    }

    try
    {
        var release = File.ReadAllText("/proc/sys/kernel/osrelease");
        if (release.Contains("microsoft", StringComparison.OrdinalIgnoreCase) ||
            release.Contains("wsl", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }
    catch
    {
        // Ignore missing file; treat as not WSL.
    }

    try
    {
        var version = File.ReadAllText("/proc/version");
        if (version.Contains("microsoft", StringComparison.OrdinalIgnoreCase) ||
            version.Contains("wsl", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
    }
    catch
    {
        // Ignore and fall back to default.
    }

    return false;
}

var defaultBaudRate = GetInt(GetConfig("Scale:DefaultBaudRate", "DEFAULT_SCALE_BAUD_RATE"), 9600);
var manualPortName = GetConfig("Scale:ManualPort", "SCALE_MANUAL_PORT"); // No default - must be configured

var runningUnderWsl = IsRunningInWsl();
var disableSerial = GetBool(Environment.GetEnvironmentVariable("SCALE_DISABLE_SERIAL"), false);
var enableWslSerial = GetBool(Environment.GetEnvironmentVariable("SCALE_ENABLE_WSL_SERIAL"), false);

if (runningUnderWsl)
{
    if (!enableWslSerial)
    {
        // Default to allowing serial access in WSL once a USB device is forwarded.
        enableWslSerial = true;
    }

    disableSerial = GetBool(Environment.GetEnvironmentVariable("SCALE_DISABLE_SERIAL"), false);
}

if (runningUnderWsl && !enableWslSerial)
{
    disableSerial = true;
}

var manualScaleId = Environment.GetEnvironmentVariable("SCALE_MANUAL_SCALE_ID")
    ?? (string.IsNullOrWhiteSpace(manualPortName) ? Environment.MachineName : $"manual-{manualPortName}");
var manualBaudRate = GetInt(Environment.GetEnvironmentVariable("SCALE_MANUAL_BAUD_RATE"), defaultBaudRate);
var manualDataBits = GetInt(Environment.GetEnvironmentVariable("SCALE_MANUAL_DATA_BITS"), 8);
var manualParity = Environment.GetEnvironmentVariable("SCALE_MANUAL_PARITY") ?? "None";
var manualStopBits = Environment.GetEnvironmentVariable("SCALE_MANUAL_STOP_BITS") ?? "One";

var options = new ScaleServiceOptions
{
    DatabaseServer = GetConfig("Database:Server", "SCALE_DB_SERVER")
        ?? Environment.GetEnvironmentVariable("DATABASE_SERVER")
        ?? throw new InvalidOperationException("DATABASE_SERVER not configured"),
    DatabasePort = GetInt(GetConfig("Database:Port", "SCALE_DB_PORT")
        ?? Environment.GetEnvironmentVariable("DATABASE_PORT"), 49381),
    DatabaseName = GetConfig("Database:Name", "SCALE_DB_NAME")
        ?? Environment.GetEnvironmentVariable("DATABASE_NAME")
        ?? throw new InvalidOperationException("DATABASE_NAME not configured"),
    DatabaseUsername = GetConfig("Database:Username", "SCALE_DB_USERNAME")
        ?? Environment.GetEnvironmentVariable("DATABASE_USERNAME")
        ?? throw new InvalidOperationException("DATABASE_USERNAME not configured"),
    DatabasePassword = GetConfig("Database:Password", "SCALE_DB_PASSWORD")
        ?? Environment.GetEnvironmentVariable("DATABASE_PASSWORD")
        ?? throw new InvalidOperationException("DATABASE_PASSWORD not configured"),
    DefaultBaudRate = defaultBaudRate,
    PollingIntervalMilliseconds = GetInt(GetConfig("Scale:PollingIntervalMs", "WEIGHT_POLLING_INTERVAL_MS"), 100),
    SerialReadTimeoutMilliseconds = GetInt(GetConfig("Scale:ReadTimeoutMs", "SCALE_READ_TIMEOUT_MS"), 500),
    DefaultUnit = GetConfig("Scale:DefaultUnit", "SCALE_DEFAULT_UNIT") ?? "KG",
    VerboseLogging = GetBool(Environment.GetEnvironmentVariable("VERBOSE_LOGGING"), false),
    ContinuousMode = GetBool(GetConfig("Scale:ContinuousMode", "SCALE_CONTINUOUS_MODE"), true), // Default TRUE for continuous reading
    ManualPortName = manualPortName,
    ManualScaleId = manualScaleId,
    ManualBaudRate = manualBaudRate,
    ManualDataBits = manualDataBits,
    ManualParity = manualParity,
    ManualStopBits = manualStopBits,
    ManualNativePortName = Environment.GetEnvironmentVariable("SCALE_MANUAL_NATIVE_PORT"),
    DisableSerialAccess = disableSerial,
    RunningUnderWsl = runningUnderWsl
};

builder.Services.AddSingleton(options);
builder.Services.AddSingleton<ScaleConfigurationService>();
builder.Services.AddSingleton<ScaleBroadcastService>();
builder.Services.AddHostedService<ScalePollingHostedService>();

var app = builder.Build();

app.UseWebSockets();

app.MapGet("/", () => Results.Ok(new
{
    service = "PK Bridge Service",
    description = "ScaleLibrary.dll WebSocket bridge",
    workstation = options.ComputerName
}));

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    workstation = options.ComputerName,
    timestamp = DateTime.UtcNow
}));

app.MapGet("/scales", async (ScaleConfigurationService configurationService, CancellationToken cancellationToken) =>
{
    var configs = await configurationService.GetActiveConfigurationsAsync(cancellationToken);
    return Results.Ok(configs);
});

// NEW: Type-specific WebSocket endpoints for dual-scale support
app.MapGet("/ws/scale/{type}", async (HttpContext context, string type, ScaleBroadcastService broadcastService) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("Expected WebSocket request");
        return;
    }

    // Validate scale type
    var scaleType = type.ToUpper();
    if (scaleType != "SMALL" && scaleType != "BIG")
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("Invalid scale type. Use 'small' or 'big'");
        return;
    }

    using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
    var clientId = broadcastService.Register(webSocket, scaleType);

    await broadcastService.HandleClientAsync(clientId, webSocket, scaleType, context.RequestAborted);
});

// Legacy endpoint for backward compatibility (redirect to BIG scale)
app.MapGet("/ws/scale", async (HttpContext context) =>
{
    context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
    context.Response.Headers.Location = "/ws/scale/big";
    await context.Response.WriteAsync("Moved to /ws/scale/big. Please use /ws/scale/{small|big} endpoints.");
});

var serverHost = GetConfig("Bridge:Host", "SERVER_HOST") ?? "0.0.0.0";
var bridgePort = GetConfig("Bridge:Port", "BRIDGE_SERVICE_PORT") ?? "5000";
var bindUrl = $"http://{serverHost}:{bridgePort}";

app.Logger.LogInformation("PK Bridge Service listening on {Url}", bindUrl);

await app.RunAsync(bindUrl);
