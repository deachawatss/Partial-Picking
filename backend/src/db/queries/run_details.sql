-- run_details.sql
-- Get production run details with auto-population fields
--
-- Parameters:
--   @P1: RunNo (int) - Production run number
--
-- Returns:
--   - RunNo: Production run identifier
--   - RowNum: Batch number (multiple rows for multi-batch runs)
--   - FormulaId: FG Item Key (auto-populate to fgItemKey)
--   - FormulaDesc: FG Description (auto-populate to fgDescription)
--   - NoOfBatches: Total batches count (display field)
--   - RecDate: Production date (display field)
--   - Status: Run workflow status (NEW|PRINT)
--
-- Constitutional Compliance:
--   ✅ Composite key usage (RunNo, RowNum)
--   ✅ Auto-population fields identified
--   ✅ Returns all batches for the run

SELECT
    RunNo,
    RowNum,
    FormulaId,          -- Auto-populate to fgItemKey
    FormulaDesc,        -- Auto-populate to fgDescription
    NoOfBatches,        -- Total batches count
    RecDate,            -- Production date
    Status              -- Run status (NEW|PRINT)
FROM Cust_PartialRun
WHERE RunNo = @P1
ORDER BY RowNum ASC;
