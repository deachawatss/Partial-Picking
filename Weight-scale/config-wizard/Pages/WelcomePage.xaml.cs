using System;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Windows.Controls;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Pages;

public partial class WelcomePage : Page, IValidatable
{
    private readonly ConfigurationData _config;

    public WelcomePage(ConfigurationData config)
    {
        InitializeComponent();
        _config = config;

        LoadWorkstationInfo();
    }

    private void LoadWorkstationInfo()
    {
        // Auto-detect workstation name
        _config.WorkstationName = Environment.MachineName;
        WorkstationNameTextBox.Text = _config.WorkstationName;

        // Auto-detect IP address
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            var ipAddress = host.AddressList
                .FirstOrDefault(ip => ip.AddressFamily == AddressFamily.InterNetwork);

            if (ipAddress != null)
            {
                _config.WorkstationIP = ipAddress.ToString();
                WorkstationIPTextBox.Text = _config.WorkstationIP;
            }
            else
            {
                WorkstationIPTextBox.Text = "Unable to detect";
            }
        }
        catch
        {
            WorkstationIPTextBox.Text = "Unable to detect";
        }
    }

    public bool Validate()
    {
        // Welcome page always valid
        return true;
    }
}
