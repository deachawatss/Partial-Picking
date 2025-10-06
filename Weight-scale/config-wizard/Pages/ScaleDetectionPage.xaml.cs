using System.IO.Ports;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class ScaleDetectionPage : Page, IValidatable
{
    private readonly ConfigurationData _config;

    public ScaleDetectionPage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        // Auto-detect COM ports on load
        DetectComPorts();
        LoadConfiguration();
    }

    private void DetectButton_Click(object sender, RoutedEventArgs e)
    {
        DetectComPorts();
    }

    private void DetectComPorts()
    {
        var ports = SerialPort.GetPortNames().OrderBy(p => p).ToArray();

        SmallScalePortComboBox.Items.Clear();
        BigScalePortComboBox.Items.Clear();

        foreach (var port in ports)
        {
            SmallScalePortComboBox.Items.Add(port);
            BigScalePortComboBox.Items.Add(port);
        }

        // Don't auto-select - let user choose their COM ports
        // Just populate the lists with available ports

        if (ports.Length == 0)
        {
            MessageBox.Show(
                "No COM ports detected.\n\nPlease connect your USB scales and try again.",
                "No COM Ports",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
        }
    }

    private void LoadConfiguration()
    {
        if (_config.SmallScale != null)
        {
            SmallScaleEnabledCheckBox.IsChecked = _config.SmallScale.Enabled;
            if (!string.IsNullOrEmpty(_config.SmallScale.PortName))
            {
                SmallScalePortComboBox.SelectedItem = _config.SmallScale.PortName;
            }
            SmallScaleModelTextBox.Text = _config.SmallScale.Model;
        }

        if (_config.BigScale != null)
        {
            BigScaleEnabledCheckBox.IsChecked = _config.BigScale.Enabled;
            if (!string.IsNullOrEmpty(_config.BigScale.PortName))
            {
                BigScalePortComboBox.SelectedItem = _config.BigScale.PortName;
            }
            BigScaleModelTextBox.Text = _config.BigScale.Model;
        }
    }

    private void SaveConfiguration()
    {
        // SMALL scale config (capacity/precision managed by physical scale)
        _config.SmallScale = new ScaleConfig
        {
            Enabled = SmallScaleEnabledCheckBox.IsChecked == true,
            PortName = SmallScalePortComboBox.SelectedItem?.ToString() ?? string.Empty,
            ScaleType = "SMALL",
            ScaleId = "small",
            Model = SmallScaleModelTextBox.Text,
            BaudRate = GetSelectedBaudRate(SmallScaleBaudRateComboBox)
        };

        // BIG scale config (capacity/precision managed by physical scale)
        _config.BigScale = new ScaleConfig
        {
            Enabled = BigScaleEnabledCheckBox.IsChecked == true,
            PortName = BigScalePortComboBox.SelectedItem?.ToString() ?? string.Empty,
            ScaleType = "BIG",
            ScaleId = "big",
            Model = BigScaleModelTextBox.Text,
            BaudRate = GetSelectedBaudRate(BigScaleBaudRateComboBox)
        };

        // Set scale mode
        if (_config.SmallScale.Enabled && _config.BigScale.Enabled)
        {
            _config.ScaleMode = ScaleMode.Dual;
        }
        else
        {
            _config.ScaleMode = ScaleMode.Single;
        }
    }

    private int GetSelectedBaudRate(ComboBox comboBox)
    {
        var selected = (comboBox.SelectedItem as ComboBoxItem)?.Content?.ToString();
        return int.TryParse(selected, out var rate) ? rate : 9600;
    }

    public bool Validate()
    {
        SaveConfiguration();

        // Check if at least one scale is enabled
        if (!_config.SmallScale!.Enabled && !_config.BigScale!.Enabled)
        {
            MessageBox.Show("Please enable at least one scale.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        // Validate SMALL scale if enabled
        if (_config.SmallScale.Enabled && string.IsNullOrEmpty(_config.SmallScale.PortName))
        {
            MessageBox.Show("Please select a COM port for the SMALL scale.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        // Validate BIG scale if enabled
        if (_config.BigScale?.Enabled == true && string.IsNullOrEmpty(_config.BigScale.PortName))
        {
            MessageBox.Show("Please select a COM port for the BIG scale.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        // Check for duplicate ports
        if (_config.SmallScale?.Enabled == true && _config.BigScale?.Enabled == true &&
            _config.SmallScale.PortName == _config.BigScale.PortName)
        {
            MessageBox.Show("SMALL and BIG scales cannot use the same COM port.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        return true;
    }
}
