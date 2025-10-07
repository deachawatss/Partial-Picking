-- Weight Tolerance Validation Query
-- Retrieves target weight and tolerance range for a pick item
-- Used to validate if scale weight is within acceptable range

-- Parameters (Tiberius format):
-- @P1: RunNo (INT) - Production run number
-- @P2: RowNum (INT) - Batch number
-- @P3: LineId (INT) - Line identifier

SELECT
    cpp.ToPickedPartialQty AS TargetWeight,
    cpp.ItemKey,
    cpp.Unit,
    im.User9 AS ToleranceKG,
    -- Calculate tolerance range (absolute KG values)
    (cpp.ToPickedPartialQty - ISNULL(im.User9, 0)) AS WeightRangeLow,
    (cpp.ToPickedPartialQty + ISNULL(im.User9, 0)) AS WeightRangeHigh,
    cpp.PickedPartialQty AS CurrentPickedWeight,
    cpp.ItemBatchStatus,
    im.Description AS ItemDescription
FROM
    cust_PartialPicked cpp
    INNER JOIN INMAST im ON cpp.ItemKey = im.ItemKey
WHERE
    cpp.RunNo = @P1
    AND cpp.RowNum = @P2
    AND cpp.LineId = @P3;

-- CRITICAL: Table name is cust_PartialPicked (lowercase 'c')
-- CRITICAL: Tolerance is in INMAST.User9 (absolute KG values, NOT percentage)
-- CRITICAL: All 3 composite keys required in WHERE clause

-- Business logic:
-- - User9 contains absolute tolerance in KG (e.g., 0.5 means ±0.5 KG)
-- - "Add Lot" button enabled when: WeightRangeLow <= CurrentPickedWeight <= WeightRangeHigh
-- - If User9 is NULL, treat as 0 tolerance (exact weight required)

-- Example results:
-- TargetWeight: 20.4952 KG
-- ToleranceKG: 0.5 KG
-- WeightRangeLow: 19.9952 KG
-- WeightRangeHigh: 20.9952 KG
-- CurrentPickedWeight: 20.5 KG (WITHIN TOLERANCE - enable "Add Lot")

-- Performance note: Index on (cpp.RunNo, cpp.RowNum, cpp.LineId) + (im.ItemKey)
-- Expected execution time: <10ms
-- Expected rows: 1 (or 0 if not found)
