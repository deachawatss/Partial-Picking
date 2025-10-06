using System;
using System.Diagnostics;
using System.ServiceProcess;
using System.Threading;
using System.Threading.Tasks;

namespace PK.BridgeService.ConfigWizard.Services;

/// <summary>
/// Manages PKBridgeService control operations (Start, Stop, Restart, Status)
/// </summary>
public class ServiceControlManager
{
    private const string ServiceName = "PKBridgeService";
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Check if service is installed
    /// </summary>
    public bool IsServiceInstalled()
    {
        try
        {
            using var service = new ServiceController(ServiceName);
            // Accessing Status will throw if service doesn't exist
            _ = service.Status;
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    /// <summary>
    /// Get current service status
    /// </summary>
    public string GetStatus()
    {
        if (!IsServiceInstalled())
        {
            return "Not Installed";
        }

        try
        {
            using var service = new ServiceController(ServiceName);
            return service.Status switch
            {
                ServiceControllerStatus.Running => "Running",
                ServiceControllerStatus.Stopped => "Stopped",
                ServiceControllerStatus.Paused => "Paused",
                ServiceControllerStatus.StartPending => "Starting",
                ServiceControllerStatus.StopPending => "Stopping",
                ServiceControllerStatus.PausePending => "Pausing",
                ServiceControllerStatus.ContinuePending => "Resuming",
                _ => "Unknown"
            };
        }
        catch (Exception)
        {
            return "Error";
        }
    }

    /// <summary>
    /// Start the service
    /// </summary>
    public void Start()
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        using var service = new ServiceController(ServiceName);

        if (service.Status == ServiceControllerStatus.Running)
        {
            return; // Already running
        }

        if (service.Status == ServiceControllerStatus.Paused)
        {
            service.Continue();
            service.WaitForStatus(ServiceControllerStatus.Running, DefaultTimeout);
            return;
        }

        service.Start();
        service.WaitForStatus(ServiceControllerStatus.Running, DefaultTimeout);
    }

    /// <summary>
    /// Stop the service
    /// </summary>
    public void Stop()
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        using var service = new ServiceController(ServiceName);

        if (service.Status == ServiceControllerStatus.Stopped)
        {
            return; // Already stopped
        }

        if (service.CanStop)
        {
            service.Stop();
            service.WaitForStatus(ServiceControllerStatus.Stopped, DefaultTimeout);
        }
        else
        {
            throw new InvalidOperationException("Service cannot be stopped");
        }
    }

    /// <summary>
    /// Restart the service
    /// </summary>
    public void Restart()
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        Stop();
        Thread.Sleep(1000); // Brief pause between stop and start
        Start();
    }

    /// <summary>
    /// Start the service asynchronously with progress reporting
    /// </summary>
    public async Task StartAsync(IProgress<string>? progress = null, CancellationToken cancellationToken = default)
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        await Task.Run(() =>
        {
            using var service = new ServiceController(ServiceName);

            if (service.Status == ServiceControllerStatus.Running)
            {
                progress?.Report("Service is already running");
                return;
            }

            progress?.Report("Starting service...");
            service.Start();

            var timeout = DateTime.UtcNow.Add(DefaultTimeout);
            while (service.Status != ServiceControllerStatus.Running)
            {
                if (DateTime.UtcNow > timeout)
                {
                    throw new System.TimeoutException("Service start operation timed out");
                }

                if (cancellationToken.IsCancellationRequested)
                {
                    throw new OperationCanceledException();
                }

                Thread.Sleep(250);
                service.Refresh();
                progress?.Report($"Service status: {service.Status}");
            }

            progress?.Report("Service started successfully");
        }, cancellationToken);
    }

    /// <summary>
    /// Stop the service asynchronously with progress reporting
    /// </summary>
    public async Task StopAsync(IProgress<string>? progress = null, CancellationToken cancellationToken = default)
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        await Task.Run(() =>
        {
            using var service = new ServiceController(ServiceName);

            if (service.Status == ServiceControllerStatus.Stopped)
            {
                progress?.Report("Service is already stopped");
                return;
            }

            if (!service.CanStop)
            {
                throw new InvalidOperationException("Service cannot be stopped");
            }

            progress?.Report("Stopping service...");
            service.Stop();

            var timeout = DateTime.UtcNow.Add(DefaultTimeout);
            while (service.Status != ServiceControllerStatus.Stopped)
            {
                if (DateTime.UtcNow > timeout)
                {
                    throw new System.TimeoutException("Service stop operation timed out");
                }

                if (cancellationToken.IsCancellationRequested)
                {
                    throw new OperationCanceledException();
                }

                Thread.Sleep(250);
                service.Refresh();
                progress?.Report($"Service status: {service.Status}");
            }

            progress?.Report("Service stopped successfully");
        }, cancellationToken);
    }

    /// <summary>
    /// Restart the service asynchronously with progress reporting
    /// </summary>
    public async Task RestartAsync(IProgress<string>? progress = null, CancellationToken cancellationToken = default)
    {
        if (!IsServiceInstalled())
        {
            throw new InvalidOperationException("Service is not installed");
        }

        progress?.Report("Restarting service...");

        await StopAsync(progress, cancellationToken);
        await Task.Delay(1000, cancellationToken); // Brief pause
        await StartAsync(progress, cancellationToken);

        progress?.Report("Service restarted successfully");
    }

    /// <summary>
    /// Get detailed service information
    /// </summary>
    public ServiceInfo GetServiceInfo()
    {
        if (!IsServiceInstalled())
        {
            return new ServiceInfo
            {
                IsInstalled = false,
                Status = "Not Installed"
            };
        }

        try
        {
            using var service = new ServiceController(ServiceName);

            return new ServiceInfo
            {
                IsInstalled = true,
                ServiceName = service.ServiceName,
                DisplayName = service.DisplayName,
                Status = service.Status.ToString(),
                CanStop = service.CanStop,
                CanPauseAndContinue = service.CanPauseAndContinue,
                StartType = GetStartType(service)
            };
        }
        catch (Exception ex)
        {
            return new ServiceInfo
            {
                IsInstalled = true,
                Status = "Error",
                ErrorMessage = ex.Message
            };
        }
    }

    /// <summary>
    /// Get service start type (Automatic, Manual, Disabled)
    /// </summary>
    private string GetStartType(ServiceController service)
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"qc {ServiceName}",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return "Unknown";

            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();

            if (output.Contains("AUTO_START"))
                return "Automatic";
            if (output.Contains("DEMAND_START"))
                return "Manual";
            if (output.Contains("DISABLED"))
                return "Disabled";

            return "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }
}

/// <summary>
/// Service information model
/// </summary>
public class ServiceInfo
{
    public bool IsInstalled { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool CanStop { get; set; }
    public bool CanPauseAndContinue { get; set; }
    public string StartType { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}
