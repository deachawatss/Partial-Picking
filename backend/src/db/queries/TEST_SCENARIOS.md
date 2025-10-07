# SQL Query Test Scenarios

**Purpose**: Integration test scenarios for Backend Engineer to validate SQL queries
**Database**: TFCPILOT3 @ 192.168.0.86:49381
**Test Data**: Production runs 213972, 213989, 6000037

---

## Test Scenario 1: FEFO Lot Selection

**Objective**: Verify FEFO returns earliest expiring lot with sufficient quantity

**Query**: `fefo_lot_selection.sql`

**Test Case 1A: Single lot has sufficient quantity**
```sql
-- Parameters
DECLARE @ItemKey VARCHAR(50) = 'INSALT02';
DECLARE @TargetQty FLOAT = 15.0;

-- Execute query
SELECT TOP 1
    LotNo, BinNo, DateExpiry, QtyOnHand, QtyCommitSales,
    (QtyOnHand - QtyCommitSales) AS AvailableQty
FROM LotMaster
WHERE ItemKey = @ItemKey
  AND LocationKey = 'TFC1'
  AND (QtyOnHand - QtyCommitSales) >= @TargetQty
  AND LotStatus IN ('P', 'C', '', NULL)
  AND BinNo IN (SELECT BinNo FROM BINMaster WHERE Location = 'TFC1' AND User1 = 'WHTFC1' AND User4 = 'PARTIAL')
ORDER BY DateExpiry ASC, LocationKey ASC;
```

**Expected Result**:
- Returns 1 row
- `LotNo`: '2510403-1' (or earliest expiring lot)
- `DateExpiry`: Earliest date among all available lots
- `AvailableQty >= 15.0`
- `BinNo`: In PARTIAL bins (e.g., 'PWBB-12')

**Validation**:
```rust
assert_eq!(result.len(), 1);
assert!(result[0].available_qty >= 15.0);
assert!(result[0].bin_no.starts_with("PW") || result[0].bin_no.starts_with("K0"));
```

**Test Case 1B: No lot has sufficient quantity (multi-lot required)**
```sql
DECLARE @ItemKey VARCHAR(50) = 'INSALT02';
DECLARE @TargetQty FLOAT = 5000.0;  -- Unrealistically high

-- Same query as above
```

**Expected Result**:
- Returns 0 rows
- Application should query again without qty filter and allocate from multiple lots

---

## Test Scenario 2: Weight Tolerance Validation

**Objective**: Verify tolerance range calculation and "Add Lot" button logic

**Query**: `weight_tolerance_validation.sql`

**Test Case 2A: Weight within tolerance**
```sql
-- Parameters
DECLARE @RunNo INT = 213972;
DECLARE @RowNum INT = 1;
DECLARE @LineId INT = 4;

-- Execute query
SELECT
    cpp.ToPickedPartialQty AS TargetWeight,
    im.User9 AS ToleranceKG,
    (cpp.ToPickedPartialQty - ISNULL(im.User9, 0)) AS WeightRangeLow,
    (cpp.ToPickedPartialQty + ISNULL(im.User9, 0)) AS WeightRangeHigh,
    cpp.PickedPartialQty AS CurrentPickedWeight
FROM cust_PartialPicked cpp
INNER JOIN INMAST im ON cpp.ItemKey = im.ItemKey
WHERE cpp.RunNo = @RunNo AND cpp.RowNum = @RowNum AND cpp.LineId = @LineId;
```

**Expected Result**:
- `TargetWeight`: 20.0
- `ToleranceKG`: 0.025
- `WeightRangeLow`: 19.975
- `WeightRangeHigh`: 20.025
- `CurrentPickedWeight`: 20.0 (WITHIN RANGE)

**Validation**:
```rust
let in_tolerance = result.current_picked_weight >= result.weight_range_low
    && result.current_picked_weight <= result.weight_range_high;
assert!(in_tolerance, "Weight must be within tolerance to enable Add Lot button");
```

