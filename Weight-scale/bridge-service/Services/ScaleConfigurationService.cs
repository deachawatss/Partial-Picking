using System;
using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using PK.BridgeService.Models;
using PK.BridgeService.Options;

namespace PK.BridgeService.Services;

public sealed class ScaleConfigurationService
{
    private readonly ScaleServiceOptions _options;
    private readonly ILogger<ScaleConfigurationService> _logger;

    public ScaleConfigurationService(
        ScaleServiceOptions options,
        ILogger<ScaleConfigurationService> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ScaleConfiguration>> GetActiveConfigurationsAsync(CancellationToken cancellationToken)
    {
        var configurations = new List<ScaleConfiguration>();

        // Query NEW dual-scale tables: TFC_Weighup_WorkStations2 and TFC_Weighup_Controllers2
        const string query = @"
            SELECT
                ws.WorkstationName,
                ws.DualScaleEnabled,

                -- SMALL scale
                c_small.ControllerID AS SmallControllerID,
                c_small.ScaleType AS SmallScaleType,
                c_small.PortName AS SmallPortName,
                COALESCE(CAST(c_small.BaudRate AS INT), @DefaultBaud) AS SmallBaudRate,
                COALESCE(c_small.DataBits, 8) AS SmallDataBits,
                COALESCE(c_small.Parity, 'None') AS SmallParity,
                COALESCE(CAST(c_small.StopBits AS NVARCHAR(10)), 'One') AS SmallStopBits,

                -- BIG scale
                c_big.ControllerID AS BigControllerID,
                c_big.ScaleType AS BigScaleType,
                c_big.PortName AS BigPortName,
                COALESCE(CAST(c_big.BaudRate AS INT), @DefaultBaud) AS BigBaudRate,
                COALESCE(c_big.DataBits, 8) AS BigDataBits,
                COALESCE(c_big.Parity, 'None') AS BigParity,
                COALESCE(CAST(c_big.StopBits AS NVARCHAR(10)), 'One') AS BigStopBits

            FROM TFC_Weighup_WorkStations2 ws
            LEFT JOIN TFC_Weighup_Controllers2 c_small
                ON c_small.ControllerID = ws.ControllerID_Small
            LEFT JOIN TFC_Weighup_Controllers2 c_big
                ON c_big.ControllerID = ws.ControllerID_Big
            WHERE ws.WorkstationName = @WorkstationName
                AND ws.IsActive = 1
        ";
        try
        {
            await using var connection = new SqlConnection(_options.BuildConnectionString());
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection)
            {
                CommandType = CommandType.Text
            };

            command.Parameters.Add(new SqlParameter("@WorkstationName", SqlDbType.NVarChar, 128)
            {
                Value = _options.ComputerName
            });

            command.Parameters.Add(new SqlParameter("@DefaultBaud", SqlDbType.Int)
            {
                Value = _options.DefaultBaudRate
            });

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var workstationName = GetString(reader, "WorkstationName", _options.ComputerName);

                // Create SMALL scale configuration if exists
                var smallPortName = GetString(reader, "SmallPortName", string.Empty);
                if (!string.IsNullOrWhiteSpace(smallPortName))
                {
                    var smallConfig = new ScaleConfiguration
                    {
                        ControllerId = GetString(reader, "SmallControllerID", "small"),
                        PortName = smallPortName,
                        WorkstationName = workstationName,
                        ScaleId = "small",
                        ScaleType = "SMALL",
                        BaudRate = GetInt(reader, "SmallBaudRate", _options.DefaultBaudRate),
                        DataBits = GetInt(reader, "SmallDataBits", 8),
                        Parity = GetString(reader, "SmallParity", "None"),
                        StopBits = GetString(reader, "SmallStopBits", "One"),
                        NativePortName = _options.ManualNativePortName
                    };
                    configurations.Add(smallConfig);
                }

                // Create BIG scale configuration if exists
                var bigPortName = GetString(reader, "BigPortName", string.Empty);
                if (!string.IsNullOrWhiteSpace(bigPortName))
                {
                    var bigConfig = new ScaleConfiguration
                    {
                        ControllerId = GetString(reader, "BigControllerID", "big"),
                        PortName = bigPortName,
                        WorkstationName = workstationName,
                        ScaleId = "big",
                        ScaleType = "BIG",
                        BaudRate = GetInt(reader, "BigBaudRate", _options.DefaultBaudRate),
                        DataBits = GetInt(reader, "BigDataBits", 8),
                        Parity = GetString(reader, "BigParity", "None"),
                        StopBits = GetString(reader, "BigStopBits", "One"),
                        NativePortName = _options.ManualNativePortName
                    };
                    configurations.Add(bigConfig);
                }
            }

            if (configurations.Count == 0)
            {
                _logger.LogWarning("No scale configuration found in TFC_Weighup_WorkStations2 for workstation {WorkstationName}", _options.ComputerName);
            }
            else
            {
                _logger.LogInformation("Loaded {Count} scale configuration(s) for workstation {WorkstationName}", configurations.Count, _options.ComputerName);
            }

            return configurations;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Unable to load scale configuration from {Server}:{Port}/{Database}", _options.DatabaseServer, _options.DatabasePort, _options.DatabaseName);
            return BuildManualFallback();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error loading scale configuration");
            return BuildManualFallback();
        }
    }

    private static int GetInt(SqlDataReader reader, string columnName, int fallback)
    {
        var value = reader[columnName];
        if (value is null || value == DBNull.Value)
        {
            return fallback;
        }

        return value switch
        {
            int i => i,
            short s => s,
            byte b => b,
            long l => (int)l,
            decimal d => (int)d,
            double dbl => (int)dbl,
            float f => (int)f,
            string str when int.TryParse(str, out var result) => result,
            _ => fallback
        };
    }

    private static string GetString(SqlDataReader reader, string columnName, string fallback)
    {
        var value = reader[columnName];
        if (value is null || value == DBNull.Value)
        {
            return fallback;
        }

        return value.ToString() ?? fallback;
    }

    private IReadOnlyList<ScaleConfiguration> BuildManualFallback()
    {
        if (string.IsNullOrWhiteSpace(_options.ManualPortName))
        {
            return Array.Empty<ScaleConfiguration>();
        }

        _logger.LogWarning("Using manual scale configuration for port {PortName}", _options.ManualPortName);

        var baudRate = _options.ManualBaudRate > 0 ? _options.ManualBaudRate : _options.DefaultBaudRate;

        var config = new ScaleConfiguration
        {
            ControllerId = _options.ManualScaleId,
            PortName = _options.ManualPortName!,
            WorkstationName = _options.ComputerName,
            ScaleId = _options.ManualScaleId,
            BaudRate = baudRate,
            DataBits = _options.ManualDataBits,
            Parity = _options.ManualParity,
            StopBits = _options.ManualStopBits,
            NativePortName = _options.ManualNativePortName
        };

        return new[] { config };
    }
}
