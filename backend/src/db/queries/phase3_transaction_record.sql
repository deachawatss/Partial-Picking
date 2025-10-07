-- Phase 3: Transaction Recording
-- Insert audit record into LotTransaction for picking operation

-- PREREQUISITE: Get LotTranNo from sequence using get_next_sequence.sql
-- The sequence number MUST be obtained BEFORE this INSERT

-- Parameters (Tiberius format):
-- @P1: LotTranNo (INT) - Sequence number from PT sequence
-- @P2: LotNo (VARCHAR) - Lot number being picked
-- @P3: ItemKey (VARCHAR) - Item SKU
-- @P4: LocationKey (VARCHAR) - Location (always 'TFC1')
-- @P5: DateReceived (DATETIME) - Lot received date (NULL for picking)
-- @P6: DateExpiry (DATETIME) - Lot expiry date
-- @P7: BinNo (NVARCHAR) - Source bin number
-- @P8: QtyIssued (FLOAT) - Picked weight from scale
-- @P9: IssueDocNo (VARCHAR) - BatchNo
-- @P10: IssueDocLineNo (SMALLINT) - LineId
-- @P11: RecUserid (VARCHAR) - Workstation ID (e.g., 'WS3')

INSERT INTO LotTransaction (
    LotTranNo,
    LotNo,
    ItemKey,
    LocationKey,
    DateReceived,
    DateExpiry,
    TransactionType,
    ReceiptDocNo,
    ReceiptDocLineNo,
    QtyReceived,
    Vendorkey,
    VendorlotNo,
    IssueDocNo,
    IssueDocLineNo,
    IssueDate,
    QtyIssued,
    CustomerKey,
    RecUserid,
    RecDate,
    Processed,
    TempQty,
    QtyForLotAssignment,
    BinNo,
    QtyUsed,
    DateQuarantine,
    User1,
    User2,
    User3,
    User4,
    User5,
    User6,
    User7,
    User8,
    User9,
    User10,
    User11,
    User12,
    ESG_REASON,
    ESG_APPROVER,
    CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5,
    CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10
)
VALUES (
    @P1,  -- LotTranNo (from sequence - CRITICAL: must be unique)
    @P2,  -- LotNo
    @P3,  -- ItemKey
    @P4,  -- LocationKey (TFC1)
    NULL, -- DateReceived (NULL for picking operations)
    @P6,  -- DateExpiry
    5,    -- TransactionType (5 = Issue/Picking - FIXED VALUE)
    '',   -- ReceiptDocNo (empty for picking)
    0,    -- ReceiptDocLineNo (0 for picking)
    0,    -- QtyReceived (0 for picking - this is an issue, not receipt)
    '',   -- Vendorkey (empty for picking)
    '',   -- VendorlotNo (empty for picking)
    @P9,  -- IssueDocNo (BatchNo from cust_PartialPicked)
    @P10, -- IssueDocLineNo (LineId from cust_PartialPicked)
    GETDATE(), -- IssueDate (picking timestamp)
    @P8,  -- QtyIssued (actual weight from scale)
    '',   -- CustomerKey (empty for internal production)
    @P11, -- RecUserid (workstation ID)
    GETDATE(), -- RecDate
    'N',  -- Processed (not yet processed by inventory system)
    0,    -- TempQty (unused)
    0,    -- QtyForLotAssignment (unused)
    @P7,  -- BinNo (source bin)
    0,    -- QtyUsed (unused)
    NULL, -- DateQuarantine (NULL - not quarantined)
    '',   -- User1 (custom field - empty)
    '',   -- User2
    '',   -- User3
    '',   -- User4
    'Picking Customization', -- User5 (system marker - FIXED VALUE)
    NULL, -- User6 (datetime custom field)
    0,    -- User7 (float custom field)
    0,    -- User8
    0,    -- User9 (decimal custom field)
    0,    -- User10
    0,    -- User11 (int custom field)
    0,    -- User12
    '',   -- ESG_REASON
    '',   -- ESG_APPROVER
    0, 0, 0, 0, 0, -- CUSTOM1-10 (bit flags - all false)
    0, 0, 0, 0, 0
);

-- APPEND-ONLY TABLE: Never DELETE from LotTransaction (audit trail)
-- On unpick: Insert new transaction with negative QtyIssued to reverse

-- Performance note: Ensure index exists on (LotTranNo)
-- Expected execution time: <10ms
-- Expected rows affected: 1
