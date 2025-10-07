-- bin_filtering.sql
-- Filter TFC1 PARTIAL bins (project scope: 511 bins)
--
-- Parameters:
--   None
--
-- Returns:
--   - Location: Warehouse location (always 'TFC1')
--   - BinNo: Bin identifier
--   - Description: Bin description
--
-- Constitutional Compliance:
--   ✅ Location = 'TFC1' (TFC warehouse)
--   ✅ User1 = 'WHTFC1' (warehouse identifier)
--   ✅ User4 = 'PARTIAL' (bin type - partial picking area)
--   ✅ Expected result: 511 bins
--
-- IMPORTANT: All 3 filter criteria MUST be met.
-- Other locations (WHSCG, WHTIP8) and bulk bins (User4=NULL) are EXCLUDED.

SELECT
    Location,
    BinNo,
    Description
FROM BINMaster
WHERE Location = 'TFC1'
  AND User1 = 'WHTFC1'
  AND User4 = 'PARTIAL'
ORDER BY BinNo ASC;
