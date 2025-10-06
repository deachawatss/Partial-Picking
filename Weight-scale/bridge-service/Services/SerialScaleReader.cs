using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Ports;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PK.BridgeService.Models;
using PK.BridgeService.Options;

namespace PK.BridgeService.Services;

public sealed class SerialScaleReader : IAsyncDisposable
{
    private static readonly Regex WeightRegex = new(@"(?<sign>[+-])?(?<value>\d+(?:[\.,]\d+)?)", RegexOptions.Compiled);
    private readonly ScaleConfiguration _configuration;
    private readonly ScaleServiceOptions _options;
    private readonly ILogger<SerialScaleReader> _logger;

    private SerialPort? _serialPort;
    private bool _lastConnectionStatus;
    private string? _resolvedPortName;
    private bool _portDiscoveryLogged;
    private bool _portAccessLogged;
    private bool _portUnavailableLogged;
    private bool _portMissingLogged;
    private bool _portNotFoundLogged;
    private bool _invalidDataBitsLogged;
    private bool _invalidBaudRateLogged;
    private bool _invalidStopBitsLogged;
    private bool _invalidConfigurationLogged;
    private bool _serialAccessDisabledLogged;

    // Change detection and debouncing fields
    private double _lastBroadcastedWeight = double.NaN;
    private readonly List<(double WeightKg, DateTime TimestampUtc)> _recentReadings = new(4);
    private DateTime _lastReadingTimestampUtc = DateTime.MinValue;
    private static readonly TimeSpan MaxReadingAge = TimeSpan.FromMilliseconds(1500);
    private const double MinWeightChangeDelta = 0.0005; // 0.5 gram threshold for smoother updates
    private const double StabilityToleranceKg = 0.002; // 2 gram tolerance
    private const int StabilityRequiredReadings = 2;

    // Health monitoring and error recovery fields
    private int _consecutiveTimeouts = 0;
    private int _consecutiveErrors = 0;
    private const int MaxConsecutiveTimeouts = 5;
    private const int MaxConsecutiveErrors = 3;
    private DateTime _lastSuccessfulRead = DateTime.UtcNow;

    public event EventHandler<ScaleWeightSnapshot>? WeightReceived;
    public event EventHandler<ScaleStatusSnapshot>? StatusChanged;

