-- Phase 2: Weight Update
-- Update cust_PartialPicked with actual picked weight and set status to Allocated

-- Parameters (Tiberius format):
-- @P1: RunNo (INT) - Production run number
-- @P2: RowNum (INT) - Batch number
-- @P3: LineId (INT) - Line identifier
-- @P4: PickedPartialQty (FLOAT) - Actual weight from scale
-- @P5: ModifiedBy (NVARCHAR) - Workstation ID (e.g., 'WS3')

UPDATE cust_PartialPicked
SET
    PickedPartialQty = @P4,           -- Actual weight from scale
    ItemBatchStatus = 'Allocated',    -- Mark as picked
    PickingDate = GETDATE(),          -- Timestamp when picked
    ModifiedBy = @P5,                 -- Workstation ID
    ModifiedDate = GETDATE()          -- Modification timestamp
WHERE
    RunNo = @P1
    AND RowNum = @P2
    AND LineId = @P3;

-- CRITICAL: All 3 composite keys (RunNo, RowNum, LineId) MUST be in WHERE clause
-- CRITICAL: Table name is cust_PartialPicked (lowercase 'c')
-- CRITICAL: Field is PickedPartialQty (NOT PickedPartialQtyKG - that field is always NULL)
-- CRITICAL: ItemBatchStatus set to 'Allocated' (not NULL)

-- Audit trail preservation:
-- - ItemBatchStatus, PickingDate, ModifiedBy will be preserved on unpick
-- - Only PickedPartialQty will be reset to 0 on unpick

-- Performance note: Ensure index exists on (RunNo, RowNum, LineId)
-- Expected execution time: <5ms
-- Expected rows affected: 1 (exactly one row should be updated)
