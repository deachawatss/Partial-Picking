using System;
using System.Globalization;
using System.IO.Ports;
using System.Linq;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class ScaleTestingPage : Page, IValidatable
{
    private static readonly Regex WeightRegex = new(@"(?<sign>[+-])?(?<value>\d+(?:[\.,]\d+)?)", RegexOptions.Compiled);

    private readonly ConfigurationData _config;
    private SerialPort? _smallScalePort;
    private SerialPort? _bigScalePort;

    public ScaleTestingPage(ConfigurationData config)
    {
        try
        {
            InitializeComponent();
            _config = config;

            Loaded += (s, e) => InitializePage();
            Unloaded += (s, e) => CleanupPorts();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Critical error loading Scale Testing page: {ex.Message}\n\nStack Trace:\n{ex.StackTrace}",
                "Page Load Error", MessageBoxButton.OK, MessageBoxImage.Error);
            throw;
        }
    }

    private void InitializePage()
    {
        try
        {
            // Display port information for SMALL scale
            if (_config.SmallScale?.Enabled == true && !string.IsNullOrEmpty(_config.SmallScale.PortName))
            {
                SmallScalePort.Text = $"Port: {_config.SmallScale.PortName} @ {_config.SmallScale.BaudRate} baud";
                TestSmallScaleButton.IsEnabled = true;
            }
            else
            {
                SmallScalePort.Text = "Port: Not configured";
                TestSmallScaleButton.IsEnabled = false;
            }

            // Display port information for BIG scale
            if (_config.BigScale?.Enabled == true && !string.IsNullOrEmpty(_config.BigScale.PortName))
            {
                BigScalePort.Text = $"Port: {_config.BigScale.PortName} @ {_config.BigScale.BaudRate} baud";
                TestBigScaleButton.IsEnabled = true;
            }
            else
            {
                BigScalePort.Text = "Port: Not configured";
                TestBigScaleButton.IsEnabled = false;
            }

            // Initialize polling interval input
            PollingIntervalInput.Text = _config.PollingIntervalMs.ToString();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error initializing scale testing page: {ex.Message}", "Initialization Error",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void TestSmallScaleButton_Click(object sender, RoutedEventArgs e)
    {
        if (_config.SmallScale == null || string.IsNullOrEmpty(_config.SmallScale.PortName))
        {
            MessageBox.Show("SMALL scale is not configured.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        try
        {
            TestSmallScaleButton.IsEnabled = false;
            TestScale(_config.SmallScale, SmallScaleWeight, SmallScaleStatus, SmallScaleIndicator, "SMALL");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to test SMALL scale: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            SmallScaleStatus.Text = "Test Failed";
            SmallScaleIndicator.Fill = new SolidColorBrush(Color.FromRgb(244, 67, 54)); // Red
        }
        finally
        {
            TestSmallScaleButton.IsEnabled = true;
        }
    }

    private void TestBigScaleButton_Click(object sender, RoutedEventArgs e)
    {
        if (_config.BigScale == null || string.IsNullOrEmpty(_config.BigScale.PortName))
        {
            MessageBox.Show("BIG scale is not configured.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        try
        {
            TestBigScaleButton.IsEnabled = false;
            TestScale(_config.BigScale, BigScaleWeight, BigScaleStatus, BigScaleIndicator, "BIG");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to test BIG scale: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            BigScaleStatus.Text = "Test Failed";
            BigScaleIndicator.Fill = new SolidColorBrush(Color.FromRgb(244, 67, 54)); // Red
        }
        finally
        {
            TestBigScaleButton.IsEnabled = true;
        }
    }

    private void TestScale(ScaleConfig scale, TextBlock weightDisplay, TextBlock statusDisplay, System.Windows.Shapes.Ellipse indicator, string scaleType)
    {
        SerialPort? port = null;

        try
        {
            // Close any existing port for this scale type before opening new one
            if (scaleType == "SMALL")
            {
                _smallScalePort?.Close();
                _smallScalePort?.Dispose();
                _smallScalePort = null;
            }
            else
            {
                _bigScalePort?.Close();
                _bigScalePort?.Dispose();
                _bigScalePort = null;
            }

            // Create and configure serial port
            port = new SerialPort(scale.PortName, scale.BaudRate, Parity.None, 8, StopBits.One);
            port.ReadTimeout = 3000;  // Increased timeout to 3 seconds
            port.WriteTimeout = 1000;
            port.NewLine = "\r\n";    // Set explicit newline terminator
            port.DtrEnable = true;    // Enable DTR signal
            port.RtsEnable = true;    // Enable RTS signal

            // Open port
            port.Open();

            if (!port.IsOpen)
            {
                throw new InvalidOperationException($"Failed to open {scale.PortName}");
            }

            // Clear any existing data in buffers
            port.DiscardInBuffer();
            port.DiscardOutBuffer();

            // Wait for scale to send data (continuous mode - no "P" command needed)
            System.Threading.Thread.Sleep(200);

            // Read weight data from continuously streaming scale
            string response;
            var buffer = new System.Text.StringBuilder();
            var hasReceivedData = false;
            var idleCount = 0;
            const int maxIdleReads = 3;
            var startTime = DateTime.UtcNow;

            while ((DateTime.UtcNow - startTime).TotalMilliseconds < port.ReadTimeout)
            {
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
                System.Threading.Thread.Sleep(20);
            }

            if (!hasReceivedData)
            {
                throw new TimeoutException($"No data received from scale on {scale.PortName}.\n\nCheck:\n- Scale is powered on and in continuous output mode\n- Correct COM port selected ({scale.PortName})\n- Baud rate matches ({scale.BaudRate})\n- Scale is configured to send weight automatically");
            }

            response = buffer.ToString().Trim();

            // Parse weight using robust algorithm from bridge service
            var weight = ParseWeightFromResponse(response);
            if (weight.HasValue)
            {
                // Scale-specific conversion based on hardware format
                // SMALL scale: Sends grams with 3 decimals (e.g., 3482 → 3.482 kg)
                // BIG scale: Sends centikgs with 2 decimals (e.g., 25 → 0.25 kg)
                var weightInKg = scaleType == "SMALL"
                    ? weight.Value / 1000.0  // Grams to kg (÷1000)
                    : weight.Value / 100.0;  // Centikgs to kg (÷100)

                // Update UI
                weightDisplay.Text = weightInKg.ToString("F3");
                statusDisplay.Text = $"Connected ({response})";
                indicator.Fill = new SolidColorBrush(Color.FromRgb(76, 175, 80)); // Green

                // Store the port for the scale type
                if (scaleType == "SMALL")
                {
                    _smallScalePort?.Close();
                    _smallScalePort = port;
                }
                else
                {
                    _bigScalePort?.Close();
                    _bigScalePort = port;
                }
            }
            else
            {
                throw new FormatException($"Invalid weight format: '{response}'. Could not extract numeric weight value.");
            }
        }
        catch (Exception ex)
        {
            port?.Close();
            throw new InvalidOperationException($"Scale test failed: {ex.Message}", ex);
        }
    }

    private void CleanupPorts()
    {
        try
        {
            _smallScalePort?.Close();
            _smallScalePort?.Dispose();
            _smallScalePort = null;
        }
        catch { }

        try
        {
            _bigScalePort?.Close();
            _bigScalePort?.Dispose();
            _bigScalePort = null;
        }
        catch { }
    }

    public bool Validate()
    {
        // Scale testing is optional - always return true
        return true;
    }

    private static double? ParseWeightFromResponse(string response)
    {
        // Split by whitespace and newlines
        var fields = response.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        // Try to parse each field as a number, use largest absolute value
        var weightFieldIndex = -1;
        var maxAbsWeight = double.NegativeInfinity;
        var weightValue = 0.0;

        for (var i = 0; i < fields.Length; i++)
        {
            if (TryParseNumericField(fields[i], out var numericValue))
            {
                var absValue = Math.Abs(numericValue);
                if (weightFieldIndex < 0 || absValue > maxAbsWeight)
                {
                    weightFieldIndex = i;
                    weightValue = numericValue;
                    maxAbsWeight = absValue;
                }
            }
        }

        if (weightFieldIndex >= 0)
        {
            return weightValue;
        }

        // Fallback: use regex to extract any number from the response
        var match = WeightRegex.Match(response);
        if (match.Success)
        {
            var numericPortion = match.Groups["value"].Value.Replace(',', '.');
            if (double.TryParse(numericPortion, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value))
            {
                var sign = match.Groups["sign"].Success && match.Groups["sign"].Value == "-" ? -1 : 1;
                return value * sign;
            }
        }

        return null;
    }

    private static bool TryParseNumericField(string field, out double value)
    {
        var sanitized = SanitizeNumericToken(field);
        if (sanitized.Length == 0)
        {
            value = 0;
            return false;
        }

        return double.TryParse(sanitized,
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint | NumberStyles.AllowThousands,
            CultureInfo.InvariantCulture,
            out value);
    }

    private static string SanitizeNumericToken(string field)
    {
        // Filter to only numeric characters, signs, and decimal separators
        var filtered = field.Where(c => c == '+' || c == '-' || c == '.' || c == ',' || char.IsDigit(c)).ToArray();
        if (filtered.Length == 0)
        {
            return string.Empty;
        }

        // Convert commas to periods for consistent decimal parsing
        for (var i = 0; i < filtered.Length; i++)
        {
            if (filtered[i] == ',')
            {
                filtered[i] = '.';
            }
        }

        return new string(filtered);
    }

    private void PollingIntervalInput_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (int.TryParse(PollingIntervalInput.Text, out int value) && value >= 50 && value <= 1000)
        {
            _config.PollingIntervalMs = value;
        }
    }
}