    public SerialScaleReader(
        ScaleConfiguration configuration,
        ScaleServiceOptions options,
        ILogger<SerialScaleReader> logger)
    {
        _configuration = configuration;
        _options = options;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                EnsureSerialPort();
                await PollAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (UnauthorizedAccessException ex)
            {
                if (!_portAccessLogged)
                {
                    _logger.LogError(ex,
                        "Access denied opening serial port {ResolvedPort} (configured {ConfiguredPort}). " +
                        "Ensure the device exists and that the process has permission, or set SCALE_MANUAL_NATIVE_PORT.",
                        GetDisplayPort(),
                        _configuration.PortName);
                    _portAccessLogged = true;
                }

                UpdateStatus(false, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
                ResetSerialPort();
                InvalidateResolvedPort();
            }
            catch (SerialAccessDisabledException)
            {
                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
            }
            catch (IOException ex)
            {
                if (!_portUnavailableLogged)
                {
                    _logger.LogError(ex,
                        "Serial port {ResolvedPort} (configured {ConfiguredPort}) is unavailable.",
                        GetDisplayPort(),
                        _configuration.PortName);
                    _portUnavailableLogged = true;
                }

                UpdateStatus(false, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
                ResetSerialPort();
                InvalidateResolvedPort();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error polling scale {ScaleId} on {Port}", _configuration.ScaleId, GetDisplayPort());
                UpdateStatus(false, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
                ResetSerialPort();
                InvalidateResolvedPort();
            }

            await Task.Delay(TimeSpan.FromMilliseconds(_options.PollingIntervalMilliseconds), cancellationToken);
        }
    }

    private void EnsureSerialPort()
    {
        if (_serialPort is { IsOpen: true })
        {
            return;
        }

        ResetSerialPort();

        var parity = ParseParity(_configuration.Parity);
        var stopBits = SanitizeStopBits(ParseStopBits(_configuration.StopBits));

        var baudRate = SanitizeBaudRate(_configuration.BaudRate);
        var dataBits = SanitizeDataBits(_configuration.DataBits);

        var portName = ResolvePortName();
        var driverPortName = PreparePortForDriver(portName);
        var manualOverride = IsManualOverride(portName);

        if (_options.DisableSerialAccess)
        {
            if (!_serialAccessDisabledLogged)
            {
                var guidance = _options.RunningUnderWsl
                    ? "Serial access is disabled because this process is running under WSL. Run the bridge on Windows or enable USB passthrough and export SCALE_ENABLE_WSL_SERIAL=true."
                    : "Serial access disabled via SCALE_DISABLE_SERIAL environment variable.";

                _logger.LogWarning(
                    "Serial access disabled for scale {ScaleId}: {Guidance}",
                    _configuration.ScaleId ?? _configuration.ControllerId,
                    guidance);
                _serialAccessDisabledLogged = true;
            }

            UpdateStatus(false, "Serial access disabled");
            throw new SerialAccessDisabledException();
        }

        if (!manualOverride && !PortExistsOnHost(portName))
        {
            if (!_portNotFoundLogged)
            {
                _logger.LogWarning(
                    "Serial device {Port} is not present on host {Host}; skipping open attempt. Set SCALE_MANUAL_NATIVE_PORT to override.",
                    portName,
                    Environment.MachineName);
                _portNotFoundLogged = true;
            }

            UpdateStatus(false, $"Serial port {portName} not found");
            InvalidateResolvedPort();
            throw new IOException($"Serial port {portName} not found");
        }

        _logger.LogDebug(
            "Attempting to open serial port {ResolvedPort} (configured {ConfiguredPort}) for scale {ScaleId} with baud {BaudRate}, data bits {DataBits}, parity {Parity}, stop bits {StopBits}{ManualNote}",
            portName,
            _configuration.PortName,
            _configuration.ScaleId ?? _configuration.ControllerId,
            baudRate,
            dataBits,
            parity,
            stopBits,
            manualOverride ? " [manual override]" : string.Empty);

        _serialPort = new SerialPort(driverPortName)
        {
            BaudRate = baudRate,
            DataBits = dataBits,
            Parity = parity,
            StopBits = stopBits,
            ReadTimeout = _options.SerialReadTimeoutMilliseconds,
            WriteTimeout = _options.SerialReadTimeoutMilliseconds,
            NewLine = "\r\n"
        };

        try
        {
            _serialPort.Open();
        }
        catch (ArgumentException ex)
        {
            if (!_invalidConfigurationLogged)
            {
                _logger.LogError(ex,
                    "Serial port {ResolvedPort} rejected the configured settings (baud {BaudRate}, data bits {DataBits}, stop bits {StopBits}). Review scale configuration or overrides.",
                    portName,
                    baudRate,
                    dataBits,
                    stopBits);
                _invalidConfigurationLogged = true;
            }

            _serialPort.Dispose();
            _serialPort = null;
            UpdateStatus(false, ex.Message);
            InvalidateResolvedPort();
            throw new IOException($"Serial port {portName} rejected configured settings", ex);
        }

        _portAccessLogged = false;
        _portUnavailableLogged = false;
        UpdateStatus(true, null);
        _logger.LogInformation("Opened serial port {Port} (configured {ConfiguredPort}) for scale {ScaleId} (baud {Baud}, mode: {Mode})",
            portName,
            _configuration.PortName,
            _configuration.ScaleId,
            baudRate,
            _options.ContinuousMode ? "Continuous" : "Polling");
    }

    private async Task PollAsync(CancellationToken cancellationToken)
    {
        if (_serialPort is not { IsOpen: true } port)
        {
            return;
        }

        string rawData;
        try
        {
            // Conditional polling: send "P" command only if not in continuous mode
            if (!_options.ContinuousMode)
            {
                port.WriteLine("P");
            }

            // Read response with timeout - handles various line ending formats
            rawData = await ReadScaleResponseAsync(port, cancellationToken);

            if (string.IsNullOrWhiteSpace(rawData))
            {
                _consecutiveTimeouts++;
                HandleConsecutiveFailures();

                if (_options.VerboseLogging)
                {
                    _logger.LogDebug("Scale {ScaleId} returned empty response to 'P' command", _configuration.ScaleId);
                }
                return;
            }

            // Success - reset error counters
            _consecutiveTimeouts = 0;
            _consecutiveErrors = 0;
            _lastSuccessfulRead = DateTime.UtcNow;
        }
        catch (TimeoutException)
        {
            _consecutiveTimeouts++;
            port.DiscardInBuffer();

            _logger.LogDebug("Scale {ScaleId} timeout #{Count}", _configuration.ScaleId, _consecutiveTimeouts);

            HandleConsecutiveFailures();
            return;
        }
        catch (Exception ex)
        {
            _consecutiveErrors++;
            port.DiscardInBuffer();

            _logger.LogWarning(ex, "Scale {ScaleId} error #{Count}", _configuration.ScaleId, _consecutiveErrors);

            HandleConsecutiveFailures();
            return;
        }

        // Log raw data received from scale
        _logger.LogDebug("Scale {ScaleId} raw data: {RawData}", _configuration.ScaleId, rawData.Replace("\r", "\\r").Replace("\n", "\\n"));

        var snapshot = ParseWeight(rawData, out var skipped);
        if (snapshot is not null)
        {
            _logger.LogInformation("Scale {ScaleId} weight parsed: {Weight} {Unit} (stable: {Stable})",
                _configuration.ScaleId, snapshot.Weight, snapshot.Unit, snapshot.Stable);
            WeightReceived?.Invoke(this, snapshot);
        }
        else if (!skipped)
        {
            _logger.LogWarning("Scale {ScaleId} failed to parse weight from: {RawData}",
                _configuration.ScaleId, rawData.Replace("\r", "\\r").Replace("\n", "\\n"));
        }
    }

    private async Task<string> ReadScaleResponseAsync(SerialPort port, CancellationToken cancellationToken)
    {
        // Strategy: Wait for scale to process command, then read all available data
        // This handles scales that don't send proper line endings or have varying response times

        var startTime = DateTime.UtcNow;
        var buffer = new System.Text.StringBuilder();
        var hasReceivedData = false;
        var idleCount = 0;
        const int maxIdleReads = 3; // Stop after 3 consecutive reads with no new data

        // Give scale initial time to process command (only needed in polling mode)
        // In continuous mode, scale is already streaming data - no delay needed
        if (!_options.ContinuousMode)
        {
            await Task.Delay(50, cancellationToken); // Reduced from 150ms for faster response
        }

        while ((DateTime.UtcNow - startTime).TotalMilliseconds < _options.SerialReadTimeoutMilliseconds)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException();
            }

            var bytesAvailable = port.BytesToRead;

            if (bytesAvailable > 0)
            {
                // Read all available bytes
                var data = port.ReadExisting();
                buffer.Append(data);
                hasReceivedData = true;
                idleCount = 0;

                // If we got data ending with newline, we likely have complete response
                if (data.EndsWith("\n") || data.EndsWith("\r"))
                {
                    break;
                }
            }
            else if (hasReceivedData)
            {
                // No more data available, but we've received some
                idleCount++;
                if (idleCount >= maxIdleReads)
                {
                    // No new data for several reads, assume response is complete
                    break;
                }
            }

            // Small delay to avoid busy-waiting
            await Task.Delay(20, cancellationToken);
        }

        if (!hasReceivedData)
        {
            throw new TimeoutException($"No response from scale after {_options.SerialReadTimeoutMilliseconds}ms");
        }

        return buffer.ToString().Trim();
    }

