using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;
using PK.BridgeService.ConfigWizard.Services;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class InstallPage : Page, IValidatable
{
    private readonly ConfigurationData _config;
    private bool _installationComplete = false;

    public bool InstallationComplete => _installationComplete;

    public InstallPage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        Loaded += async (s, e) => await StartInstallationAsync();
    }

    public bool Validate()
    {
        return _installationComplete;
    }

    private async Task StartInstallationAsync()
    {
        try
        {
            // Step 1: Deploy service files (20%)
            await UpdateStepAsync(1, "🔄 Deploying files...", async () =>
            {
                WindowsServiceInstaller.DeployServiceFiles();
                await Task.Delay(500); // Brief pause for UI update
            });

            // Step 2: Create configuration (40%)
            await UpdateStepAsync(2, "🔄 Creating configuration...", async () =>
            {
                WindowsServiceInstaller.CreateConfigurationFile(_config);
                await Task.Delay(500);
            });

            // Step 3: Install Windows Service (60%)
            await UpdateStepAsync(3, "🔄 Installing Windows Service...", async () =>
            {
                WindowsServiceInstaller.InstallWindowsService();
                await Task.Delay(500);
            });

            // Step 4: Register workstation in database (80%)
            await UpdateStepAsync(4, "🔄 Registering workstation...", async () =>
            {
                DatabaseInstaller.RegisterWorkstation(_config);
                await Task.Delay(500);
            });

            // Step 5: Start service (100%)
            await UpdateStepAsync(5, "🔄 Starting service...", async () =>
            {
                var serviceControl = new ServiceControlManager();
                await serviceControl.StartAsync();
                await Task.Delay(500);
            });

            // Installation complete
            _installationComplete = true;
            ShowSuccess();
        }
        catch (Exception ex)
        {
            ShowError(ex);
        }
    }

    private async Task UpdateStepAsync(int stepNumber, string statusMessage, Func<Task> action)
    {
        try
        {
            // Update status message
            StatusMessage.Text = statusMessage;

            // Execute the step
            await action();

            // Mark step as complete
            var statusText = GetStepStatusTextBlock(stepNumber);
            if (statusText != null)
            {
                statusText.Text = "✅ Complete";
                statusText.Foreground = System.Windows.Media.Brushes.Green;
            }

            // Update progress bar
            InstallProgressBar.Value = stepNumber * 20;
        }
        catch (Exception ex)
        {
            // Mark step as failed
            var statusText = GetStepStatusTextBlock(stepNumber);
            if (statusText != null)
            {
                statusText.Text = "❌ Failed";
                statusText.Foreground = System.Windows.Media.Brushes.Red;
            }

            throw new InvalidOperationException($"Step {stepNumber} failed: {ex.Message}", ex);
        }
    }

    private TextBlock? GetStepStatusTextBlock(int stepNumber)
    {
        return stepNumber switch
        {
            1 => Step1Status,
            2 => Step2Status,
            3 => Step3Status,
            4 => Step4Status,
            5 => Step5Status,
            _ => null
        };
    }

    private void ShowSuccess()
    {
        StatusMessage.Text = "Installation completed successfully!";
        StatusMessage.Foreground = System.Windows.Media.Brushes.Green;
        SuccessPanel.Visibility = Visibility.Visible;
        ErrorPanel.Visibility = Visibility.Collapsed;
    }

    private void ShowError(Exception ex)
    {
        StatusMessage.Text = "Installation failed";
        StatusMessage.Foreground = System.Windows.Media.Brushes.Red;
        ErrorPanel.Visibility = Visibility.Visible;
        SuccessPanel.Visibility = Visibility.Collapsed;

        ErrorMessage.Text = ex.Message;

        // Log full exception details
        System.Diagnostics.Debug.WriteLine($"Installation error: {ex}");
    }
}
