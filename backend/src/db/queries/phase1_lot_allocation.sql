-- Phase 1: Lot Allocation
-- Insert lot allocation record into Cust_PartialLotPicked
-- This records which lot/bin was selected for picking

-- Parameters (Tiberius format):
-- @P1: LotTranNo (INT) - Sequence number from PT sequence
-- @P2: RunNo (INT) - Production run number
-- @P3: RowNum (INT) - Batch number
-- @P4: LineId (INT) - Line identifier
-- @P5: BatchNo (NVARCHAR) - Batch identifier
-- @P6: LotNo (VARCHAR) - Selected lot number (from FEFO query)
-- @P7: ItemKey (VARCHAR) - Item SKU
-- @P8: LocationKey (VARCHAR) - Location (always 'TFC1')
-- @P9: BinNo (NVARCHAR) - Bin number (from FEFO query)
-- @P10: DateReceived (DATETIME) - Lot received date
-- @P11: DateExpiry (DATETIME) - Lot expiry date
-- @P12: QtyIssued (FLOAT) - Picked weight from scale
-- @P13: RecUserid (VARCHAR) - Workstation ID (e.g., 'WS3')
-- @P14: IssueDocNo (VARCHAR) - BatchNo (same as @P5)
-- @P15: IssueDocLineNo (SMALLINT) - LineId (same as @P4)

INSERT INTO Cust_PartialLotPicked (
    LotTranNo,
    RunNo,
    RowNum,
    LineId,
    BatchNo,
    LotNo,
    SuggestedLotNo,
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
    ModifiedBy,
    ModifiedDate,
    Processed,
    TempQty,
    QtyForLotAssignment,
    BinNo,
    QtyUsed,
    DateQuarantine,
    PackSize,
    QtyOnHand,
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
    QtyReceivedKG,
    AllocLotQty,
    LotStatus,
    CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5,
    CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10,
    ESG_REASON,
    ESG_APPROVER
)
VALUES (
    @P1,  -- LotTranNo (from sequence)
    @P2,  -- RunNo
    @P3,  -- RowNum
    @P4,  -- LineId
    @P5,  -- BatchNo
    @P6,  -- LotNo
    @P6,  -- SuggestedLotNo (same as LotNo)
    @P7,  -- ItemKey
    @P8,  -- LocationKey (TFC1)
    @P10, -- DateReceived
    @P11, -- DateExpiry
    5,    -- TransactionType (5 = Issue/Picking - FIXED)
    '',   -- ReceiptDocNo (empty for picking)
    0,    -- ReceiptDocLineNo (0 for picking)
    0,    -- QtyReceived (0 for picking)
    '',   -- Vendorkey (empty for picking)
    '',   -- VendorlotNo (empty for picking)
    @P14, -- IssueDocNo (BatchNo)
    @P15, -- IssueDocLineNo (LineId)
    GETDATE(), -- IssueDate (current timestamp)
    @P12, -- QtyIssued (picked weight from scale)
    '',   -- CustomerKey (empty for internal picking)
    @P13, -- RecUserid (workstation ID)
    GETDATE(), -- RecDate
    @P13, -- ModifiedBy (same as RecUserid)
    GETDATE(), -- ModifiedDate
    'N',  -- Processed (not yet processed by inventory system)
    0,    -- TempQty (unused)
    0,    -- QtyForLotAssignment (unused)
    @P9,  -- BinNo
    0,    -- QtyUsed (unused)
    NULL, -- DateQuarantine (NULL - not quarantined)
    0,    -- PackSize (filled from item master in application)
    0,    -- QtyOnHand (filled from lot master in application)
    '',   -- User1-5 (custom fields - empty)
    '', '', '', '',
    NULL, -- User6 (datetime custom field)
    0, 0, -- User7-8 (float custom fields)
    0, 0, -- User9-10 (decimal custom fields)
    0, 0, -- User11-12 (int custom fields)
    0,    -- QtyReceivedKG (unused for picking)
    @P12, -- AllocLotQty (same as QtyIssued)
    '',   -- LotStatus (empty)
    0, 0, 0, 0, 0, -- CUSTOM1-10 (bit flags - all false)
    0, 0, 0, 0, 0,
    '',   -- ESG_REASON
    ''    -- ESG_APPROVER
);

-- Performance note: Ensure index exists on (LotTranNo, RunNo, RowNum, LineId)
-- Expected execution time: <10ms