    private void HandleConsecutiveFailures()
    {
        // If too many timeouts, trigger port reset
        if (_consecutiveTimeouts >= MaxConsecutiveTimeouts)
        {
            _logger.LogWarning(
                "Scale {ScaleId} had {Count} consecutive timeouts. Resetting port connection.",
                _configuration.ScaleId, _consecutiveTimeouts);

            ResetSerialPort();
            InvalidateResolvedPort();
            _consecutiveTimeouts = 0;
        }

        // If too many errors, trigger port reset
        if (_consecutiveErrors >= MaxConsecutiveErrors)
        {
            _logger.LogError(
                "Scale {ScaleId} had {Count} consecutive errors. Resetting port connection.",
                _configuration.ScaleId, _consecutiveErrors);

            ResetSerialPort();
            InvalidateResolvedPort();
            _consecutiveErrors = 0;
        }

        // Check for prolonged communication failure
        var timeSinceSuccess = DateTime.UtcNow - _lastSuccessfulRead;
        if (timeSinceSuccess > TimeSpan.FromSeconds(30))
        {
            _logger.LogError(
                "Scale {ScaleId} has not responded successfully for {Seconds} seconds. Connection may be lost.",
                _configuration.ScaleId, timeSinceSuccess.TotalSeconds);

            UpdateStatus(false, "No successful communication for 30+ seconds");
        }
    }

