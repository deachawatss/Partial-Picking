using System.Windows;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class ServerUrlsPage : Page, IValidatable
{
    private readonly ConfigurationData _config;

    public ServerUrlsPage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        LoadConfiguration();
    }

    private void LoadConfiguration()
    {
        FrontendUrlTextBox.Text = _config.FrontendUrl;
        BackendUrlTextBox.Text = _config.BackendUrl;
        BridgePortTextBox.Text = _config.BridgePort.ToString();
    }

    private void SaveConfiguration()
    {
        _config.FrontendUrl = FrontendUrlTextBox.Text;
        _config.BackendUrl = BackendUrlTextBox.Text;

        if (int.TryParse(BridgePortTextBox.Text, out var port))
        {
            _config.BridgePort = port;
        }
    }

    public bool Validate()
    {
        SaveConfiguration();

        if (string.IsNullOrWhiteSpace(_config.FrontendUrl))
        {
            MessageBox.Show("Please enter the frontend URL.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_config.BackendUrl))
        {
            MessageBox.Show("Please enter the backend URL.", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        if (_config.BridgePort < 1 || _config.BridgePort > 65535)
        {
            MessageBox.Show("Please enter a valid port number (1-65535).", "Validation Error",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }

        return true;
    }
}