**Test Case 2B: Weight outside tolerance (too heavy)**
```sql
-- Simulate scale showing 20.5 KG (outside tolerance of ±0.025)
-- Expected: WeightRangeLow=19.975, WeightRangeHigh=20.025, CurrentWeight=20.5
-- Result: 20.5 > 20.025 → "Add Lot" button DISABLED
```

---

## Test Scenario 3: Item Already Picked Check

**Objective**: Prevent double-picking same item

**Query**: `item_already_picked.sql`

**Test Case 3A: Item currently picked**
```sql
DECLARE @RunNo INT = 213972;
DECLARE @RowNum INT = 1;
DECLARE @LineId INT = 4;

SELECT
    PickedPartialQty,
    ItemBatchStatus,
    CASE WHEN PickedPartialQty > 0 THEN 1 ELSE 0 END AS IsPicked
FROM cust_PartialPicked
WHERE RunNo = @RunNo AND RowNum = @RowNum AND LineId = @LineId;
```

**Expected Result**:
- `PickedPartialQty`: 20.0
- `ItemBatchStatus`: 'Allocated'
- `IsPicked`: 1

**Validation**:
```rust
if result.is_picked {
    return Err("Item already picked. Unpick first to pick again.");
}
```

**Test Case 3B: Item unpicked (audit trail preserved)**
```sql
-- After unpick operation
-- PickedPartialQty: 0
-- ItemBatchStatus: 'Allocated' (PRESERVED)
-- WasUnpicked: 1
```

---

## Test Scenario 4: Sequence Generation

**Objective**: Verify atomic sequence increment

**Query**: `get_next_sequence.sql`

**Test Case 4A: Get next PT sequence**
```sql
-- Before: SeqNum = 623956
UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = 'PT';
SELECT SeqNum FROM Seqnum WHERE SeqName = 'PT';
-- After: SeqNum = 623957
```

**Expected Result**:
- `SeqNum`: Current value + 1 (e.g., 623957)

**Validation**:
```rust
let seq1 = get_next_sequence(&mut tx, "PT").await?;
let seq2 = get_next_sequence(&mut tx, "PT").await?;
assert_eq!(seq2, seq1 + 1, "Sequence must increment by 1");
```

**Test Case 4B: Concurrent sequence generation (race condition test)**
```rust
// Spawn 10 concurrent transactions
let mut handles = vec![];
for _ in 0..10 {
    let handle = tokio::spawn(async {
        let mut tx = pool.begin().await?;
        let seq = get_next_sequence(&mut tx, "PT").await?;
        tx.commit().await?;
        Ok(seq)
    });
    handles.push(handle);
}

// Verify all sequences are unique and sequential
let sequences: Vec<i32> = futures::future::join_all(handles).await
    .into_iter().collect::<Result<Vec<_>>>()?;
sequences.sort();
for i in 1..sequences.len() {
    assert_eq!(sequences[i], sequences[i-1] + 1, "No sequence gaps allowed");
}
```

---

## Test Scenario 5: 4-Phase Atomic Transaction (Happy Path)

**Objective**: Execute complete picking workflow and verify all 4 phases commit atomically

**Test Setup**:
```rust
let request = SavePickRequest {
    run_no: 213972,
    row_num: 1,
    line_id: 99,  // Use high number to avoid conflicts
    batch_no: "TEST-BATCH".to_string(),
    item_key: "INSALT02".to_string(),
    target_qty: 15.0,
    picked_weight: 15.02,  // Within tolerance (±0.025)
    workstation_id: "WS-TEST".to_string(),
};
```