    private string ResolvePortName()
    {
        if (_resolvedPortName is not null)
        {
            return _resolvedPortName;
        }

        var preferredManual = ManualOverridePort;

        _logger.LogDebug("ResolvePortName: manual={Manual} runningUnderWsl={RunningUnderWsl}", preferredManual, _options.RunningUnderWsl);

        if (OperatingSystem.IsWindows())
        {
            _resolvedPortName = preferredManual ?? _configuration.PortName;
            return _resolvedPortName;
        }

        if (preferredManual is not null)
        {
            if (PortExistsOnHost(preferredManual) || File.Exists(preferredManual))
            {
                _resolvedPortName = preferredManual;
                LogResolvedPort(preferredManual, preferredManual);
                return _resolvedPortName;
            }

            if (_options.RunningUnderWsl)
            {
                _logger.LogWarning(
                    "Manual native port {Port} not detected yet; attempting connection because WSL override is enabled.",
                    preferredManual);
                _resolvedPortName = preferredManual;
                LogResolvedPort(preferredManual, preferredManual);
                return _resolvedPortName;
            }
        }

        var candidates = BuildPortCandidates();
        var availablePorts = GetAvailablePorts();

        if (_options.RunningUnderWsl)
        {
            foreach (var device in EnumerateWslSerialDevices())
            {
                foreach (var alias in ExpandPortAliases(device))
                {
                    availablePorts.Add(alias);
                }
            }
        }

        _logger.LogDebug("ResolvePortName: candidates={Candidates}", string.Join(", ", candidates));

        var hasUsbSerial = _options.RunningUnderWsl && availablePorts.Any(port =>
            port.Contains("ttyUSB", StringComparison.OrdinalIgnoreCase) ||
            port.Contains("ttyACM", StringComparison.OrdinalIgnoreCase));

        foreach (var candidate in candidates)
        {
            foreach (var alias in ExpandPortAliases(candidate))
            {
                var resolvedAlias = alias;
                var aliasAvailable = false;

                if (OperatingSystem.IsWindows())
                {
                    aliasAvailable = availablePorts.Contains(alias);
                }
                else
                {
                    var aliasPath = alias.Contains('/') ? alias : $"/dev/{alias}";
                    if (File.Exists(aliasPath))
                    {
                        resolvedAlias = aliasPath;
                        aliasAvailable = true;
                    }
                }

                if (aliasAvailable)
                {
                    if (hasUsbSerial && resolvedAlias.Contains("ttyS", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    _resolvedPortName = resolvedAlias;
                    LogResolvedPort(resolvedAlias, candidate);
                    return _resolvedPortName;
                }
            }
        }

        if (_options.RunningUnderWsl)
        {
            var wslResolved = TryResolveWslUsbPort(availablePorts);
            if (wslResolved is not null)
            {
                _logger.LogDebug("ResolvePortName: WSL fallback selected {Port}", wslResolved);
                _resolvedPortName = wslResolved;
                LogResolvedPort(wslResolved, _configuration.PortName);
                return _resolvedPortName;
            }
        }

        _resolvedPortName = preferredManual ?? candidates.FirstOrDefault() ?? _configuration.PortName;

        if (!_portMissingLogged)
        {
            _logger.LogWarning(
                "Unable to resolve serial device for configured port {Port}. Set SCALE_MANUAL_NATIVE_PORT to override.",
                _configuration.PortName);
            _portMissingLogged = true;
        }

        return _resolvedPortName;
    }

    private string? ManualOverridePort => NormalizeManualPort(_configuration.NativePortName)
        ?? NormalizeManualPort(_options.ManualNativePortName);

    private static string? NormalizeManualPort(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (!trimmed.StartsWith("/dev/", StringComparison.OrdinalIgnoreCase) && trimmed.StartsWith("tty", StringComparison.OrdinalIgnoreCase))
        {
            return $"/dev/{trimmed}";
        }

        return trimmed;
    }

    private string? TryResolveWslUsbPort(HashSet<string> availablePorts)
    {
        static bool IsUsbSerial(string port)
            => port.StartsWith("/dev/ttyUSB", StringComparison.OrdinalIgnoreCase) ||
               port.StartsWith("/dev/ttyACM", StringComparison.OrdinalIgnoreCase);

        var normalized = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var port in availablePorts)
        {
            var candidate = NormalizeManualPort(port);
            if (candidate is null)
            {
                continue;
            }

            if (IsUsbSerial(candidate))
            {
                normalized.Add(candidate);
            }
        }

        _logger.LogDebug("TryResolveWslUsbPort: available={Available} normalized={Normalized}", string.Join(", ", availablePorts), string.Join(", ", normalized));

        if (normalized.Count == 0)
        {
            return null;
        }

        if (normalized.Count == 1)
        {
            return normalized.First();
        }

        if (TryParseComPort(_configuration.PortName, out var comNumber))
        {
            var preferred = normalized
                .Select(port => new { port, number = ExtractNumericSuffix(port) })
                .Where(x => x.number.HasValue)
                .Select(x => new { x.port, number = x.number!.Value })
                .OrderBy(x => Math.Abs(x.number - Math.Max(0, comNumber - 1)))
                .ThenBy(x => x.port, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            if (preferred is not null)
            {
                return preferred.port;
            }
        }

        return normalized.OrderBy(p => p, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
    }

    private List<string> BuildPortCandidates()
    {
        var list = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Add(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            var trimmed = value.Trim();
            if (seen.Add(trimmed))
            {
                list.Add(trimmed);
            }
        }

        Add(_configuration.NativePortName);
        Add(_options.ManualNativePortName);
        Add(_configuration.PortName);

        if (TryParseComPort(_configuration.PortName, out var comNumber))
        {
            Add($"ttyS{Math.Max(0, comNumber - 1)}");
            Add($"ttyS{comNumber}");
            Add($"ttyUSB{Math.Max(0, comNumber - 1)}");
            Add($"ttyUSB{comNumber}");
            Add($"ttyACM{Math.Max(0, comNumber - 1)}");
            Add($"ttyACM{comNumber}");
        }

        return list;
    }

    private static HashSet<string> GetAvailablePorts()
    {
        var ports = SerialPort.GetPortNames();
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var port in ports)
        {
            foreach (var alias in ExpandPortAliases(port))
            {
                set.Add(alias);
            }
        }

        return set;
    }

    private static IEnumerable<string> ExpandPortAliases(string? port)
    {
        if (string.IsNullOrWhiteSpace(port))
        {
            yield break;
        }

        yield return port;

        if (!port.Contains('/'))
        {
            yield return $"/dev/{port}";
        }
        else if (port.StartsWith("/dev/", StringComparison.OrdinalIgnoreCase))
        {
            var suffix = port[5..];
            if (!string.IsNullOrWhiteSpace(suffix))
            {
                yield return suffix;
            }
        }
    }

    private static IEnumerable<string> EnumerateWslSerialDevices()
    {
        var patterns = new[]
        {
            "ttyUSB*",
            "ttyACM*",
            "ttyS*"
        };

        foreach (var pattern in patterns)
        {
            string[] candidates;
            try
            {
                candidates = Directory.GetFiles("/dev", pattern);
            }
            catch
            {
                continue;
            }

            foreach (var candidate in candidates)
            {
                yield return candidate;
            }
        }
    }

    private void LogResolvedPort(string resolved, string original)
    {
        if (_portDiscoveryLogged)
        {
            return;
        }

        if (!string.Equals(resolved, original, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Resolved serial port {OriginalPort} to {ResolvedPort}", original, resolved);
        }
        else if (_options.VerboseLogging)
        {
            _logger.LogInformation("Using serial port {ResolvedPort}", resolved);
        }

        _portDiscoveryLogged = true;
    }

    private static bool TryParseComPort(string? portName, out int number)
    {
        number = default;
        if (string.IsNullOrWhiteSpace(portName))
        {
            return false;
        }

        var trimmed = portName.Trim();
        if (!trimmed.StartsWith("COM", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return int.TryParse(trimmed[3..], out number) && number >= 0;
    }

    private static int? ExtractNumericSuffix(string port)
    {
        if (string.IsNullOrWhiteSpace(port))
        {
            return null;
        }

        var span = port.AsSpan();
        var endIndex = span.Length - 1;

        while (endIndex >= 0 && char.IsDigit(span[endIndex]))
        {
            endIndex--;
        }

        if (endIndex == span.Length - 1)
        {
            return null;
        }

        var numericSpan = span[(endIndex + 1)..];
        return int.TryParse(numericSpan, out var value) ? value : null;
    }

    private string GetDisplayPort()
        => _resolvedPortName
           ?? _configuration.NativePortName
           ?? _options.ManualNativePortName
           ?? _configuration.PortName;

    private ScaleWeightSnapshot? ParseWeight(string rawData, out bool skipped)
    {
        skipped = false;

        var lines = rawData.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var filteredOut = false;
        (double WeightKg, bool Stable, string Unit, string RawLine)? fallbackCandidate = null;

        foreach (var line in lines)
        {
            // Scale data format: ,{STATUS} {WEIGHT} {PADDING}
            var fields = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);

            if (fields.Length < 2)
            {
                if (fallbackCandidate is null)
                {
                    var match = WeightRegex.Match(line);
                    if (match.Success)
                    {
                        var numericPortion = match.Groups["value"].Value.Replace(',', '.');
                        if (double.TryParse(numericPortion, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value))
                        {
                            var sign = match.Groups["sign"].Success && match.Groups["sign"].Value == "-" ? -1 : 1;
                            var fallbackUnit = DetectUnit(line) ?? _options.DefaultUnit;
                            var stableFallback = line.Contains("ST", StringComparison.OrdinalIgnoreCase) ||
                                                 line.Contains("OK", StringComparison.OrdinalIgnoreCase);
                            var weightKg = ConvertToKilograms(value * sign, fallbackUnit);

                            fallbackCandidate = (weightKg, stableFallback, fallbackUnit, line);

                            _logger.LogDebug("Scale {ScaleId} fallback candidate: {Weight} {Unit} from line: {Line}",
                                _configuration.ScaleId, value * sign, fallbackUnit, line);
                        }
                    }
                }
                continue;
            }

            var weightFieldIndex = -1;
            var maxAbsWeight = double.NegativeInfinity;
            var rawWeightValue = 0d;

            string? statusCode = null;
            var startIndex = 0;
            if (fields.Length > 0 && TryExtractStatusToken(fields[0], out var extractedStatus))
            {
                statusCode = extractedStatus;
                startIndex = 1;
            }

            for (var i = startIndex; i < fields.Length; i++)
            {
                var field = fields[i];

                if (TryParseNumericField(field, out var numericValue))
                {
                    var absValue = Math.Abs(numericValue);
                    if (weightFieldIndex < 0 || absValue > maxAbsWeight)
                    {
                        weightFieldIndex = i;
                        rawWeightValue = numericValue;
                        maxAbsWeight = absValue;
                    }
                }
            }

            if (weightFieldIndex < 0)
            {
                continue;
            }

            var stable = string.Equals(statusCode, "0", StringComparison.OrdinalIgnoreCase);
            var unit = DetectUnit(line) ?? _options.DefaultUnit;

            // Scale-specific conversion based on hardware format
            // SMALL scale: Sends grams with 3 decimals (e.g., 3482 → 3.482 kg)
            // BIG scale: Sends centikgs with 2 decimals (e.g., 25 → 0.25 kg)
            var weightInKg = _configuration.ScaleType == "SMALL"
                ? rawWeightValue / 1000.0  // Grams to kg (÷1000)
                : rawWeightValue / 100.0;  // Centikgs to kg (÷100)

            var timestampUtc = DateTime.UtcNow;

            _logger.LogDebug(
                "Scale {ScaleId} ({ScaleType}) fields [{Fields}] → status={Status} weightField#{Index}={Value} ({WeightKg}kg)",
                _configuration.ScaleId,
                _configuration.ScaleType,
                string.Join(", ", fields),
                statusCode ?? "none",
                weightFieldIndex,
                rawWeightValue,
                weightInKg);

            var snapshot = BuildSnapshot(weightInKg, stable, unit, timestampUtc, out var filtered);
            if (snapshot is not null)
            {
                return snapshot;
            }

            filteredOut |= filtered;
        }

        if (fallbackCandidate is { } candidate)
        {
            var snapshot = BuildSnapshot(candidate.WeightKg, candidate.Stable, candidate.Unit, DateTime.UtcNow, out var filtered);
            if (snapshot is not null)
            {
                _logger.LogDebug("Scale {ScaleId} using fallback snapshot: {Weight} {Unit}",
                    _configuration.ScaleId, snapshot.Weight, snapshot.Unit);
                return snapshot;
            }

            filteredOut |= filtered;
        }

        if (_options.VerboseLogging && !filteredOut)
        {
            _logger.LogDebug("Unparsed scale data from {ScaleId}: {Payload}", _configuration.ScaleId, rawData);
        }

        skipped = filteredOut;
        return null;
    }

    private ScaleWeightSnapshot? BuildSnapshot(double weightInKg, bool stable, string unit, DateTime timestampUtc, out bool filtered)
    {
        filtered = false;

        if (_lastReadingTimestampUtc != DateTime.MinValue && timestampUtc - _lastReadingTimestampUtc > MaxReadingAge)
        {
            _recentReadings.Clear();
        }

        _recentReadings.RemoveAll(sample => timestampUtc - sample.TimestampUtc > MaxReadingAge);
        _recentReadings.Add((weightInKg, timestampUtc));
        if (_recentReadings.Count > 3)
        {
            _recentReadings.RemoveAt(0);
        }

        // Broadcast all readings regardless of stability status
        // Frontend will handle stability indication based on the 'stable' flag

        var roundedWeightKg = Math.Round(weightInKg, 4);

        if (!double.IsNaN(_lastBroadcastedWeight) && Math.Abs(roundedWeightKg - _lastBroadcastedWeight) < MinWeightChangeDelta)
        {
            filtered = true;
            _logger.LogDebug(
                "Scale {ScaleId} skipping broadcast - weight unchanged: {Weight} kg",
                _configuration.ScaleId,
                roundedWeightKg);
            return null;
        }

        _lastBroadcastedWeight = roundedWeightKg;
        _lastReadingTimestampUtc = timestampUtc;

        var resolvedUnit = string.IsNullOrWhiteSpace(unit) ? _options.DefaultUnit : unit;
        var displayWeight = Math.Round(ConvertFromKilograms(roundedWeightKg, resolvedUnit), 4);

        _logger.LogDebug(
            "Scale {ScaleId} snapshot ready: {WeightKg} kg ({DisplayWeight} {Unit}) stable={Stable}",
            _configuration.ScaleId,
            roundedWeightKg,
            displayWeight,
            resolvedUnit,
            stable);

        return new ScaleWeightSnapshot
        {
            ScaleId = _configuration.ScaleId ?? _configuration.ControllerId,
            Weight = displayWeight,
            Unit = resolvedUnit,
            Stable = stable,
            TimestampUtc = timestampUtc
        };
    }

    private static bool TryExtractStatusToken(string field, out string statusCode)
    {
        statusCode = string.Empty;

        if (string.IsNullOrWhiteSpace(field))
        {
            return false;
        }

        var sanitized = SanitizeStatusToken(field);
        if (sanitized.Length == 0)
        {
            return false;
        }

        var normalized = NormalizeStatusCode(sanitized);
        if (normalized.Length == 0 || normalized.Length > 2 || !normalized.All(char.IsDigit))
        {
            return false;
        }

        statusCode = normalized;
        return true;
    }

    private static string NormalizeStatusCode(string sanitized)
    {
        var trimmed = sanitized.Trim();
        trimmed = trimmed.TrimStart(',');

        if (trimmed.Length == 0)
        {
            return string.Empty;
        }

        if (trimmed[0] is '+' or '-')
        {
            trimmed = trimmed[1..];
        }

        return new string(trimmed.TakeWhile(char.IsDigit).ToArray());
    }

    private static bool TryParseNumericField(string field, out double value)
    {
        var sanitized = SanitizeNumericToken(field);
        if (sanitized.Length == 0)
        {
            value = 0;
            return false;
        }

        return double.TryParse(sanitized, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out value);
    }

    private static string SanitizeStatusToken(string field)
        => new(field.Where(c => c == ',' || c == '+' || c == '-' || char.IsDigit(c)).ToArray());

    private static string SanitizeNumericToken(string field)
    {
        var filtered = field.Where(c => c == '+' || c == '-' || c == '.' || c == ',' || char.IsDigit(c)).ToArray();
        if (filtered.Length == 0)
        {
            return string.Empty;
        }

        for (var i = 0; i < filtered.Length; i++)
        {
            if (filtered[i] == ',')
            {
                filtered[i] = '.';
            }
        }

        return new string(filtered);
    }

    private double ConvertToKilograms(double weight, string unit)
    {
        if (string.Equals(unit, "KG", StringComparison.OrdinalIgnoreCase))
        {
            // Scale-specific conversion based on hardware format
            // SMALL scale: Sends grams with 3 decimals (e.g., 3482 → 3.482 kg)
            // BIG scale: Sends centikgs with 2 decimals (e.g., 25 → 0.25 kg)
            return _configuration.ScaleType == "SMALL"
                ? weight / 1000.0  // Grams to kg (÷1000)
                : weight / 100.0;  // Centikgs to kg (÷100)
        }

        if (string.Equals(unit, "G", StringComparison.OrdinalIgnoreCase))
        {
            return weight / 1000.0;
        }

        if (string.Equals(unit, "LB", StringComparison.OrdinalIgnoreCase))
        {
            return weight * 0.45359237;
        }

        return weight;
    }

    private static double ConvertFromKilograms(double weightInKg, string unit)
    {
        if (string.Equals(unit, "KG", StringComparison.OrdinalIgnoreCase))
        {
            return weightInKg;
        }

        if (string.Equals(unit, "G", StringComparison.OrdinalIgnoreCase))
        {
            return weightInKg * 1000.0;
        }

        if (string.Equals(unit, "LB", StringComparison.OrdinalIgnoreCase))
        {
            return weightInKg / 0.45359237;
        }

        return weightInKg;
    }

    private static bool PortExistsOnHost(string portName)
    {
        var available = GetAvailablePorts();

        foreach (var alias in ExpandPortAliases(portName))
        {
            if (available.Contains(alias))
            {
                return true;
            }
        }

        var driverPort = PreparePortForDriver(portName);
        if (!string.Equals(driverPort, portName, StringComparison.OrdinalIgnoreCase))
        {
            foreach (var alias in ExpandPortAliases(driverPort))
            {
                if (available.Contains(alias))
                {
                    return true;
                }
            }
        }

        return File.Exists(portName);
    }

    private static string PreparePortForDriver(string portName)
    {
        if (string.IsNullOrWhiteSpace(portName))
        {
            return portName;
        }

        if (OperatingSystem.IsWindows())
        {
            if (portName.StartsWith("/dev/", StringComparison.OrdinalIgnoreCase))
            {
                return portName[5..];
            }

            return portName;
        }

        if (!portName.StartsWith("/dev/", StringComparison.OrdinalIgnoreCase) && portName.StartsWith("tty", StringComparison.OrdinalIgnoreCase))
        {
            return $"/dev/{portName}";
        }

        return portName;
    }

    private bool IsManualOverride(string portName)
    {
        var manualPort = ManualOverridePort;
        return manualPort is not null && string.Equals(manualPort, NormalizeManualPort(portName), StringComparison.OrdinalIgnoreCase);
    }

    private sealed class SerialAccessDisabledException : Exception;

    private static string? DetectUnit(string payload)
    {
        payload = payload.ToLowerInvariant();
        if (payload.Contains(" kg") || payload.Contains("kg"))
        {
            return "KG";
        }

        if (payload.Contains(" g") || payload.Contains("gram"))
        {
            return "G";
        }

        if (payload.Contains(" lb") || payload.Contains("lbs"))
        {
            return "LB";
        }

        return null;
    }

    private int SanitizeDataBits(int dataBits)
    {
        if (dataBits is >= 5 and <= 8)
        {
            return dataBits;
        }

        if (!_invalidDataBitsLogged)
        {
            _logger.LogWarning(
                "Unsupported data bits value {DataBits} for scale {ScaleId}; falling back to 8",
                dataBits,
                _configuration.ScaleId ?? _configuration.ControllerId);
            _invalidDataBitsLogged = true;
        }

        return 8;
    }

    private int SanitizeBaudRate(int baudRate)
    {
        if (baudRate > 0)
        {
            return baudRate;
        }

        if (!_invalidBaudRateLogged)
        {
            _logger.LogWarning(
                "Unsupported baud rate {BaudRate} for scale {ScaleId}; falling back to default {DefaultBaudRate}",
                baudRate,
                _configuration.ScaleId ?? _configuration.ControllerId,
                _options.DefaultBaudRate);
            _invalidBaudRateLogged = true;
        }

        return _options.DefaultBaudRate;
    }

    private StopBits SanitizeStopBits(StopBits stopBits)
    {
        if (stopBits is StopBits.One or StopBits.OnePointFive or StopBits.Two)
        {
            return stopBits;
        }

        if (!_invalidStopBitsLogged)
        {
            _logger.LogWarning(
                "Unsupported stop bits value {StopBits} for scale {ScaleId}; falling back to One",
                stopBits,
                _configuration.ScaleId ?? _configuration.ControllerId);
            _invalidStopBitsLogged = true;
        }

        return StopBits.One;
    }

    private void UpdateStatus(bool connected, string? error)
    {
        if (_lastConnectionStatus == connected && string.IsNullOrEmpty(error))
        {
            return;
        }

        _lastConnectionStatus = connected;
        StatusChanged?.Invoke(this, new ScaleStatusSnapshot
        {
            ScaleId = _configuration.ScaleId ?? _configuration.ControllerId,
            Connected = connected,
            PortName = _configuration.PortName,
            Error = error
        });
    }

    private void ResetSerialPort()
    {
        if (_serialPort is null)
        {
            return;
        }

        try
        {
            if (_serialPort.IsOpen)
            {
                _serialPort.Close();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed closing serial port {Port}", _configuration.PortName);
        }
        finally
        {
            _serialPort.Dispose();
            _serialPort = null;
        }
    }

    private void InvalidateResolvedPort()
    {
        _resolvedPortName = null;
        _portDiscoveryLogged = false;
    }

    private static Parity ParseParity(string? parity)
    {
        return parity?.ToLowerInvariant() switch
        {
            "even" => Parity.Even,
            "mark" => Parity.Mark,
            "odd" => Parity.Odd,
            "space" => Parity.Space,
            _ => Parity.None
        };
    }

    private static StopBits ParseStopBits(string? stopBits)
    {
        return stopBits?.ToLowerInvariant() switch
        {
            "none" => StopBits.None,
            "two" => StopBits.Two,
            "onepointfive" or "1.5" or "1,5" => StopBits.OnePointFive,
            _ => StopBits.One
        };
    }

    public async ValueTask DisposeAsync()
    {
        ResetSerialPort();
        await Task.CompletedTask;
    }
}
