using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Services;

public class ConfigurationGenerator
{
    private const string EncryptionPrefix = "encrypted:AES256:";

    public static string GenerateConfigurationFile(ConfigurationData config)
    {
        var configObject = new JObject
        {
            ["Database"] = new JObject
            {
                ["Server"] = config.DatabaseServer,
                ["Port"] = config.DatabasePort,
                ["Name"] = config.DatabaseName,
                ["Username"] = config.DatabaseUsername,
                ["Password"] = EncryptPassword(config.DatabasePassword),
                ["ConnectionTimeout"] = config.ConnectionTimeout
            },
            ["Workstation"] = new JObject
            {
                ["WorkstationName"] = config.WorkstationName,
                ["WorkstationIP"] = config.WorkstationIP,
                ["DefaultScale"] = config.DefaultScale
            },
            ["Scales"] = new JObject
            {
                ["Mode"] = config.ScaleMode.ToString()
            },
            ["Server"] = new JObject
            {
                ["FrontendURL"] = config.FrontendUrl,
                ["BackendURL"] = config.BackendUrl,
                ["BridgePort"] = config.BridgePort
            },
            ["Advanced"] = new JObject
            {
                ["PollingIntervalMs"] = config.PollingIntervalMs,
                ["ReadTimeoutMs"] = config.ReadTimeoutMs,
                ["VerboseLogging"] = config.VerboseLogging,
                ["LogLevel"] = config.LogLevel
            }
        };

        // Add SMALL scale config if enabled
        if (config.SmallScale?.Enabled == true)
        {
            configObject["Scales"]!["SmallScale"] = new JObject
            {
                ["Enabled"] = true,
                ["PortName"] = config.SmallScale.PortName,
                ["ScaleID"] = "small",
                ["BaudRate"] = config.SmallScale.BaudRate,
                ["Parity"] = config.SmallScale.Parity,
                ["DataBits"] = config.SmallScale.DataBits,
                ["StopBits"] = config.SmallScale.StopBits
            };
        }

        // Add BIG scale config if enabled
        if (config.BigScale?.Enabled == true)
        {
            configObject["Scales"]!["BigScale"] = new JObject
            {
                ["Enabled"] = true,
                ["PortName"] = config.BigScale.PortName,
                ["ScaleID"] = "big",
                ["BaudRate"] = config.BigScale.BaudRate,
                ["Parity"] = config.BigScale.Parity,
                ["DataBits"] = config.BigScale.DataBits,
                ["StopBits"] = config.BigScale.StopBits
            };
        }

        return configObject.ToString(Formatting.Indented);
    }

    public static void SaveConfigurationFile(ConfigurationData config, string filePath)
    {
        var json = GenerateConfigurationFile(config);

        // Ensure directory exists
        var directory = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        File.WriteAllText(filePath, json, Encoding.UTF8);
    }

    private static string EncryptPassword(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
        {
            return string.Empty;
        }

        // Use machine-specific key for encryption
        var machineKey = GetMachineSpecificKey();

        using var aes = Aes.Create();
        aes.Key = machineKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        using var msEncrypt = new MemoryStream();

        // Write IV first (needed for decryption)
        msEncrypt.Write(aes.IV, 0, aes.IV.Length);

        using (var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
        using (var swEncrypt = new StreamWriter(csEncrypt))
        {
            swEncrypt.Write(plainText);
        }

        var encrypted = msEncrypt.ToArray();
        var base64 = Convert.ToBase64String(encrypted);

        return $"{EncryptionPrefix}{base64}";
    }

    public static string DecryptPassword(string encryptedText)
    {
        if (string.IsNullOrEmpty(encryptedText) || !encryptedText.StartsWith(EncryptionPrefix))
        {
            return encryptedText;
        }

        var base64 = encryptedText[EncryptionPrefix.Length..];
        var encrypted = Convert.FromBase64String(base64);

        var machineKey = GetMachineSpecificKey();

        using var aes = Aes.Create();
        aes.Key = machineKey;

        // Extract IV from the beginning
        var iv = new byte[aes.IV.Length];
        Array.Copy(encrypted, 0, iv, 0, iv.Length);
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        using var msDecrypt = new MemoryStream(encrypted, iv.Length, encrypted.Length - iv.Length);
        using var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);
        using var srDecrypt = new StreamReader(csDecrypt);

        return srDecrypt.ReadToEnd();
    }

    private static byte[] GetMachineSpecificKey()
    {
        // Generate key based on machine-specific data
        var machineId = Environment.MachineName + Environment.UserName + Environment.ProcessorCount;

        using var sha256 = SHA256.Create();
        return sha256.ComputeHash(Encoding.UTF8.GetBytes(machineId));
    }
}
