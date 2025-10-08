using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Services;

/// <summary>
/// Handles Windows Service installation, deployment, and configuration for PKBridgeService
/// </summary>
public class WindowsServiceInstaller
{
    private const string ServiceName = "PKBridgeService";
    private const string ServiceDisplayName = "PK Bridge Service";
    private const string ServiceDescription = "Weight scale bridge service for PK Partial Picking System";

    private static readonly string InstallPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
        "PK", "BridgeService"
    );

    /// <summary>
    /// Complete installation process: deploy files, configure, and install Windows Service
    /// </summary>
    public static void Install(ConfigurationData config)
    {
        try
        {
            // Step 1: Deploy service files to Program Files
            DeployServiceFiles();

            // Step 2: Create configuration file
            CreateConfigurationFile(config);

            // Step 3: Install as Windows Service
            InstallWindowsService();

            // Step 4: Register workstation in database
            DatabaseInstaller.RegisterWorkstation(config);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Service installation failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Complete uninstallation: stop service, remove from Windows, delete files, clean database
    /// </summary>
    public static void Uninstall(ConfigurationData config)
    {
        try
        {
            // Step 1: Stop service if running
            var controlManager = new ServiceControlManager();
            if (controlManager.IsServiceInstalled())
            {
                if (controlManager.GetStatus() == "Running")
                {
                    controlManager.Stop();
                }

                // Step 2: Uninstall Windows Service
                UninstallWindowsService();
            }

            // Step 3: Delete service files
            DeleteServiceFiles();

            // Step 4: Clean database records
            DatabaseInstaller.UnregisterWorkstation(config);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Service uninstallation failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Update configuration without reinstalling service
    /// </summary>
    public static void UpdateConfiguration(ConfigurationData config)
    {
        try
        {
            // Step 1: Stop service
            var controlManager = new ServiceControlManager();
            bool wasRunning = false;

            if (controlManager.GetStatus() == "Running")
            {
                controlManager.Stop();
                wasRunning = true;
            }

            // Step 2: Update configuration file
            CreateConfigurationFile(config);

            // Step 3: Update database registration
            DatabaseInstaller.RegisterWorkstation(config);

            // Step 4: Restart service if it was running
            if (wasRunning)
            {
                controlManager.Start();
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Configuration update failed: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Deploy bridge service binaries to Program Files
    /// </summary>
    public static void DeployServiceFiles()
    {
        // Try multiple potential locations for bridge service binaries
        var potentialPaths = new[]
        {
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bridge-service"), // Same directory as wizard
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "bridge-service"), // Parent directory
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "bridge-service"), // Two levels up
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "apps", "bridge-service", "bin", "Release", "net8.0", "win-x64", "publish"), // Self-contained publish output
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "apps", "bridge-service"), // Project structure (fallback)
            @"C:\PK\BridgeService", // Absolute fallback path
        };

        string? sourceDir = null;
        foreach (var path in potentialPaths)
        {
            var normalizedPath = Path.GetFullPath(path);
            if (Directory.Exists(normalizedPath))
            {
                // Verify this is actually the bridge service directory by checking for key files
                if (File.Exists(Path.Combine(normalizedPath, "pk-bridge-service.exe")) ||
                    File.Exists(Path.Combine(normalizedPath, "pk-bridge-service.dll")))
                {
                    sourceDir = normalizedPath;
                    break;
                }
            }
        }

        if (sourceDir == null)
        {
            var searchedPaths = string.Join("\n  - ", potentialPaths.Select(Path.GetFullPath));
            throw new DirectoryNotFoundException(
                $"Bridge service source directory not found. Searched locations:\n  - {searchedPaths}\n\n" +
                $"Please ensure the bridge service binaries are built and available.");
        }

        // Create installation directory
        Directory.CreateDirectory(InstallPath);

        // Copy all files (excluding config files - we'll generate those)
        foreach (var file in Directory.GetFiles(sourceDir, "*.*", SearchOption.AllDirectories))
        {
            var relativePath = Path.GetRelativePath(sourceDir, file);

            // Skip configuration files (we generate these)
            if (relativePath.EndsWith("appsettings.json", StringComparison.OrdinalIgnoreCase) ||
                relativePath.EndsWith(".env", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var destFile = Path.Combine(InstallPath, relativePath);
            var destDir = Path.GetDirectoryName(destFile);

            if (!string.IsNullOrEmpty(destDir))
            {
                Directory.CreateDirectory(destDir);
            }

            File.Copy(file, destFile, overwrite: true);
        }
    }

    /// <summary>
    /// Create appsettings.json configuration file for the bridge service
    /// </summary>
    public static void CreateConfigurationFile(ConfigurationData config)
    {
        var settings = new
        {
            Logging = new
            {
                LogLevel = new
                {
                    Default = "Information",
                    Microsoft = "Warning"
                }
            },
            Database = new
            {
                Server = config.DatabaseServer,
                Port = config.DatabasePort,
                Name = config.DatabaseName,
                Username = config.DatabaseUsername,
                Password = config.DatabasePassword
            },
            Bridge = new
            {
                Port = 5000,
                Host = "0.0.0.0",
                WorkstationName = config.WorkstationName
            },
            Scale = new
            {
                DefaultBaudRate = 9600,
                PollingIntervalMs = 100,
                ReadTimeoutMs = 500,
                DefaultUnit = "KG",
                ContinuousMode = true  // No "P" command - scale streams data automatically
            }
        };

        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var configPath = Path.Combine(InstallPath, "appsettings.json");
        File.WriteAllText(configPath, json, Encoding.UTF8);
    }

    /// <summary>
    /// Install Windows Service using sc.exe
    /// </summary>
    public static void InstallWindowsService()
    {
        var exePath = Path.Combine(InstallPath, "pk-bridge-service.exe");

        if (!File.Exists(exePath))
        {
            throw new FileNotFoundException($"Bridge service executable not found: {exePath}");
        }

        // sc.exe create command
        var createArgs = $"create {ServiceName} " +
                        $"binPath=\"{exePath}\" " +
                        $"DisplayName=\"{ServiceDisplayName}\" " +
                        $"start=auto";

        var createResult = ExecuteScCommand(createArgs);

        if (!createResult.Success)
        {
            throw new InvalidOperationException($"Failed to create service: {createResult.Output}");
        }

        // Set service description
        var descArgs = $"description {ServiceName} \"{ServiceDescription}\"";
        ExecuteScCommand(descArgs);

        // Configure service recovery options (restart on failure)
        var recoveryArgs = $"failure {ServiceName} reset=86400 actions=restart/60000/restart/60000/restart/60000";
        ExecuteScCommand(recoveryArgs);
    }

    /// <summary>
    /// Uninstall Windows Service using sc.exe
    /// </summary>
    private static void UninstallWindowsService()
    {
        var deleteArgs = $"delete {ServiceName}";
        var result = ExecuteScCommand(deleteArgs);

        if (!result.Success)
        {
            throw new InvalidOperationException($"Failed to delete service: {result.Output}");
        }
    }

    /// <summary>
    /// Delete service files from Program Files
    /// </summary>
    private static void DeleteServiceFiles()
    {
        if (Directory.Exists(InstallPath))
        {
            Directory.Delete(InstallPath, recursive: true);
        }

        // Remove parent PK directory if empty
        var pkDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PK");
        if (Directory.Exists(pkDir) && Directory.GetFileSystemEntries(pkDir).Length == 0)
        {
            Directory.Delete(pkDir);
        }
    }

    /// <summary>
    /// Execute sc.exe command and return result
    /// </summary>
    private static (bool Success, string Output) ExecuteScCommand(string arguments)
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                Verb = "runas" // Run as administrator
            };

            using var process = Process.Start(startInfo);
            if (process == null)
            {
                return (false, "Failed to start sc.exe process");
            }

            var output = process.StandardOutput.ReadToEnd();
            var error = process.StandardError.ReadToEnd();

            process.WaitForExit();

            var success = process.ExitCode == 0;
            var message = success ? output : error;

            return (success, message);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>
    /// Check if service is installed
    /// </summary>
    public static bool IsServiceInstalled()
    {
        var result = ExecuteScCommand($"query {ServiceName}");
        return result.Success;
    }

    /// <summary>
    /// Get installation path
    /// </summary>
    public static string GetInstallPath() => InstallPath;
}
