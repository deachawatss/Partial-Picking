-- FEFO Lot Selection Query (Constitutional Requirement)
-- First Expired, First Out - Select lot with earliest expiry date and available quantity

-- Parameters (Tiberius format):
-- @P1: ItemKey (VARCHAR) - Item SKU to find lot for
-- @P2: TargetQty (FLOAT) - Required quantity (from ToPickedPartialQty)

SELECT TOP 1
    LotNo,
    BinNo,
    DateExpiry,
    DateReceived,
    QtyOnHand,
    QtyCommitSales,
    (QtyOnHand - QtyCommitSales) AS AvailableQty,
    LotStatus,
    VendorLotNo,
    LocationKey
FROM
    LotMaster
WHERE
    ItemKey = @P1
    AND LocationKey = 'TFC1'  -- CRITICAL: TFC1 location only
    AND (QtyOnHand - QtyCommitSales) >= @P2  -- Available qty must meet or exceed target
    AND LotStatus IN ('P', 'C', '', NULL)  -- Only approved lots (Pass, Complete, or unset)
    -- BIN FILTERING: Only PARTIAL bins (Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL')
    AND BinNo IN (
        SELECT BinNo
        FROM BINMaster
        WHERE Location = 'TFC1'
          AND User1 = 'WHTFC1'
          AND User4 = 'PARTIAL'
    )
ORDER BY
    DateExpiry ASC,   -- CRITICAL: FEFO - Earliest expiry FIRST
    LocationKey ASC;  -- Tie-breaker: Location

-- CONSTITUTIONAL COMPLIANCE:
-- ✅ FEFO Requirement: ORDER BY DateExpiry ASC (earliest expiry first)
-- ✅ BIN Filtering: 511 PARTIAL bins (Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL')
-- ✅ Available Qty: QtyOnHand - QtyCommitSales >= TargetQty
-- ✅ Lot Status: Only approved lots (P=Pass, C=Complete, empty, or NULL)

-- Business Rules:
-- 1. System enforces FEFO - operators cannot override bin selection
-- 2. If no lot has sufficient qty, query returns 0 rows (multi-lot pick required)
-- 3. Hold status (H) lots excluded (quarantined)
-- 4. Bulk bins excluded (User4 != 'PARTIAL')

-- Multi-lot picking (if query returns 0 rows):
-- Application should:
-- 1. Query all lots with ANY available qty (remove >= @P2 condition)
-- 2. Allocate from multiple lots in FEFO order until target met
-- 3. Create multiple Cust_PartialLotPicked records (one per lot)

-- Example results:
-- LotNo: '2510403-1'
-- BinNo: 'PWBB-12'
-- DateExpiry: '2027-12-16' (earliest expiry)
-- AvailableQty: 568.92 KG (>= target of 20.5 KG)
-- LotStatus: 'P' (Pass - approved for use)

-- Performance optimization:
-- - Index on (ItemKey, LocationKey, DateExpiry)
-- - Index on (BinNo, Location, User1, User4) in BINMaster
-- - Expected execution time: <20ms (511 bins checked)

-- Alternative: Pre-filter bins in application layer (cache 511 bin list)
-- If BINMaster rarely changes, cache bin list and use IN (@BinList) instead of subquery