**Execution**:
```rust
let mut tx = pool.begin().await?;

// Get sequence
let lot_tran_no = get_next_sequence(&mut tx, "PT").await?;

// FEFO selection
let lot = query_file_as!(Lot, "queries/fefo_lot_selection.sql", request.item_key, request.target_qty)
    .fetch_one(&mut tx).await?;

// Phase 1: Lot allocation
query_file!("queries/phase1_lot_allocation.sql",
    lot_tran_no, request.run_no, request.row_num, request.line_id,
    request.batch_no, lot.lot_no, request.item_key, "TFC1",
    lot.bin_no, lot.date_received, lot.date_expiry, request.picked_weight,
    request.workstation_id, request.batch_no, request.line_id
).execute(&mut tx).await?;

// Phase 2: Weight update
query_file!("queries/phase2_weight_update.sql",
    request.run_no, request.row_num, request.line_id,
    request.picked_weight, request.workstation_id
).execute(&mut tx).await?;

// Phase 3: Transaction record
query_file!("queries/phase3_transaction_record.sql",
    lot_tran_no, lot.lot_no, request.item_key, "TFC1",
    lot.date_received, lot.date_expiry, lot.bin_no,
    request.picked_weight, request.batch_no, request.line_id,
    request.workstation_id
).execute(&mut tx).await?;

// Phase 4: Inventory commit
query_file!("queries/phase4_inventory_commit.sql",
    lot.lot_no, request.item_key, "TFC1", lot.bin_no,
    request.picked_weight
).execute(&mut tx).await?;

tx.commit().await?;
```

**Validation Queries**:
```sql
-- Verify Phase 1: Cust_PartialLotPicked record exists
SELECT COUNT(*) FROM Cust_PartialLotPicked
WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected: 1

-- Verify Phase 2: cust_PartialPicked updated
SELECT PickedPartialQty, ItemBatchStatus FROM cust_PartialPicked
WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected: PickedPartialQty=15.02, ItemBatchStatus='Allocated'

-- Verify Phase 3: LotTransaction created
SELECT COUNT(*) FROM LotTransaction
WHERE IssueDocNo = 'TEST-BATCH' AND IssueDocLineNo = 99 AND TransactionType = 5;
-- Expected: 1

-- Verify Phase 4: LotMaster.QtyCommitSales incremented
-- (Compare before/after values)
```

---

## Test Scenario 6: Rollback on Phase 3 Failure

**Objective**: Verify atomicity - if Phase 3 fails, Phases 1-2 must rollback

**Test Setup**:
```rust
// Inject error in Phase 3 by providing invalid data
let invalid_lot_tran_no = -1;  // Invalid (negative)
```

**Execution**:
```rust
let mut tx = pool.begin().await?;

// Phases 1-2 succeed
// ...

// Phase 3: Intentional failure
let result = query_file!("queries/phase3_transaction_record.sql",
    invalid_lot_tran_no,  // INVALID
    // ... other params
).execute(&mut tx).await;

assert!(result.is_err(), "Phase 3 should fail with invalid LotTranNo");

// DO NOT COMMIT - transaction will rollback
drop(tx);  // Explicit rollback
```

**Validation**:
```sql
-- Verify rollback: No records created in any table
SELECT COUNT(*) FROM Cust_PartialLotPicked WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected: 0

SELECT COUNT(*) FROM LotTransaction WHERE IssueDocNo = 'TEST-BATCH' AND IssueDocLineNo = 99;
-- Expected: 0

SELECT PickedPartialQty FROM cust_PartialPicked WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected: 0 (unchanged from before transaction)
```

---

## Test Scenario 7: Unpick Operation (Audit Trail Preservation)

**Objective**: Verify unpick preserves audit metadata

**Test Setup**:
```sql
-- Initial state after picking
-- PickedPartialQty: 15.02
-- ItemBatchStatus: 'Allocated'
-- PickingDate: 2025-10-07 10:30:00
-- ModifiedBy: 'WS3'
```

**Execution**:
```rust
let mut tx = pool.begin().await?;

// Get original lot allocation
let lot_alloc = query!(
    "SELECT LotNo, ItemKey, LocationKey, BinNo, QtyIssued
     FROM Cust_PartialLotPicked
     WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3",
    request.run_no, request.row_num, request.line_id
).fetch_one(&mut tx).await?;

// Unpick Phase 1: Reset weight
query_file!("queries/unpick_phase1_reset_weight.sql",
    request.run_no, request.row_num, request.line_id,
    "WS-TEST"
).execute(&mut tx).await?;

// Unpick Phase 2: Delete lot allocation
query_file!("queries/unpick_phase2_delete_lot_allocation.sql",
    request.run_no, request.row_num, request.line_id
).execute(&mut tx).await?;

// Unpick Phase 3: Reversal transaction (NOT DELETE)
let new_lot_tran_no = get_next_sequence(&mut tx, "PT").await?;
query!(
    "INSERT INTO LotTransaction (..., QtyIssued, User5, ...)
     VALUES (..., @QtyIssued, 'Picking Customization - UNPICK', ...)",
    -lot_alloc.qty_issued  // NEGATIVE
).execute(&mut tx).await?;

// Unpick Phase 4: Decrement commit
query_file!("queries/unpick_phase4_decrement_commit.sql",
    lot_alloc.lot_no, lot_alloc.item_key, lot_alloc.location_key,
    lot_alloc.bin_no, lot_alloc.qty_issued
).execute(&mut tx).await?;

tx.commit().await?;
```

