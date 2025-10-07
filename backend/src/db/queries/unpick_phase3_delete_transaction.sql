-- Unpick Phase 3: DEPRECATED - Do Not Use
-- LotTransaction is an APPEND-ONLY audit trail table

-- CRITICAL: DO NOT DELETE from LotTransaction
-- Constitutional Requirement #7: Audit Trail Preservation

-- Correct approach for unpick transaction recording:
-- Instead of deleting, INSERT a reversal transaction with negative quantity

-- CORRECT REVERSAL PATTERN (use this instead):
/*
INSERT INTO LotTransaction (
    LotTranNo,      -- Get new sequence number
    LotNo,          -- Same lot as original pick
    ItemKey,
    LocationKey,
    DateReceived,
    DateExpiry,
    TransactionType, -- 5 (same as picking)
    ReceiptDocNo,
    ReceiptDocLineNo,
    QtyReceived,
    Vendorkey,
    VendorlotNo,
    IssueDocNo,     -- Same BatchNo
    IssueDocLineNo, -- Same LineId
    IssueDate,
    QtyIssued,      -- NEGATIVE of original pick (e.g., -20.5 if original was 20.5)
    CustomerKey,
    RecUserid,
    RecDate,
    Processed,
    BinNo,
    User5,          -- 'Picking Customization - UNPICK'
    -- ... other fields same as original
)
VALUES (
    @NewLotTranNo,  -- NEW sequence number from Seqnum
    @OriginalLotNo,
    @ItemKey,
    'TFC1',
    NULL,
    @DateExpiry,
    5,              -- TransactionType 5 (Issue/Picking)
    '',
    0,
    0,
    '', '',
    @BatchNo,
    @LineId,
    GETDATE(),
    -@OriginalQtyIssued,  -- NEGATIVE to reverse
    '',
    @WorkstationId,
    GETDATE(),
    'N',
    @BinNo,
    'Picking Customization - UNPICK',  -- Mark as unpick operation
    -- ... other fields
);
*/

-- Audit trail benefits:
-- 1. Complete history of all picks and unpicks
-- 2. Traceability: Can see who unpicked and when
-- 3. Compliance: Meets food safety audit requirements
-- 4. Debugging: Can trace inventory discrepancies

-- Query to find original transaction for reversal:
/*
SELECT
    LotTranNo,
    LotNo,
    BinNo,
    QtyIssued AS OriginalQty,
    RecUserid AS OriginalWorkstation,
    IssueDate AS OriginalPickDate
FROM LotTransaction
WHERE
    IssueDocNo = @BatchNo
    AND IssueDocLineNo = @LineId
    AND TransactionType = 5
    AND QtyIssued > 0  -- Original pick (positive qty)
ORDER BY LotTranNo DESC;  -- Get most recent pick
*/

-- Parameters for reversal transaction (Tiberius format):
-- @P1: NewLotTranNo (INT) - NEW sequence from get_next_sequence.sql
-- @P2: LotNo (VARCHAR) - From original transaction
-- @P3: ItemKey (VARCHAR) - From original transaction
-- @P4: LocationKey (VARCHAR) - Always 'TFC1'
-- @P5: DateExpiry (DATETIME) - From original transaction
-- @P6: BinNo (NVARCHAR) - From original transaction
-- @P7: OriginalQtyIssued (FLOAT) - From original transaction (will be negated)
-- @P8: BatchNo (VARCHAR) - From cust_PartialPicked
-- @P9: LineId (SMALLINT) - From cust_PartialPicked
-- @P10: RecUserid (VARCHAR) - Workstation ID performing unpick

-- NEVER execute this file - it exists only to document why deletion is wrong
