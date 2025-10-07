-- Unpick Phase 4: Decrement Inventory Commitment
-- Decrement QtyCommitSales in LotMaster to release committed inventory

-- Parameters (Tiberius format):
-- @P1: LotNo (VARCHAR) - Lot number
-- @P2: ItemKey (VARCHAR) - Item SKU
-- @P3: LocationKey (VARCHAR) - Location (always 'TFC1')
-- @P4: BinNo (NVARCHAR) - Bin number
-- @P5: QtyToRelease (FLOAT) - Quantity to release (original picked weight)

UPDATE LotMaster
SET
    QtyCommitSales = QtyCommitSales - @P5  -- Decrement by original picked weight
WHERE
    LotNo = @P1
    AND ItemKey = @P2
    AND LocationKey = @P3
    AND BinNo = @P4;

-- CRITICAL: All 4 composite keys (LotNo, ItemKey, LocationKey, BinNo) MUST be in WHERE clause
-- CRITICAL: Use -= operator to decrement, not direct assignment
-- CRITICAL: QtyCommitSales must remain >= 0 after update

-- Business rules:
-- - Reverses Phase 4 of picking transaction
-- - Releases inventory for FEFO allocation to other picks
-- - QtyToRelease should equal original picked weight from Cust_PartialLotPicked

-- Validation checks (application layer):
-- 1. QtyCommitSales >= QtyToRelease before update (prevent negative)
-- 2. Row exists in LotMaster (bin/lot combination valid)
-- 3. QtyToRelease > 0 (cannot release negative or zero qty)

-- Error scenarios:
-- - If QtyCommitSales < QtyToRelease: Inventory already released or data inconsistency
-- - If no rows affected: Lot/bin combination not found (data integrity issue)
-- - If QtyCommitSales becomes negative: Database constraint violation

-- Recovery from errors:
-- - Log discrepancy with lot, bin, and quantity details
-- - Create manual adjustment record in LotTransaction
-- - Notify warehouse manager for physical inventory check

-- Expected state after unpick Phase 4:
-- - Available Qty = QtyOnHand - QtyCommitSales (increases by QtyToRelease)
-- - Lot becomes available for FEFO selection again
-- - Inventory accuracy maintained

-- Performance note: Index on (LotNo, ItemKey, LocationKey, BinNo)
-- Expected execution time: <5ms
-- Expected rows affected: 1 (exactly one lot/bin combination)

-- Example:
-- Before: QtyOnHand = 100 KG, QtyCommitSales = 20 KG, Available = 80 KG
-- Unpick 15 KG: QtyCommitSales = 20 - 15 = 5 KG
-- After: QtyOnHand = 100 KG, QtyCommitSales = 5 KG, Available = 95 KG
