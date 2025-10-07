-- ============================================================================
-- Scenario 7: 4-Phase Atomic Pick Transaction
-- SQL Verification Queries
-- ============================================================================
--
-- These queries verify that all 4 phases of the atomic pick transaction
-- executed successfully. Run these AFTER executing the pick transaction
-- via POST /api/picks endpoint.
--
-- Test Data:
--   RunNo: 213996
--   RowNum: 1
--   LineId: 1
--   LotNo: 2510403-1
--   BinNo: PWBB-12
--   Weight: 20.025 KG
-- ============================================================================

USE TFCPILOT3;
GO

PRINT '============================================================================';
PRINT 'SCENARIO 7: 4-PHASE ATOMIC PICK TRANSACTION VERIFICATION';
PRINT '============================================================================';
PRINT '';

-- ============================================================================
-- Phase 1: Verify Cust_PartialLotPicked record created
-- ============================================================================

PRINT '--- Phase 1: Cust_PartialLotPicked (Lot Allocation) ---';
PRINT '';

SELECT
    RunNo,
    RowNum,
    LineId,
    LotNo,
    BinNo,
    PickedPartialQty AS 'Weight (KG)',
    ItemKey,
    DateCreated
FROM Cust_PartialLotPicked
WHERE RunNo = 213996
  AND RowNum = 1
  AND LineId = 1;

-- Expected Result:
-- ✓ Record exists with LotNo='2510403-1', BinNo='PWBB-12', PickedPartialQty=20.025

PRINT '';
PRINT 'Expected: 1 row with LotNo=2510403-1, BinNo=PWBB-12, PickedPartialQty=20.025';
PRINT '';

-- ============================================================================
-- Phase 2: Verify cust_PartialPicked updated
-- ============================================================================

PRINT '--- Phase 2: cust_PartialPicked (Weight Update) ---';
PRINT '';

SELECT
    RunNo,
    RowNum,
    LineId,
    ItemKey,
    TotalNeeded AS 'Target (KG)',
    PickedPartialQty AS 'Picked (KG)',
    ItemBatchStatus AS 'Status',
    PickingDate AS 'Picked Date',
    ModifiedBy AS 'User ID'
FROM cust_PartialPicked
WHERE RunNo = 213996
  AND RowNum = 1
  AND LineId = 1;

-- Expected Result:
-- ✓ PickedPartialQty = 20.025
-- ✓ ItemBatchStatus = 'Allocated' (or 'P' if completed)
-- ✓ PickingDate is populated
-- ✓ ModifiedBy contains user ID

PRINT '';
PRINT 'Expected: PickedPartialQty=20.025, ItemBatchStatus=Allocated/P, PickingDate populated';
PRINT '';

-- ============================================================================
-- Phase 3: Verify LotTransaction created
-- ============================================================================

PRINT '--- Phase 3: LotTransaction (Transaction Recording) ---';
PRINT '';

-- Find the most recent transaction for this pick
SELECT TOP 1
    LotTranNo,
    ItemKey,
    LotNo,
    BinNo,
    QtyIssued AS 'Qty (KG)',
    TransactionType,
    DocumentNo AS 'Run No',
    User5 AS 'Source',
    DateTransaction AS 'Transaction Date'
FROM LotTransaction
WHERE LotNo = '2510403-1'
  AND ItemKey IN (SELECT ItemKey FROM cust_PartialPicked WHERE RunNo=213996 AND LineId=1)
  AND CAST(DocumentNo AS INT) = 213996
  AND TransactionType = 5
ORDER BY LotTranNo DESC;

-- Expected Result:
-- ✓ TransactionType = 5 (Issue/Picking)
-- ✓ QtyIssued = 20.025
-- ✓ User5 = 'Picking Customization'
-- ✓ DocumentNo = '213996' (as string)

PRINT '';
PRINT 'Expected: TransactionType=5, QtyIssued=20.025, User5=Picking Customization';
PRINT '';

-- ============================================================================
-- Phase 4: Verify LotMaster.QtyCommitSales incremented
-- ============================================================================

PRINT '--- Phase 4: LotMaster (Inventory Commitment) ---';
PRINT '';

