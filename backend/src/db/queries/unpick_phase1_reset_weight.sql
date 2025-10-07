-- Unpick Phase 1: Reset Weight (Audit Trail Preserved)
-- Reset PickedPartialQty to 0 while preserving audit metadata

-- Parameters (Tiberius format):
-- @P1: RunNo (INT) - Production run number
-- @P2: RowNum (INT) - Batch number
-- @P3: LineId (INT) - Line identifier
-- @P4: ModifiedBy (NVARCHAR) - Workstation ID performing unpick

UPDATE cust_PartialPicked
SET
    PickedPartialQty = 0,      -- Reset weight to 0
    ModifiedBy = @P4,          -- Update modifier (who performed unpick)
    ModifiedDate = GETDATE()   -- Update modification timestamp
    -- CRITICAL: Do NOT set ItemBatchStatus = NULL
    -- CRITICAL: Do NOT set PickingDate = NULL
    -- CRITICAL: Preserve original PickingDate and ItemBatchStatus for audit trail
WHERE
    RunNo = @P1
    AND RowNum = @P2
    AND LineId = @P3;

-- AUDIT TRAIL PRESERVATION (Constitutional Requirement #7):
-- Fields that MUST be preserved (NOT updated):
-- - ItemBatchStatus (remains 'Allocated' to show item was previously picked)
-- - PickingDate (preserves original picking timestamp)
-- - RecUserId (preserves original creator)
-- - RecDate (preserves original creation date)

-- Fields that ARE updated:
-- - PickedPartialQty (reset to 0 - item no longer picked)
-- - ModifiedBy (workstation ID performing unpick)
-- - ModifiedDate (timestamp of unpick operation)

-- Visual state after unpick:
-- - PickedPartialQty = 0 AND ItemBatchStatus = 'Allocated' → Yellow/warning state
-- - UI shows "Item was previously picked and unpicked"
-- - Allows re-picking without losing history

-- Difference from never-picked state:
-- | State          | PickedPartialQty | ItemBatchStatus | Visual    |
-- |----------------|------------------|-----------------|-----------|
-- | Never picked   | 0                | NULL            | Default   |
-- | Currently picked| 20.5            | 'Allocated'     | Green     |
-- | Unpicked       | 0                | 'Allocated'     | Yellow    |

-- Performance note: Index on (RunNo, RowNum, LineId)
-- Expected execution time: <5ms
-- Expected rows affected: 1
