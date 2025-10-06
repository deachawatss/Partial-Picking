using System;
using System.Windows;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class ReviewPage : Page, IValidatable
{
    private readonly ConfigurationData _config;

    public ReviewPage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        Loaded += (s, e) => LoadConfiguration();
    }

    private void LoadConfiguration()
    {
        // Workstation Information
        WorkstationNameText.Text = _config.WorkstationName;
        MachineNameText.Text = Environment.MachineName;

        // Database Configuration
        DatabaseServerText.Text = _config.DatabaseServer;
        DatabasePortText.Text = _config.DatabasePort.ToString();
        DatabaseNameText.Text = _config.DatabaseName;
        DatabaseUsernameText.Text = _config.DatabaseUsername;

        // Server URLs
        FrontendUrlText.Text = _config.FrontendUrl;
        BackendUrlText.Text = _config.BackendUrl;

        // SMALL Scale Configuration
        if (_config.SmallScale != null)
        {
            SmallScaleStatusText.Text = _config.SmallScale.Enabled ? "Enabled" : "Disabled";
            SmallScalePortText.Text = _config.SmallScale.PortName ?? "Not configured";
            SmallScaleBaudText.Text = _config.SmallScale.BaudRate.ToString();
            SmallScaleModelText.Text = _config.SmallScale.Model ?? "Not specified";
        }

        // BIG Scale Configuration
        if (_config.BigScale != null)
        {
            BigScaleStatusText.Text = _config.BigScale.Enabled ? "Enabled" : "Disabled";
            BigScalePortText.Text = _config.BigScale.PortName ?? "Not configured";
            BigScaleBaudText.Text = _config.BigScale.BaudRate.ToString();
            BigScaleModelText.Text = _config.BigScale.Model ?? "Not specified";
        }
    }

    private void EditWorkstation_Click(object sender, RoutedEventArgs e)
    {
        // Navigate back to Step 1 (Welcome page)
        var mainWindow = Window.GetWindow(this) as MainWindow;
        if (mainWindow != null)
        {
            var navigationMethod = mainWindow.GetType().GetMethod("NavigateToStep",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            navigationMethod?.Invoke(mainWindow, new object[] { 1 });
        }
    }

    private void EditDatabase_Click(object sender, RoutedEventArgs e)
    {
        // Navigate back to Step 2 (Database page)
        var mainWindow = Window.GetWindow(this) as MainWindow;
        if (mainWindow != null)
        {
            var navigationMethod = mainWindow.GetType().GetMethod("NavigateToStep",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            navigationMethod?.Invoke(mainWindow, new object[] { 2 });
        }
    }

    private void EditUrls_Click(object sender, RoutedEventArgs e)
    {
        // Navigate back to Step 3 (Server URLs page)
        var mainWindow = Window.GetWindow(this) as MainWindow;
        if (mainWindow != null)
        {
            var navigationMethod = mainWindow.GetType().GetMethod("NavigateToStep",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            navigationMethod?.Invoke(mainWindow, new object[] { 3 });
        }
    }

    private void EditScales_Click(object sender, RoutedEventArgs e)
    {
        // Navigate back to Step 4 (Scale Detection page)
        var mainWindow = Window.GetWindow(this) as MainWindow;
        if (mainWindow != null)
        {
            var navigationMethod = mainWindow.GetType().GetMethod("NavigateToStep",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            navigationMethod?.Invoke(mainWindow, new object[] { 4 });
        }
    }

    public bool Validate() => true;
}
