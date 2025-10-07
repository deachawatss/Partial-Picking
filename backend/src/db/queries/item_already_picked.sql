-- Item Already Picked Validation Query
-- Check if item has already been picked (prevents double-picking)

-- Parameters (Tiberius format):
-- @P1: RunNo (INT) - Production run number
-- @P2: RowNum (INT) - Batch number
-- @P3: LineId (INT) - Line identifier

SELECT
    RunNo,
    RowNum,
    LineId,
    ItemKey,
    ToPickedPartialQty AS TargetWeight,
    PickedPartialQty AS ActualWeight,
    ItemBatchStatus,
    PickingDate,
    ModifiedBy AS PickedByWorkstation,
    -- Calculate if item is currently picked
    CASE
        WHEN PickedPartialQty > 0 THEN 1  -- Currently picked
        ELSE 0                             -- Not picked (or unpicked)
    END AS IsPicked,
    -- Calculate if item was previously picked but unpicked (audit trail preserved)
    CASE
        WHEN PickedPartialQty = 0 AND ItemBatchStatus = 'Allocated' THEN 1  -- Was picked, then unpicked
        ELSE 0
    END AS WasUnpicked
FROM
    cust_PartialPicked
WHERE
    RunNo = @P1
    AND RowNum = @P2
    AND LineId = @P3;

-- CRITICAL: Table name is cust_PartialPicked (lowercase 'c')
-- CRITICAL: Field is PickedPartialQty (NOT PickedPartialQtyKG)
-- CRITICAL: All 3 composite keys required

-- Business logic:
-- 1. IsPicked = 1: Item already picked, must unpick before picking again
-- 2. WasUnpicked = 1: Item was previously picked but unpicked (yellow warning state)
-- 3. Both = 0: Item never picked (normal state, allow picking)

-- Picking workflow states:
-- | PickedPartialQty | ItemBatchStatus | State          | IsPicked | WasUnpicked |
-- |------------------|-----------------|----------------|----------|-------------|
-- | 0                | NULL            | Never picked   | 0        | 0           |
-- | 20.5             | 'Allocated'     | Currently picked| 1        | 0           |
-- | 0                | 'Allocated'     | Unpicked       | 0        | 1           |

-- Frontend validation:
-- - If IsPicked = 1: Show error "Item already picked. Unpick first to pick again."
-- - If WasUnpicked = 1: Show warning banner "Item was previously unpicked"

-- Performance note: Index on (RunNo, RowNum, LineId)
-- Expected execution time: <5ms
-- Expected rows: 1 (or 0 if not found)
