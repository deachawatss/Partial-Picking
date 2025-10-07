-- batch_items.sql
-- Get batch items with weight range calculation from INMAST tolerance
--
-- Parameters:
--   @P1: RunNo (int) - Production run number
--   @P2: RowNum (int) - Batch number
--
-- Returns:
--   - RunNo, RowNum, LineId: Composite primary key
--   - ItemKey: Item SKU
--   - ItemDescription: From INMAST.ItemDescription
--   - ToPickedPartialQty: Target weight (Total Needed)
--   - PickedPartialQty: Actual picked weight from scale
--   - Tolerance: From INMAST.User9 (absolute KG tolerance)
--   - WeightRangeLow: ToPickedPartialQty - Tolerance
--   - WeightRangeHigh: ToPickedPartialQty + Tolerance
--   - ItemBatchStatus: Picking status (NULL|Allocated)
--   - Allergen: Allergen code (W|'')
--
-- Constitutional Compliance:
--   ✅ Composite key filter (RunNo, RowNum)
--   ✅ Uses PickedPartialQty (NOT PickedPartialQtyKG - always NULL)
--   ✅ JOIN INMAST for description and tolerance (User9)
--   ✅ Weight range calculation for tolerance validation

SELECT
    p.RunNo,
    p.RowNum,
    p.LineId,
    p.ItemKey,
    i.Desc1 AS ItemDescription,
    p.ToPickedPartialQty,
    p.PickedPartialQty,
    p.ItemBatchStatus,
    p.Allergen,
    ISNULL(i.User9, 0) AS Tolerance,
    (p.ToPickedPartialQty - ISNULL(i.User9, 0)) AS WeightRangeLow,
    (p.ToPickedPartialQty + ISNULL(i.User9, 0)) AS WeightRangeHigh,
    (p.ToPickedPartialQty - p.PickedPartialQty) AS RemainingQty
FROM cust_PartialPicked p
LEFT JOIN INMAST i ON p.ItemKey = i.Itemkey
WHERE p.RunNo = @P1
  AND p.RowNum = @P2
ORDER BY p.LineId ASC;
