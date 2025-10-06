using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using PK.BridgeService.ConfigWizard.Models;
using PK.BridgeService.ConfigWizard.Services;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class ServiceManagementPage : Page
{
    private readonly ServiceControlManager _serviceControl;
    private readonly ConfigurationData _config;
    private readonly DispatcherTimer _statusTimer;

    public ServiceManagementPage(ConfigurationData config)
    {
        InitializeComponent();
        _serviceControl = new ServiceControlManager();
        _config = config;

        // Initialize status timer for auto-refresh
        _statusTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(3)
        };
        _statusTimer.Tick += async (s, e) => await RefreshServiceStatusAsync();

        Loaded += async (s, e) => await InitializePageAsync();
    }

    private async Task InitializePageAsync()
    {
        // Reload configuration from database when page loads
        try
        {
            DatabaseInstaller.TryLoadExistingConfiguration(_config);
        }
        catch
        {
            // Failed to load - use existing config
        }

        DisplayConfiguration();
        await RefreshServiceStatusAsync();
        _statusTimer.Start();
    }

    private void DisplayConfiguration()
    {
        WorkstationNameText.Text = $"Workstation: {_config.WorkstationName}";
        DatabaseServerText.Text = $"Database: {_config.DatabaseServer}:{_config.DatabasePort}";
        BridgePortText.Text = "Bridge Port: 5000";

        // Display SMALL scale port if configured (check PortName, not just Enabled)
        if (_config.SmallScale != null && !string.IsNullOrEmpty(_config.SmallScale.PortName))
        {
            SmallScalePortText.Text = $"Port: {_config.SmallScale.PortName}";
        }
        else
        {
            SmallScalePortText.Text = "Port: Not configured";
        }

        // Display BIG scale port if configured (check PortName, not just Enabled)
        if (_config.BigScale != null && !string.IsNullOrEmpty(_config.BigScale.PortName))
        {
            BigScalePortText.Text = $"Port: {_config.BigScale.PortName}";
        }
        else
        {
            BigScalePortText.Text = "Port: Not configured";
        }
    }

    private async Task RefreshServiceStatusAsync()
    {
        try
        {
            var serviceInfo = _serviceControl.GetServiceInfo();

            // Update service status
            UpdateServiceStatus(serviceInfo.Status);

            // Update service details
            if (serviceInfo.IsInstalled)
            {
                ServiceDetailsText.Text = $"Service Name: {serviceInfo.ServiceName} | Start Type: {serviceInfo.StartType}";
            }
            else
            {
                ServiceDetailsText.Text = "Service is not installed";
            }

            // Update button states
            UpdateButtonStates(serviceInfo.Status);

            // Update scale status if service is running
            if (serviceInfo.Status == "Running")
            {
                await UpdateScaleStatusAsync();
            }
            else
            {
                UpdateScaleStatus("SMALL", false, "Service not running");
                UpdateScaleStatus("BIG", false, "Service not running");
            }
        }
        catch (Exception ex)
        {
            SetStatusMessage($"Error: {ex.Message}", Brushes.Red);
        }
    }

    private void UpdateServiceStatus(string status)
    {
        StatusText.Text = status;

        StatusIndicator.Fill = status switch
        {
            "Running" => new SolidColorBrush(Color.FromRgb(76, 175, 80)), // Green
            "Stopped" => new SolidColorBrush(Color.FromRgb(244, 67, 54)), // Red
            "Starting" or "Stopping" => new SolidColorBrush(Color.FromRgb(255, 152, 0)), // Orange
            _ => new SolidColorBrush(Color.FromRgb(158, 158, 158)) // Gray
        };
    }

    private void UpdateButtonStates(string status)
    {
        StartButton.IsEnabled = status is "Stopped" or "Not Installed";
        StopButton.IsEnabled = status == "Running";
        RestartButton.IsEnabled = status == "Running";
    }

    private Task UpdateScaleStatusAsync()
    {
        try
        {
            // TODO: Query bridge service /scales endpoint for actual scale status
            // For now, show connected if service is running
            UpdateScaleStatus("SMALL", true, "Connected");
            UpdateScaleStatus("BIG", true, "Connected");
        }
        catch
        {
            UpdateScaleStatus("SMALL", false, "Unknown");
            UpdateScaleStatus("BIG", false, "Unknown");
        }

        return Task.CompletedTask;
    }

    private void UpdateScaleStatus(string scaleType, bool connected, string statusText)
    {
        var color = connected
            ? new SolidColorBrush(Color.FromRgb(76, 175, 80)) // Green
            : new SolidColorBrush(Color.FromRgb(158, 158, 158)); // Gray

        if (scaleType == "SMALL")
        {
            SmallScaleIndicator.Fill = color;
            SmallScaleStatusText.Text = statusText;
        }
        else
        {
            BigScaleIndicator.Fill = color;
            BigScaleStatusText.Text = statusText;
        }
    }

    private async void StartButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            SetStatusMessage("Starting service...", Brushes.Blue);
            DisableControlButtons();

            var progress = new Progress<string>(message => SetStatusMessage(message, Brushes.Blue));
            await _serviceControl.StartAsync(progress);

            SetStatusMessage("Service started successfully", Brushes.Green);
            await RefreshServiceStatusAsync();
        }
        catch (Exception ex)
        {
            SetStatusMessage($"Failed to start service: {ex.Message}", Brushes.Red);
        }
        finally
        {
            EnableControlButtons();
        }
    }

    private async void StopButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            SetStatusMessage("Stopping service...", Brushes.Blue);
            DisableControlButtons();

            var progress = new Progress<string>(message => SetStatusMessage(message, Brushes.Blue));
            await _serviceControl.StopAsync(progress);

            SetStatusMessage("Service stopped successfully", Brushes.Green);
            await RefreshServiceStatusAsync();
        }
        catch (Exception ex)
        {
            SetStatusMessage($"Failed to stop service: {ex.Message}", Brushes.Red);
        }
        finally
        {
            EnableControlButtons();
        }
    }

    private async void RestartButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            SetStatusMessage("Restarting service...", Brushes.Blue);
            DisableControlButtons();

            var progress = new Progress<string>(message => SetStatusMessage(message, Brushes.Blue));
            await _serviceControl.RestartAsync(progress);

            SetStatusMessage("Service restarted successfully", Brushes.Green);
            await RefreshServiceStatusAsync();
        }
        catch (Exception ex)
        {
            SetStatusMessage($"Failed to restart service: {ex.Message}", Brushes.Red);
        }
        finally
        {
            EnableControlButtons();
        }
    }

    private async void RefreshStatusButton_Click(object sender, RoutedEventArgs e)
    {
        SetStatusMessage("Refreshing status...", Brushes.Blue);

        // Reload configuration from database
        try
        {
            DatabaseInstaller.TryLoadExistingConfiguration(_config);
            DisplayConfiguration(); // Update port display with reloaded config
        }
        catch (Exception ex)
        {
            SetStatusMessage($"Failed to reload configuration: {ex.Message}", Brushes.Red);
        }

        await RefreshServiceStatusAsync();
        SetStatusMessage("Status refreshed", Brushes.Green);
    }

    private void UpdateConfigButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(
            "This will restart the configuration wizard. The service will be stopped during reconfiguration.\n\nContinue?",
            "Update Configuration",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
        {
            try
            {
                // Stop service
                if (_serviceControl.GetStatus() == "Running")
                {
                    _serviceControl.Stop();
                }

                // Navigate to wizard
                var mainWindow = Window.GetWindow(this) as MainWindow;
                mainWindow?.ShowWizard();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to stop service: {ex.Message}",
                    "Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }
    }

    private void UninstallButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(
            "This will completely remove the bridge service, delete all files, and clean database records.\n\n" +
            "Are you sure you want to uninstall?",
            "Uninstall Service",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning
        );

        if (result == MessageBoxResult.Yes)
        {
            try
            {
                SetStatusMessage("Uninstalling service...", Brushes.Blue);
                DisableControlButtons();

                WindowsServiceInstaller.Uninstall(_config);

                MessageBox.Show(
                    "Service uninstalled successfully. The application will now close.",
                    "Uninstall Complete",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information
                );

                Application.Current.Shutdown();
            }
            catch (Exception ex)
            {
                SetStatusMessage($"Uninstall failed: {ex.Message}", Brushes.Red);
                MessageBox.Show(
                    $"Failed to uninstall service: {ex.Message}",
                    "Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
            finally
            {
                EnableControlButtons();
            }
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        _statusTimer.Stop();
        Application.Current.Shutdown();
    }

    private void SetStatusMessage(string message, Brush color)
    {
        StatusMessage.Text = message;
        StatusMessage.Foreground = color;
    }

    private void DisableControlButtons()
    {
        StartButton.IsEnabled = false;
        StopButton.IsEnabled = false;
        RestartButton.IsEnabled = false;
        RefreshStatusButton.IsEnabled = false;
        UpdateConfigButton.IsEnabled = false;
        UninstallButton.IsEnabled = false;
    }

    private void EnableControlButtons()
    {
        RefreshStatusButton.IsEnabled = true;
        UpdateConfigButton.IsEnabled = true;
        UninstallButton.IsEnabled = true;

        var status = _serviceControl.GetStatus();
        UpdateButtonStates(status);
    }
}
