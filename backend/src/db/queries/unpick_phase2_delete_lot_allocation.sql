-- Unpick Phase 2: Delete Lot Allocation Record
-- Remove lot allocation from Cust_PartialLotPicked

-- Parameters (Tiberius format):
-- @P1: RunNo (INT) - Production run number
-- @P2: RowNum (INT) - Batch number
-- @P3: LineId (INT) - Line identifier

DELETE FROM Cust_PartialLotPicked
WHERE
    RunNo = @P1
    AND RowNum = @P2
    AND LineId = @P3;

-- CRITICAL: This deletes the lot allocation record (not the audit transaction)
-- The corresponding LotTransaction record is preserved (append-only audit trail)

-- Business logic:
-- - Cust_PartialLotPicked is a working table (not audit trail)
-- - Represents current lot allocations for active picks
-- - Safe to delete on unpick because:
--   1. Audit trail preserved in LotTransaction (Phase 3 reversal)
--   2. QtyCommitSales decremented in LotMaster (Phase 4 reversal)
--   3. cust_PartialPicked audit metadata preserved (Phase 1)

-- Composite primary key: (LotTranNo, RunNo, RowNum, LineId)
-- WHERE clause uses (RunNo, RowNum, LineId) to match pick item
-- May delete multiple rows if multiple lots were allocated to same item

-- Expected scenarios:
-- - Single lot pick: Deletes 1 row
-- - Multi-lot pick (rare): Deletes N rows
-- - Item never picked: Deletes 0 rows (no error)
-- - Item already unpicked: Deletes 0 rows (idempotent)

-- Performance note: Index on (RunNo, RowNum, LineId)
-- Expected execution time: <10ms
-- Expected rows affected: 0-N (typically 1)
