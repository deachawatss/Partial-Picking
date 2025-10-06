using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;
using PK.BridgeService.ConfigWizard.Pages;
using PK.BridgeService.ConfigWizard.Services;

namespace PK.BridgeService.ConfigWizard;

public partial class MainWindow : Window
{
    private int _currentStep = 1;
    private readonly ConfigurationData _configData;
    private readonly List<TextBlock> _stepIndicators;

    public MainWindow()
    {
        InitializeComponent();

        _configData = new ConfigurationData();

        // Try to load existing configuration from database if service is already installed
        TryLoadExistingConfiguration();

        _stepIndicators = new List<TextBlock>
        {
            Step1Indicator, Step2Indicator, Step3Indicator, Step4Indicator,
            Step5Indicator, Step6Indicator, Step7Indicator
        };

        NavigateToStep(1);
    }

    private void TryLoadExistingConfiguration()
    {
        try
        {
            // Check if service is already installed
            var serviceInstaller = new ServiceControlManager();
            if (!serviceInstaller.IsServiceInstalled())
            {
                return; // Service not installed, use default configuration
            }

            // Service is installed - try to load configuration from database
            var loaded = DatabaseInstaller.TryLoadExistingConfiguration(_configData);

            if (loaded)
            {
                // Show message that existing configuration was loaded
                MessageBox.Show(
                    "Existing configuration loaded from database.\n\n" +
                    $"Workstation: {_configData.WorkstationName}\n" +
                    $"SMALL Scale: {_configData.SmallScale?.PortName ?? "Not configured"}\n" +
                    $"BIG Scale: {_configData.BigScale?.PortName ?? "Not configured"}\n\n" +
                    "You can review and update the configuration.",
                    "Configuration Loaded",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
            }
        }
        catch (Exception ex)
        {
            // Failed to load configuration - not critical, just use defaults
            MessageBox.Show(
                $"Could not load existing configuration: {ex.Message}\n\n" +
                "Starting with default configuration.",
                "Configuration Load Failed",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
        }
    }

    private void NavigateToStep(int step)
    {
        _currentStep = step;
        UpdateStepIndicators();
        UpdateNavigationButtons();

        Page? page = step switch
        {
            1 => new WelcomePage(_configData),
            2 => new DatabaseConfigPage(_configData),
            3 => new ServerUrlsPage(_configData),
            4 => new ScaleDetectionPage(_configData),
            5 => new ScaleTestingPage(_configData),
            6 => new ReviewPage(_configData),
            7 => new InstallPage(_configData),
            _ => null
        };

        if (page != null)
        {
            ContentFrame.Navigate(page);
            StepTitleText.Text = GetStepTitle(step);
        }
    }

    private string GetStepTitle(int step)
    {
        return step switch
        {
            1 => "Welcome to PK Bridge Configuration",
            2 => "Database Configuration",
            3 => "Server URLs Configuration",
            4 => "COM Port & Scale Detection",
            5 => "Scale Testing & Verification",
            6 => "Review Configuration",
            7 => "Install & Start Service",
            _ => "Configuration"
        };
    }

    private void UpdateStepIndicators()
    {
        for (int i = 0; i < _stepIndicators.Count; i++)
        {
            var indicator = _stepIndicators[i];
            if (i + 1 == _currentStep)
            {
                // Current step - Bold and fully visible
                indicator.FontWeight = FontWeights.Bold;
                indicator.Opacity = 1.0;
            }
            else if (i + 1 < _currentStep)
            {
                // Completed steps - Normal weight, high visibility
                indicator.FontWeight = FontWeights.Normal;
                indicator.Opacity = 0.9;
            }
            else
            {
                // Future steps - Normal weight, moderate visibility
                indicator.FontWeight = FontWeights.Normal;
                indicator.Opacity = 0.7;
            }
        }
    }

    private void UpdateNavigationButtons()
    {
        BackButton.IsEnabled = _currentStep > 1;

        if (_currentStep == 7)
        {
            NextButton.Content = "Finish";
        }
        else
        {
            NextButton.Content = "Next →";
        }
    }

    private void BackButton_Click(object sender, RoutedEventArgs e)
    {
        if (_currentStep > 1)
        {
            NavigateToStep(_currentStep - 1);
        }
    }

    private void NextButton_Click(object sender, RoutedEventArgs e)
    {
        // Validate current step before proceeding
        if (!ValidateCurrentStep())
        {
            return;
        }

        if (_currentStep == 7)
        {
            // Final step - show management dashboard
            var installPage = ContentFrame.Content as InstallPage;
            if (installPage?.InstallationComplete == true)
            {
                ShowManagementDashboard();
            }
            else
            {
                MessageBox.Show(
                    "Installation is not complete. Please wait for all steps to finish.",
                    "Installation In Progress",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning
                );
            }
        }
        else
        {
            NavigateToStep(_currentStep + 1);
        }
    }

    public void ShowWizard()
    {
        // Show wizard UI elements
        StepProgressPanel.Visibility = Visibility.Visible;
        NavigationPanel.Visibility = Visibility.Visible;

        // Reset to first step
        NavigateToStep(1);
    }

    private void ShowManagementDashboard()
    {
        // Hide wizard UI elements
        StepProgressPanel.Visibility = Visibility.Collapsed;
        NavigationPanel.Visibility = Visibility.Collapsed;

        // Navigate to management page
        var managementPage = new ServiceManagementPage(_configData);
        ContentFrame.Navigate(managementPage);
        StepTitleText.Text = "Service Management";
    }

    private bool ValidateCurrentStep()
    {
        // Get current page
        var currentPage = ContentFrame.Content as Page;

        // Each page will implement IValidatable interface for validation
        if (currentPage is IValidatable validatable)
        {
            return validatable.Validate();
        }

        return true;
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(
            "Are you sure you want to cancel the configuration?\n\nAll entered data will be lost.",
            "Cancel Configuration",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
        {
            Close();
        }
    }
}
