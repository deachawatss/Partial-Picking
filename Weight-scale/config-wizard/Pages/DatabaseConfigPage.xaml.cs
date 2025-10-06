using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Data.SqlClient;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class DatabaseConfigPage : Page, IValidatable
{
    private readonly ConfigurationData _config;
    private bool _connectionTested = false;

    public DatabaseConfigPage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        LoadConfiguration();

        // Ensure password is set after page loads (WPF PasswordBox initialization fix)
        Loaded += (s, e) =>
        {
            if (!string.IsNullOrEmpty(_config.DatabasePassword))
            {
                PasswordBox.Password = _config.DatabasePassword;
            }
        };
    }

    private void LoadConfiguration()
    {
        ServerTextBox.Text = _config.DatabaseServer;
        PortTextBox.Text = _config.DatabasePort.ToString();
        DatabaseNameTextBox.Text = _config.DatabaseName;
        UsernameTextBox.Text = _config.DatabaseUsername;
        TimeoutTextBox.Text = _config.ConnectionTimeout.ToString();

        // Always set password - PasswordBox needs explicit assignment even with defaults
        PasswordBox.Password = _config.DatabasePassword ?? string.Empty;
    }

    private async void TestConnectionButton_Click(object sender, RoutedEventArgs e)
    {
        // Save current values
        SaveConfiguration();

        // Update UI
        TestConnectionButton.IsEnabled = false;
        ConnectionStatusText.Text = "Testing connection...";
        ConnectionStatusText.Foreground = (SolidColorBrush)Application.Current.FindResource("TextSecondaryBrush");

        try
        {
            await Task.Run(() => TestDatabaseConnection());

            ConnectionStatusText.Text = "✓ Connection successful!";
            ConnectionStatusText.Foreground = (SolidColorBrush)Application.Current.FindResource("SuccessBrush");
            _connectionTested = true;
        }
        catch (Exception ex)
        {
            ConnectionStatusText.Text = $"✗ Connection failed: {ex.Message}";
            ConnectionStatusText.Foreground = (SolidColorBrush)Application.Current.FindResource("ErrorBrush");
            _connectionTested = false;
        }
        finally
        {
            TestConnectionButton.IsEnabled = true;
        }
    }

    private void TestDatabaseConnection()
    {
        var connectionString = $"Server={_config.DatabaseServer},{_config.DatabasePort};" +
                              $"Database={_config.DatabaseName};" +
                              $"User Id={_config.DatabaseUsername};" +
                              $"Password={_config.DatabasePassword};" +
                              $"Connect Timeout={_config.ConnectionTimeout};" +
                              $"TrustServerCertificate=True;";

        using var connection = new SqlConnection(connectionString);
        connection.Open();

        // Verify required tables exist
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME IN ('TFC_Weighup_Controllers2', 'TFC_Weighup_WorkStations2')";

        var tableCount = (int)command.ExecuteScalar();
        if (tableCount != 2)
        {
            throw new Exception($"Required tables not found. Expected 2, found {tableCount}. " +
                              "Please run database migration script first.");
        }
    }

    private void SaveConfiguration()
    {
        _config.DatabaseServer = ServerTextBox.Text;
        _config.DatabaseName = DatabaseNameTextBox.Text;
        _config.DatabaseUsername = UsernameTextBox.Text;
        _config.DatabasePassword = PasswordBox.Password;

        if (int.TryParse(PortTextBox.Text, out var port))
        {
            _config.DatabasePort = port;
        }

        if (int.TryParse(TimeoutTextBox.Text, out var timeout))
        {
            _config.ConnectionTimeout = timeout;
        }
    }

    public bool Validate()
    {
        SaveConfiguration();

        if (string.IsNullOrWhiteSpace(_config.DatabaseServer))
        {
            MessageBox.Show("Please enter the database server address.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_config.DatabaseName))
        {
            MessageBox.Show("Please enter the database name.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_config.DatabaseUsername))
        {
            MessageBox.Show("Please enter the database username.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        if (!_connectionTested)
        {
            var result = MessageBox.Show(
                "You haven't tested the database connection.\n\nDo you want to proceed without testing?",
                "Connection Not Tested",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            return result == MessageBoxResult.Yes;
        }

        return true;
    }
}
