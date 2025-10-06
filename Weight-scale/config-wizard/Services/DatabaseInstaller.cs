using System;
using Microsoft.Data.SqlClient;
using PK.BridgeService.ConfigWizard.Models;

namespace PK.BridgeService.ConfigWizard.Services;

public class DatabaseInstaller
{
    public static void RegisterWorkstation(ConfigurationData config)
    {
        var connectionString = BuildConnectionString(config);

        using var connection = new SqlConnection(connectionString);
        connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // Step 1: Upsert SMALL scale controller if enabled
            int? smallControllerID = null;
            if (config.SmallScale?.Enabled == true)
            {
                smallControllerID = UpsertController(connection, transaction, config.SmallScale, config.WorkstationName);
            }

            // Step 2: Upsert BIG scale controller if enabled
            int? bigControllerID = null;
            if (config.BigScale?.Enabled == true)
            {
                bigControllerID = UpsertController(connection, transaction, config.BigScale, config.WorkstationName);
            }

            // Step 3: Upsert workstation with controller references
            UpsertWorkstation(connection, transaction, config, smallControllerID, bigControllerID);

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private static int UpsertController(SqlConnection connection, SqlTransaction transaction,
                                       ScaleConfig scale, string workstationName)
    {
        // Check if controller exists for this workstation and scale type
        var checkSql = @"
            SELECT ControllerID
            FROM TFC_Weighup_Controllers2
            WHERE WorkstationName = @WorkstationName
              AND ScaleType = @ScaleType";

        using var checkCmd = new SqlCommand(checkSql, connection, transaction);
        checkCmd.Parameters.AddWithValue("@WorkstationName", workstationName);
        checkCmd.Parameters.AddWithValue("@ScaleType", scale.ScaleType);

        var existingID = checkCmd.ExecuteScalar();

        if (existingID != null)
        {
            // UPDATE existing controller
            var updateSql = @"
                UPDATE TFC_Weighup_Controllers2
                SET ControllerModel = @ControllerModel,
                    PortName = @PortName,
                    BaudRate = @BaudRate,
                    User1 = @User1,
                    User2 = @User2,
                    User6 = GETDATE()
                WHERE ControllerID = @ControllerID";

            using var updateCmd = new SqlCommand(updateSql, connection, transaction);
            updateCmd.Parameters.AddWithValue("@ControllerID", existingID);
            updateCmd.Parameters.AddWithValue("@ControllerModel", scale.Model ?? (object)DBNull.Value);
            updateCmd.Parameters.AddWithValue("@PortName", scale.PortName);
            updateCmd.Parameters.AddWithValue("@BaudRate", scale.BaudRate.ToString());
            updateCmd.Parameters.AddWithValue("@User1", $"Updated by wizard");
            updateCmd.Parameters.AddWithValue("@User2", $"{scale.ScaleType} Scale");
            updateCmd.ExecuteNonQuery();

            return Convert.ToInt32(existingID);
        }
        else
        {
            // INSERT new controller
            var insertSql = @"
                INSERT INTO TFC_Weighup_Controllers2
                (ControllerModel, PortName, BaudRate, ScaleType, WorkstationName, User1, User2, User6)
                VALUES
                (@ControllerModel, @PortName, @BaudRate, @ScaleType, @WorkstationName, @User1, @User2, GETDATE());
                SELECT CAST(SCOPE_IDENTITY() AS INT);";

            using var insertCmd = new SqlCommand(insertSql, connection, transaction);
            insertCmd.Parameters.AddWithValue("@ControllerModel", scale.Model ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@PortName", scale.PortName);
            insertCmd.Parameters.AddWithValue("@BaudRate", scale.BaudRate.ToString());
            insertCmd.Parameters.AddWithValue("@ScaleType", scale.ScaleType);
            insertCmd.Parameters.AddWithValue("@WorkstationName", workstationName);
            insertCmd.Parameters.AddWithValue("@User1", $"Created by wizard");
            insertCmd.Parameters.AddWithValue("@User2", $"{scale.ScaleType} Scale");

            var newID = insertCmd.ExecuteScalar();
            return Convert.ToInt32(newID);
        }
    }

    private static void UpsertWorkstation(SqlConnection connection, SqlTransaction transaction,
                                         ConfigurationData config, int? smallControllerID, int? bigControllerID)
    {
        // Check if workstation exists
        var checkSql = "SELECT COUNT(*) FROM TFC_Weighup_WorkStations2 WHERE WorkstationName = @WorkstationName";

        using var checkCmd = new SqlCommand(checkSql, connection, transaction);
        checkCmd.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);

        var exists = (int)checkCmd.ExecuteScalar() > 0;

        if (exists)
        {
            // UPDATE existing workstation
            var updateSql = @"
                UPDATE TFC_Weighup_WorkStations2
                SET ControllerID_Small = @ControllerID_Small,
                    ControllerID_Big = @ControllerID_Big,
                    DefaultScale = @DefaultScale,
                    DualScaleEnabled = @DualScaleEnabled,
                    WorkstationIP = @WorkstationIP,
                    User1 = @User1,
                    User2 = @User2,
                    User6 = GETDATE()
                WHERE WorkstationName = @WorkstationName";

            using var updateCmd = new SqlCommand(updateSql, connection, transaction);
            updateCmd.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);
            updateCmd.Parameters.AddWithValue("@ControllerID_Small", smallControllerID ?? (object)DBNull.Value);
            updateCmd.Parameters.AddWithValue("@ControllerID_Big", bigControllerID ?? (object)DBNull.Value);
            updateCmd.Parameters.AddWithValue("@DefaultScale", config.DefaultScale);
            updateCmd.Parameters.AddWithValue("@DualScaleEnabled", config.ScaleMode == ScaleMode.Dual);
            updateCmd.Parameters.AddWithValue("@WorkstationIP", config.WorkstationIP);
            updateCmd.Parameters.AddWithValue("@User1", "Updated by wizard");
            updateCmd.Parameters.AddWithValue("@User2", $"Mode: {config.ScaleMode}");
            updateCmd.ExecuteNonQuery();
        }
        else
        {
            // INSERT new workstation
            var insertSql = @"
                INSERT INTO TFC_Weighup_WorkStations2
                (WorkstationName, ControllerID_Small, ControllerID_Big, DefaultScale, DualScaleEnabled,
                 WorkstationIP, User1, User2, User6)
                VALUES
                (@WorkstationName, @ControllerID_Small, @ControllerID_Big, @DefaultScale, @DualScaleEnabled,
                 @WorkstationIP, @User1, @User2, GETDATE())";

            using var insertCmd = new SqlCommand(insertSql, connection, transaction);
            insertCmd.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);
            insertCmd.Parameters.AddWithValue("@ControllerID_Small", smallControllerID ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@ControllerID_Big", bigControllerID ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@DefaultScale", config.DefaultScale);
            insertCmd.Parameters.AddWithValue("@DualScaleEnabled", config.ScaleMode == ScaleMode.Dual);
            insertCmd.Parameters.AddWithValue("@WorkstationIP", config.WorkstationIP);
            insertCmd.Parameters.AddWithValue("@User1", "Created by wizard");
            insertCmd.Parameters.AddWithValue("@User2", $"Mode: {config.ScaleMode}");
            insertCmd.ExecuteNonQuery();
        }
    }

    /// <summary>
    /// Remove workstation and controller records from database during uninstallation
    /// </summary>
    public static void UnregisterWorkstation(ConfigurationData config)
    {
        var connectionString = BuildConnectionString(config);

        using var connection = new SqlConnection(connectionString);
        connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // Step 1: Get controller IDs for this workstation
            var getControllersSql = @"
                SELECT ControllerID_Small, ControllerID_Big
                FROM TFC_Weighup_WorkStations2
                WHERE WorkstationName = @WorkstationName";

            int? smallControllerID = null;
            int? bigControllerID = null;

            using (var getCmd = new SqlCommand(getControllersSql, connection, transaction))
            {
                getCmd.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);
                using var reader = getCmd.ExecuteReader();
                if (reader.Read())
                {
                    if (!reader.IsDBNull(0))
                        smallControllerID = reader.GetInt32(0);
                    if (!reader.IsDBNull(1))
                        bigControllerID = reader.GetInt32(1);
                }
            }

            // Step 2: Delete workstation record
            var deleteWorkstationSql = @"
                DELETE FROM TFC_Weighup_WorkStations2
                WHERE WorkstationName = @WorkstationName";

            using (var deleteWsCmd = new SqlCommand(deleteWorkstationSql, connection, transaction))
            {
                deleteWsCmd.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);
                deleteWsCmd.ExecuteNonQuery();
            }

            // Step 3: Delete controller records (only if they exist)
            if (smallControllerID.HasValue)
            {
                DeleteController(connection, transaction, smallControllerID.Value);
            }

            if (bigControllerID.HasValue)
            {
                DeleteController(connection, transaction, bigControllerID.Value);
            }

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private static void DeleteController(SqlConnection connection, SqlTransaction transaction, int controllerID)
    {
        var deleteSql = @"
            DELETE FROM TFC_Weighup_Controllers2
            WHERE ControllerID = @ControllerID";

        using var deleteCmd = new SqlCommand(deleteSql, connection, transaction);
        deleteCmd.Parameters.AddWithValue("@ControllerID", controllerID);
        deleteCmd.ExecuteNonQuery();
    }

    private static string BuildConnectionString(ConfigurationData config)
    {
        return $"Server={config.DatabaseServer},{config.DatabasePort};" +
               $"Database={config.DatabaseName};" +
               $"User Id={config.DatabaseUsername};" +
               $"Password={config.DatabasePassword};" +
               $"TrustServerCertificate=True;" +
               $"Connection Timeout={config.ConnectionTimeout}";
    }

    /// <summary>
    /// Load existing configuration from database for this workstation
    /// </summary>
    public static bool TryLoadExistingConfiguration(ConfigurationData config)
    {
        try
        {
            using var connection = new SqlConnection(BuildConnectionString(config));
            connection.Open();

            const string query = @"
                SELECT
                    ws.WorkstationName,
                    ws.WorkstationIP,
                    ws.DualScaleEnabled,
                    ws.DefaultScale,

                    -- SMALL scale
                    c_small.ControllerID AS SmallControllerID,
                    c_small.PortName AS SmallPortName,
                    c_small.BaudRate AS SmallBaudRate,
                    c_small.ControllerModel AS SmallModel,

                    -- BIG scale
                    c_big.ControllerID AS BigControllerID,
                    c_big.PortName AS BigPortName,
                    c_big.BaudRate AS BigBaudRate,
                    c_big.ControllerModel AS BigModel

                FROM TFC_Weighup_WorkStations2 ws
                LEFT JOIN TFC_Weighup_Controllers2 c_small
                    ON c_small.ControllerID = ws.ControllerID_Small
                LEFT JOIN TFC_Weighup_Controllers2 c_big
                    ON c_big.ControllerID = ws.ControllerID_Big
                WHERE ws.WorkstationName = @WorkstationName";

            using var command = new SqlCommand(query, connection);
            command.Parameters.AddWithValue("@WorkstationName", config.WorkstationName);

            using var reader = command.ExecuteReader();

            if (reader.Read())
            {
                // Workstation found - load configuration
                config.WorkstationIP = reader["WorkstationIP"] as string ?? string.Empty;
                config.ScaleMode = reader["DualScaleEnabled"] as bool? == true ? ScaleMode.Dual : ScaleMode.Single;
                config.DefaultScale = reader["DefaultScale"] as string ?? "BIG";

                // Load SMALL scale if exists
                if (reader["SmallControllerID"] != DBNull.Value)
                {
                    config.SmallScale = new ScaleConfig
                    {
                        Enabled = true,
                        ScaleType = "SMALL",
                        ScaleId = "small",
                        PortName = reader["SmallPortName"] as string ?? string.Empty,
                        BaudRate = int.TryParse(reader["SmallBaudRate"]?.ToString(), out var smallBaud) ? smallBaud : 9600,
                        Model = reader["SmallModel"] as string ?? string.Empty
                    };
                }

                // Load BIG scale if exists
                if (reader["BigControllerID"] != DBNull.Value)
                {
                    config.BigScale = new ScaleConfig
                    {
                        Enabled = true,
                        ScaleType = "BIG",
                        ScaleId = "big",
                        PortName = reader["BigPortName"] as string ?? string.Empty,
                        BaudRate = int.TryParse(reader["BigBaudRate"]?.ToString(), out var bigBaud) ? bigBaud : 9600,
                        Model = reader["BigModel"] as string ?? string.Empty
                    };
                }

                return true; // Configuration loaded successfully
            }

            return false; // Workstation not found in database
        }
        catch
        {
            return false; // Failed to load configuration
        }
    }
}