SELECT
    LotNo,
    ItemKey,
    BinNo,
    QtyOnHand AS 'On Hand (KG)',
    QtyCommitSales AS 'Committed (KG)',
    (QtyOnHand - QtyCommitSales) AS 'Available (KG)',
    DateExpiry AS 'Expiry Date',
    LotStatus AS 'Status'
FROM LotMaster
WHERE LotNo = '2510403-1'
  AND ItemKey IN (SELECT ItemKey FROM cust_PartialPicked WHERE RunNo=213996 AND LineId=1)
  AND BinNo = 'PWBB-12';

-- Expected Result:
-- ✓ QtyCommitSales increased by 20.025 (compare to before-pick value)
-- ✓ Available = QtyOnHand - QtyCommitSales
-- ✓ LotStatus remains valid ('P', 'C', '', or NULL)

PRINT '';
PRINT 'Expected: QtyCommitSales increased by 20.025 from original value';
PRINT '';

-- ============================================================================
-- AUDIT TRAIL VERIFICATION (Constitutional Requirement #7)
-- ============================================================================

PRINT '--- Audit Trail Verification ---';
PRINT '';

SELECT
    RunNo,
    RowNum,
    LineId,
    ItemKey,
    ItemBatchStatus AS 'Status',
    PickingDate AS 'Picked Date',
    ModifiedBy AS 'User ID',
    PickedPartialQty AS 'Weight (KG)'
FROM cust_PartialPicked
WHERE RunNo = 213996
  AND RowNum = 1
  AND LineId = 1;

-- Constitutional Requirement:
-- ✓ ItemBatchStatus preserved (never set to NULL)
-- ✓ PickingDate preserved (never deleted)
-- ✓ ModifiedBy preserved (never deleted)

PRINT '';
PRINT 'Constitutional Check: ItemBatchStatus, PickingDate, ModifiedBy must never be NULL';
PRINT '';

-- ============================================================================
-- ROLLBACK TEST (Optional - requires separate test transaction)
-- ============================================================================

PRINT '--- Rollback Test (Manual Verification) ---';
PRINT '';
PRINT 'To test rollback:';
PRINT '1. Force an error in Phase 4 (e.g., invalid LotNo in LotMaster update)';
PRINT '2. Verify that ALL 4 phases roll back (no records in any table)';
PRINT '3. Re-run this script - should find 0 rows for all phases';
PRINT '';

-- ============================================================================
-- COMPLETE WORKFLOW VERIFICATION
-- ============================================================================

PRINT '--- Complete Workflow Verification ---';
PRINT '';

-- Check if all phases completed
DECLARE @Phase1Count INT = (SELECT COUNT(*) FROM Cust_PartialLotPicked WHERE RunNo=213996 AND LineId=1);
DECLARE @Phase2Count INT = (SELECT COUNT(*) FROM cust_PartialPicked WHERE RunNo=213996 AND LineId=1 AND PickedPartialQty > 0);
DECLARE @Phase3Count INT = (SELECT COUNT(*) FROM LotTransaction WHERE LotNo='2510403-1' AND CAST(DocumentNo AS INT)=213996 AND TransactionType=5);
DECLARE @Phase4Count INT = (SELECT COUNT(*) FROM LotMaster WHERE LotNo='2510403-1' AND BinNo='PWBB-12' AND QtyCommitSales > 0);

PRINT 'Phase 1 (Cust_PartialLotPicked): ' + CAST(@Phase1Count AS VARCHAR) + ' record(s)';
PRINT 'Phase 2 (cust_PartialPicked):    ' + CAST(@Phase2Count AS VARCHAR) + ' record(s)';
PRINT 'Phase 3 (LotTransaction):        ' + CAST(@Phase3Count AS VARCHAR) + ' record(s)';
PRINT 'Phase 4 (LotMaster updated):     ' + CAST(@Phase4Count AS VARCHAR) + ' record(s)';
PRINT '';

IF @Phase1Count >= 1 AND @Phase2Count >= 1 AND @Phase3Count >= 1 AND @Phase4Count >= 1
BEGIN
    PRINT '✓ SUCCESS: All 4 phases executed successfully';
END
ELSE
BEGIN
    PRINT '✗ FAILURE: One or more phases did not complete';
    PRINT '  Check individual phase queries above for details';
END

PRINT '';
PRINT '============================================================================';
PRINT 'END OF VERIFICATION';
PRINT '============================================================================';
