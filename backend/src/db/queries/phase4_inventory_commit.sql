-- Phase 4: Inventory Commitment
-- Increment QtyCommitSales in LotMaster to reflect committed inventory

-- Parameters (Tiberius format):
-- @P1: LotNo (VARCHAR) - Lot number
-- @P2: ItemKey (VARCHAR) - Item SKU
-- @P3: LocationKey (VARCHAR) - Location (always 'TFC1')
-- @P4: BinNo (NVARCHAR) - Bin number
-- @P5: QtyIssued (FLOAT) - Picked weight to commit

UPDATE LotMaster
SET
    QtyCommitSales = QtyCommitSales + @P5  -- Increment by picked weight
WHERE
    LotNo = @P1
    AND ItemKey = @P2
    AND LocationKey = @P3
    AND BinNo = @P4;

-- CRITICAL: All 4 composite keys (LotNo, ItemKey, LocationKey, BinNo) MUST be in WHERE clause
-- CRITICAL: Use += operator to increment, not direct assignment
-- CRITICAL: QtyCommitSales must remain >= 0 after update

-- Business rules:
-- - QtyCommitSales tracks inventory committed for picking/sales
-- - Available Qty = QtyOnHand - QtyCommitSales
-- - This phase ensures accurate inventory availability for FEFO

-- On unpick: QtyCommitSales will be decremented by same amount
-- Validation: After update, QtyCommitSales should be <= QtyOnHand

-- Performance note: Ensure index exists on (LotNo, ItemKey, LocationKey, BinNo)
-- Expected execution time: <5ms
-- Expected rows affected: 1 (exactly one lot/bin combination)
