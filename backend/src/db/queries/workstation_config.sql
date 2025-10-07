-- workstation_config.sql
-- Get active workstation configuration with scale assignments
--
-- Parameters:
--   None
--
-- Returns:
--   - WorkstationName: Display name (WS1-WS4)
--   - ControllerID_Small: Small scale controller ID
--   - ControllerID_Big: Big scale controller ID
--   - DualScaleEnabled: Dual scale feature flag
--   - IsActive: Workstation active status
--
-- Constitutional Compliance:
--   ✅ Returns only active workstations
--   ✅ Each workstation has 2 scales (1 SMALL, 1 BIG)
--   ✅ Frontend uses controller IDs for WebSocket endpoints

SELECT
    WorkstationName,
    ControllerID_Small,
    ControllerID_Big,
    DualScaleEnabled,
    IsActive
FROM TFC_Weighup_WorkStations2
WHERE IsActive = 1
ORDER BY WorkstationName ASC;
