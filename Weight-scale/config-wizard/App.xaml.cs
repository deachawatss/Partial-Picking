using System;
using System.Windows;
using PK.BridgeService.ConfigWizard.Services;

namespace PK.BridgeService.ConfigWizard;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        try
        {
            // Ensure running with administrator privileges
            if (!IsRunAsAdministrator())
            {
                MessageBox.Show(
                    "This application requires administrator privileges to install Windows services.\n\n" +
                    "Please right-click the application and select 'Run as administrator'.",
                    "Administrator Required",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning
                );
                Shutdown();
                return;
            }

            // Smart launch logic: Check if service is already installed
            bool isServiceInstalled = false;
            try
            {
                isServiceInstalled = WindowsServiceInstaller.IsServiceInstalled();
            }
            catch
            {
                // If we can't check service status, assume not installed and show wizard
                isServiceInstalled = false;
            }

            if (isServiceInstalled)
            {
                // Service is installed - show management dashboard directly
                ShowManagementDashboard();
            }
            else
            {
                // Service not installed - show wizard
                ShowWizard();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Startup Error:\n\n{ex.Message}\n\nStack Trace:\n{ex.StackTrace}",
                "Application Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error
            );
            Shutdown();
        }
    }

    private void ShowWizard()
    {
        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();
    }

    private void ShowManagementDashboard()
    {
        // Create a minimal window with just the management page
        var mainWindow = new MainWindow();
        MainWindow = mainWindow;

        // Load configuration from installed service
        // NOTE: Config loading from appsettings.json will be implemented when service config persistence is added
        var config = new Models.ConfigurationData
        {
            WorkstationName = System.Environment.MachineName
        };

        // Show window and navigate to management dashboard
        mainWindow.Show();

        // Hide wizard UI and show management dashboard
        mainWindow.StepProgressPanel.Visibility = Visibility.Collapsed;
        mainWindow.NavigationPanel.Visibility = Visibility.Collapsed;

        var managementPage = new Pages.ServiceManagementPage(config);
        mainWindow.ContentFrame.Navigate(managementPage);
        mainWindow.StepTitleText.Text = "Service Management";
    }

    private static bool IsRunAsAdministrator()
    {
        var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
        var principal = new System.Security.Principal.WindowsPrincipal(identity);
        return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
    }
}