**Validation**:
```sql
-- Verify audit trail preserved
SELECT PickedPartialQty, ItemBatchStatus, PickingDate, ModifiedBy
FROM cust_PartialPicked
WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected:
-- PickedPartialQty: 0 (RESET)
-- ItemBatchStatus: 'Allocated' (PRESERVED)
-- PickingDate: 2025-10-07 10:30:00 (PRESERVED - original timestamp)
-- ModifiedBy: 'WS-TEST' (UPDATED - who performed unpick)

-- Verify lot allocation deleted
SELECT COUNT(*) FROM Cust_PartialLotPicked
WHERE RunNo = 213972 AND RowNum = 1 AND LineId = 99;
-- Expected: 0

-- Verify reversal transaction created (NOT deleted)
SELECT QtyIssued, User5 FROM LotTransaction
WHERE IssueDocNo = 'TEST-BATCH' AND IssueDocLineNo = 99
ORDER BY LotTranNo DESC;
-- Expected: 2 rows
-- Row 1: QtyIssued = 15.02, User5 = 'Picking Customization'
-- Row 2: QtyIssued = -15.02, User5 = 'Picking Customization - UNPICK'

-- Verify inventory commitment released
SELECT QtyCommitSales FROM LotMaster
WHERE LotNo = @lot_alloc.lot_no AND ItemKey = @lot_alloc.item_key;
-- Expected: Original value - 15.02
```

---

## Performance Benchmarks

**Test Scenario 8: Load Test (100 concurrent picks)**

```rust
use tokio::time::Instant;

let start = Instant::now();
let mut handles = vec![];

for i in 0..100 {
    let handle = tokio::spawn(async move {
        let request = SavePickRequest {
            run_no: 999999,  // Test run
            row_num: 1,
            line_id: i,  // Unique line per pick
            // ... other fields
        };
        save_pick(request).await
    });
    handles.push(handle);
}

let results = futures::future::join_all(handles).await;
let duration = start.elapsed();

println!("100 picks completed in {:?}", duration);
println!("Average: {:?} per pick", duration / 100);

// Assertions
assert!(duration.as_millis() < 10000, "100 picks must complete in <10s");
assert!(results.iter().all(|r| r.is_ok()), "All picks must succeed");
```

**Expected Results**:
- Total time: <10s
- Average per pick: <100ms
- Success rate: 100%

---

## Cleanup After Testing

```sql
-- Delete test records (RUN AFTER ALL TESTS)
DELETE FROM Cust_PartialLotPicked WHERE RunNo = 213972 AND LineId = 99;
DELETE FROM cust_PartialPicked WHERE RunNo = 213972 AND LineId = 99;
-- LotTransaction is append-only - DO NOT DELETE
-- LotMaster QtyCommitSales should be back to original value after unpick tests
```

---

**Test Execution Order**:
1. Test Scenario 1 (FEFO)
2. Test Scenario 2 (Tolerance)
3. Test Scenario 3 (Already Picked)
4. Test Scenario 4 (Sequence)
5. Test Scenario 5 (4-Phase Happy Path)
6. Test Scenario 6 (Rollback)
7. Test Scenario 7 (Unpick)
8. Test Scenario 8 (Load Test)

**Total Test Time**: ~5 minutes
**Success Criteria**: All 8 scenarios pass with 100% success rate
