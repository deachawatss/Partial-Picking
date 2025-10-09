# Picking Flow Documentation - Run 213972
## Real Production Workflow Tracking

**Test Run**: 213972
**Formula**: TB2563E1 (Batter mix)
**Created By**: SURIYAN
**Created Date**: 2025-05-28
**Status**: NEW
**Batches**: 2 (BatchNo: 843855, 843856)

---

## Run Selection & Auto-Population Workflow

**📋 See Also**: [project-brief.md - Run No Search & Auto-Population Workflow](./project-brief.md#run-no-search--auto-population-workflow) for complete implementation guide

### Real Example: Run 6000037 Auto-Population

When the user searches for **Run No 6000037**, the system automatically fills all fields by querying 3 tables:

#### Step 1: Search Run No → Auto-Populate Header
```sql
SELECT
    RunNo,
    FormulaId AS FGItemKey,        -- TSM2285A
    FormulaDesc AS FGDescription,  -- Marinade, Savory
    BatchNo,                        -- 850417
    NoOfBatches AS Batches,         -- 2
    RecDate AS ProductionDate       -- 2025-10-06
FROM Cust_PartialRun
WHERE RunNo = 6000037
ORDER BY RowNum;
```

**Result:**
- Run No = **6000037**
- FG Item Key = **TSM2285A** (from FormulaId)
- FG Description = **Marinade, Savory** (from FormulaDesc)
- Batch No = **850417**
- Batches = **2**
- Production Date = **06/10/25** (from RecDate)

#### Step 2: Select Batch → Auto-Populate Item Details
```sql
SELECT
    cp.ItemKey,                     -- INRICF05
    im.Desc1 AS Description,        -- Rice Flour (RF-0010)
    cp.ToPickedPartialQty,          -- 14.2400 (Total Needed)
    ISNULL(cp.PickedPartialQty, 0), -- 0.0000 (Picked Qty)
    (cp.ToPickedPartialQty - ISNULL(cp.PickedPartialQty, 0)) AS RemainingQty,  -- 14.2400
    im.User9 AS ToleranceKG,        -- 0.025
    (cp.ToPickedPartialQty - im.User9) AS WeightRangeLow,   -- 14.215
    (cp.ToPickedPartialQty + im.User9) AS WeightRangeHigh   -- 14.265
FROM cust_PartialPicked cp
INNER JOIN INMAST im ON cp.ItemKey = im.Itemkey
WHERE cp.RunNo = 6000037
    AND cp.RowNum = 1
ORDER BY cp.LineId;
```

**Result:**
- ItemKey = **INRICF05**
- Description = **Rice Flour (RF-0010)** (from INMAST.Desc1)
- Total Needed = **14.2400** KG
- Remaining Qty = **14.2400** KG (ToPickedPartialQty - PickedPartialQty)
- Weight Range = **14.215000** - **14.265000** KG (±0.025 from INMAST.User9)

#### UI Auto-Population Sequence

1. **User enters Run No** → Press Enter/Search
2. **System queries** Cust_PartialRun → Auto-fills FG Item Key, FG Description, Batches, Production Date
3. **User selects Batch** → Dropdown shows available batches (RowNum 1, 2, ...)
4. **System queries** cust_PartialPicked + INMAST → Auto-fills ItemKey, Description, Weight Range, Total Needed, Remaining Qty
5. **Ready for picking** → User can now scan lot/bin and start weighing

**Key Field Mappings:**

| UI Display | Database Source | Calculation |
|------------|----------------|-------------|
| FG Item Key | Cust_PartialRun.FormulaId | Direct value |
| FG Description | Cust_PartialRun.FormulaDesc | Direct value |
| Production Date | Cust_PartialRun.RecDate | Format as MM/DD/YY |
| Description | INMAST.Desc1 | JOIN on ItemKey |
| Weight Range Low | Calculated | ToPickedPartialQty - INMAST.User9 |
| Weight Range High | Calculated | ToPickedPartialQty + INMAST.User9 |
| Remaining Qty | Calculated | ToPickedPartialQty - ISNULL(PickedPartialQty, 0) |

---

## Current State Snapshot (Before Your Test)

### Run Status Summary

| RowNum | BatchNo | Status | NoOfBatches | PalletsPerBatch |
|--------|---------|--------|-------------|-----------------|
| 1 | 843855 | NEW | 2 | 1 |
| 2 | 843856 | NEW | 2 | 1 |

### Items Status Overview - Batch 1 (843855)

| LineId | ItemKey | Target Qty | Picked Qty | Status | Allergen | Modified By |
|--------|---------|------------|------------|--------|----------|-------------|
| 2 | INBC1404 | 12.2 KG | **0** | ❌ **NOT PICKED** | SU | - |
| 3 | INCORS01 | 14.5 KG | 14.49 KG | ✅ Allocated | SU | WS3 |
| 4 | INSALT02 | 20 KG | 20.01 KG | ✅ Allocated | - | WS3 |
| 5 | INSAPP01 | 7 KG | 7.01 KG | ✅ Allocated | - | WS3 |
| 6 | INSBIC01 | 5 KG | 5.01 KG | ✅ Allocated | - | WS3 |
| 7 | SPPEPWV1 | 5 KG | 5.01 KG | ✅ Allocated | - | WS3 |
| 8 | INGUAR01 | 2 KG | 2 KG | ✅ Allocated | - | WS3 |
| 9 | PCPAP10B | 0.5 KG | 0.5 KG | ✅ Allocated | W | WS3 |
| 10 | IND741R1 | 3.2 KG | 3.2 KG | ✅ Allocated | W | WS3 |

### Items Status Overview - Batch 2 (843856)

| LineId | ItemKey | Target Qty | Picked Qty | Status | Allergen | Modified By |
|--------|---------|------------|------------|--------|----------|-------------|
| 2 | INBC1404 | 12.2 KG | **0** | ❌ **NOT PICKED** | SU | - |
| 3 | INCORS01 | 14.5 KG | 14.5 KG | ✅ Allocated | SU | WS3 |
| 4 | INSALT02 | 20 KG | 20 KG | ✅ Allocated | - | WS3 |
| 5 | INSAPP01 | 7 KG | 7.01 KG | ✅ Allocated | - | WS3 |
| 6 | INSBIC01 | 5 KG | 5 KG | ✅ Allocated | - | WS3 |
| 7 | SPPEPWV1 | 5 KG | 5 KG | ✅ Allocated | - | WS3 |
| 8 | INGUAR01 | 2 KG | 2 KG | ✅ Allocated | - | WS3 |
| 9 | PCPAP10B | 0.5 KG | 0.5 KG | ✅ Allocated | W | WS3 |
| 10 | IND741R1 | 3.2 KG | 3.2 KG | ✅ Allocated | W | WS3 |

### 🔴 Pending Items (NOT YET PICKED)

Both batches are missing the same item:

**INBC1404** (Allergen: SU)
- Batch 1 (LineId 2): Target 12.2 KG - NOT PICKED
- Batch 2 (LineId 2): Target 12.2 KG - NOT PICKED

---

## Lot Allocation Details (Cust_PartialLotPicked)

### Batch 1 (843855) - Allocated Lots

| LotTranNo | LineId | ItemKey | LotNo | BinNo | AllocLotQty | QtyUsed | RecDate |
|-----------|--------|---------|-------|-------|-------------|---------|---------|
| 4324861 | 3 | INCORS01 | 2510624 | PWBB-05 | 14.49 | 14.49 | 2025-05-28 23:03:29 |
| 4324881 | 4 | INSALT02 | 2510403-1 | PWBB-12 | 20.01 | 20.01 | 2025-05-28 23:11:40 |
| 4324891 | 5 | INSAPP01 | 2510591 | PWBB-08 | 7.01 | 7.01 | 2025-05-28 23:15:15 |
| 4324909 | 6 | INSBIC01 | 2510226 | PWBB-10 | 5.01 | 5.01 | 2025-05-28 23:24:06 |
| 4324911 | 7 | SPPEPWV1 | 2509548 | PWBE-09 | 5.01 | 5.01 | 2025-05-28 23:26:58 |
| 4324933 | 8 | INGUAR01 | 2509383 | PWBB-09 | 2.00 | 2.00 | 2025-05-29 00:12:23 |
| 4324915 | 9 | PCPAP10B | 837934 | PWBF-01 | 0.50 | 0.50 | 2025-05-29 00:02:30 |
| 4324924 | 10 | IND741R1 | 2509938 | PWBF-01 | 3.20 | 3.20 | 2025-05-29 00:07:58 |

### Batch 2 (843856) - Allocated Lots

| LotTranNo | LineId | ItemKey | LotNo | BinNo | AllocLotQty | QtyUsed | RecDate |
|-----------|--------|---------|-------|-------|-------------|---------|---------|
| 4324866 | 3 | INCORS01 | 2510624 | PWBB-05 | 14.50 | 14.50 | 2025-05-28 23:05:19 |
| 4324876 | 4 | INSALT02 | 2510403-1 | PWBB-12 | 20.00 | 20.00 | 2025-05-28 23:09:49 |
| 4324886 | 5 | INSAPP01 | 2510591 | PWBB-08 | 7.01 | 7.01 | 2025-05-28 23:14:07 |
| 4324908 | 6 | INSBIC01 | 2510226 | PWBB-10 | 5.00 | 5.00 | 2025-05-28 23:23:08 |
| 4324910 | 7 | SPPEPWV1 | 2509548 | PWBE-09 | 5.00 | 5.00 | 2025-05-28 23:25:17 |
| 4324931 | 8 | INGUAR01 | 2509383 | PWBB-09 | 2.00 | 2.00 | 2025-05-29 00:11:12 |
| 4324916 | 9 | PCPAP10B | 837934 | PWBF-01 | 0.50 | 0.50 | 2025-05-29 00:03:34 |
| 4324929 | 10 | IND741R1 | 2509938 | PWBF-01 | 3.20 | 3.20 | 2025-05-29 00:09:23 |

**📌 Key Observations:**
- **Same lots used across both batches** (e.g., LotNo 2510624 for INCORS01)
- **Same bins used** (e.g., PWBB-05, PWBB-12)
- **User11 = 1** in all Cust_PartialLotPicked records
- **TransactionType = 5** (Issue/Picking transaction)
- **All records have Processed = 'N'** (not yet processed to inventory)

---

## Complete Picking Workflow: Status Change & Pallet Assignment

### Phase 1: Run Creation (Status = "NEW")
- Run created with Status = "NEW"
- Items populated in cust_PartialPicked with ItemBatchStatus = NULL
- Ready for picking

### Phase 2: Active Picking (Status = "NEW")
- Users pick items → ItemBatchStatus = "Allocated"
- PickedPartialQty updated from weight scale
- Status remains **"NEW"** throughout picking
- **NO pallet records created yet**

### Phase 3: Completion - All Items Picked (NEW → PRINT)
**Trigger:** When ALL items have ItemBatchStatus = "Allocated"

**Completion Actions:**
1. User clicks "Complete Run" button (or system auto-detects)
2. **Status changes: "NEW" → "PRINT"**
3. System gets next PalletID from PT sequence (Seqnum table)
4. Creates pallet record in `Cust_PartialPalletLotPicked`:
   - PalletID = Next PT sequence number
   - RunNo, RowNum, BatchNo, LineId = 1
   - RecUserid = Current user/workstation

### Phase 4: Label Printing (Status = "PRINT")
- Batch summary labels print automatically
- Run is complete and ready for production

### Real Production Examples:

| Run No | Status | Items Picked | Pallet Record | Workflow State |
|--------|--------|--------------|---------------|----------------|
| **6000037** | NEW | 0/14 (not started) | ❌ None | Awaiting picking |
| **213935** | PRINT | 10/10 (complete) | ✅ PalletID 623524 | Complete ✓ |

**📌 Key Insight:**
- Status "NEW" = Run created or picking in progress
- Status "PRINT" = All items picked, pallet assigned, ready for label printing

---

## LotTransaction Records (Recent for Batch 843855)

### Completed Picking Transactions (TransactionType = 5)

| LotTranNo | LineId | LotNo | BinNo | QtyIssued | IssueDate | CustomerKey | User5 |
|-----------|--------|-------|-------|-----------|-----------|-------------|-------|
| 17279368 | 8 | 2509383 | PWBB-09 | 2.00 KG | 2025-05-29 00:12:23 | PTB03 | **Picking Customization** |
| 17279359 | 10 | 2509938 | PWBF-01 | 3.20 KG | 2025-05-29 00:07:58 | PTB03 | **Picking Customization** |
| 17279347 | 9 | 837934 | PWBF-01 | 0.50 KG | 2025-05-29 00:02:31 | PTB03 | **Picking Customization** |
| 17279203 | 7 | 2509548 | PWBE-09 | 5.01 KG | 2025-05-28 23:26:59 | PTB03 | **Picking Customization** |
| 17279178 | 6 | 2510226 | PWBB-10 | 5.01 KG | 2025-05-28 23:24:07 | PTB03 | **Picking Customization** |
| 17279109 | 5 | 2510591 | PWBB-08 | 7.01 KG | 2025-05-28 23:15:16 | PTB03 | **Picking Customization** |
| 17279074 | 4 | 2510403-1 | PWBB-12 | 20.01 KG | 2025-05-28 23:11:40 | PTB03 | **Picking Customization** |
| 17279027 | 3 | 2510624 | PWBB-05 | 14.49 KG | 2025-05-28 23:03:30 | PTB03 | **Picking Customization** |

**📌 Critical LotTransaction Pattern:**
- ✅ **IssueDocNo** = BatchNo (e.g., "843855")
- ✅ **IssueDocLineNo** = LineId from cust_PartialPicked
- ✅ **QtyIssued** = Actual picked weight from scale
- ✅ **IssueDate** = Timestamp when picked
- ✅ **User5** = "Picking Customization" (tracking marker)
- ✅ **Processed** = "N" (not yet processed)
- ✅ **ReceiptDocNo** = BT-xxxxxxxx (original bin transfer reference)
- ❌ **DateReceived, QtyReceived, Vendorkey, VendorlotNo** = NULL/0 (not used for picking)

---

## Workflow Pattern Analysis

### Phase 1: Lot Allocation ✅ (Completed for 8/9 items)

**Table**: `Cust_PartialLotPicked`

When user selects lot for picking:
1. Creates record with:
   - `AllocLotQty` = Quantity allocated
   - `QtyReceived` = Same as AllocLotQty
   - `QtyUsed` = Same as AllocLotQty
   - `User11` = 1 (flag)
   - `LotStatus` = "Allocated"
   - `Processed` = "N"
2. **NOTE**: Does NOT update LotMaster.QtyCommitSales in this dataset

### Phase 2: Actual Picking ✅ (Completed for 8/9 items)

**Table**: `cust_PartialPicked`

When user weighs item on scale:
1. Updates `PickedPartialQty` = Weight from scale
2. Sets `ItemBatchStatus` = "Allocated"
3. Sets `PickingDate` = Timestamp
4. Sets `ModifiedBy` = Workstation (e.g., "WS3")

### Phase 3: Transaction Recording ✅ (Completed for 8/9 items)

**Table**: `LotTransaction`

Creates picking transaction record:
- `TransactionType` = 5 (Issue/Picking)
- `IssueDocNo` = BatchNo
- `IssueDocLineNo` = LineId
- `QtyIssued` = Picked weight
- `IssueDate` = Picking timestamp
- `RecUserid` = Workstation
- `User5` = "Picking Customization"
- `Processed` = "N"

### Phase 4: Pallet Assignment ❓ (NOT YET DONE)

**Table**: `Cust_PartialPalletLotPicked`

- No records found yet
- May happen after all items picked
- May require manual trigger or completion step

---

## Database State Changes to Monitor

### When You Pick INBC1404:

#### 1. cust_PartialPicked Updates Expected:
```sql
-- Row 1, LineId 2 (Batch 843855)
PickedPartialQty: 0 → [WEIGHT FROM SCALE]
ItemBatchStatus: NULL → "Allocated"
PickingDate: NULL → [TIMESTAMP]
ModifiedBy: NULL → [WORKSTATION]
ModifiedDate: 2025-05-28 13:42:17 → [TIMESTAMP]

-- Row 2, LineId 2 (Batch 843856)
PickedPartialQty: 0 → [WEIGHT FROM SCALE]
ItemBatchStatus: NULL → "Allocated"
PickingDate: NULL → [TIMESTAMP]
ModifiedBy: NULL → [WORKSTATION]
ModifiedDate: 2025-05-28 13:42:22 → [TIMESTAMP]
```

#### 2. Cust_PartialLotPicked Inserts Expected:
```sql
-- New record(s) for INBC1404
RunNo: 213972
RowNum: 1 (and 2)
LineId: 2
LotNo: [SELECTED LOT]
ItemKey: "INBC1404"
BinNo: [SELECTED BIN]
AllocLotQty: ~12.2 KG
QtyUsed: ~12.2 KG
QtyReceived: ~12.2 KG
User11: 1
LotStatus: "Allocated"
TransactionType: 5
Processed: "N"
```

#### 3. LotTransaction Inserts Expected:
```sql
-- New transaction records
TransactionType: 5
LotNo: [SELECTED LOT]
ItemKey: "INBC1404"
IssueDocNo: "843855" (Batch 1)
IssueDocLineNo: 2
QtyIssued: [ACTUAL WEIGHT]
IssueDate: [TIMESTAMP]
RecUserid: [WORKSTATION]
User5: "Picking Customization"
BinNo: [SELECTED BIN]
Processed: "N"
```

#### 4. LotMaster.QtyCommitSales May Update:
```sql
-- If system follows documented workflow:
QtyCommitSales += [ALLOCATED QTY]
-- For the selected LotNo + BinNo
```

---

## Test Instructions

**When you start picking, I will:**

1. Query `cust_PartialPicked` for changes in INBC1404 rows
2. Query `Cust_PartialLotPicked` for new allocation records
3. Query `LotTransaction` for new picking transactions
4. Query `LotMaster` for QtyCommitSales changes (if lot number known)
5. Query `Cust_PartialPalletLotPicked` for pallet assignments
6. Update this document with observed changes

**Please tell me when you:**
- Start picking INBC1404
- Complete weighing
- Complete the picking process
- Any other actions you perform

---

## UNPICK Operation Results (Delete Function)

### What Changed After "Unpick All RM"

#### ✅ Table: `cust_PartialPicked` - Weight Cleared

**ALL picked items were reset:**

| LineId | ItemKey | BEFORE | AFTER | Change |
|--------|---------|--------|-------|--------|
| 3 | INCORS01 | PickedPartialQty: **14.49** | PickedPartialQty: **0** | ❌ Weight cleared |
| 4 | INSALT02 | PickedPartialQty: **20.01** | PickedPartialQty: **0** | ❌ Weight cleared |
| 5 | INSAPP01 | PickedPartialQty: **7.01** | PickedPartialQty: **0** | ❌ Weight cleared |
| 6 | INSBIC01 | PickedPartialQty: **5.01** | PickedPartialQty: **0** | ❌ Weight cleared |
| 7 | SPPEPWV1 | PickedPartialQty: **5.01** | PickedPartialQty: **0** | ❌ Weight cleared |
| 8 | INGUAR01 | PickedPartialQty: **2.00** | PickedPartialQty: **0** | ❌ Weight cleared |
| 9 | PCPAP10B | PickedPartialQty: **0.50** | PickedPartialQty: **0** | ❌ Weight cleared |
| 10 | IND741R1 | PickedPartialQty: **3.20** | PickedPartialQty: **0** | ❌ Weight cleared |

**❗IMPORTANT FINDINGS:**

1. **PickedPartialQty** reset to **0** ✅
2. **ItemBatchStatus** remains **"Allocated"** (NOT cleared!) ⚠️
3. **PickingDate** remains **set** (NOT cleared!) ⚠️
4. **ModifiedBy** and **ModifiedDate** remain **unchanged** ⚠️

#### ✅ Table: `Cust_PartialLotPicked` - ALL RECORDS DELETED

**BEFORE**: 16 lot allocation records (8 per batch)
**AFTER**: **0 records** - ALL DELETED ✅

All LotTranNo records were completely removed:
- 4324861, 4324881, 4324891, 4324909, 4324911, 4324933, 4324915, 4324924 (Batch 1)
- 4324866, 4324876, 4324886, 4324908, 4324910, 4324931, 4324916, 4324929 (Batch 2)

#### ✅ Table: `Cust_PartialPalletLotPicked` - No Change

**BEFORE**: 0 records
**AFTER**: 0 records (no change)

#### ✅ Table: `LotTransaction` - ALL PICKING RECORDS DELETED

**BEFORE**: 8+ picking transaction records (TransactionType = 5)
**AFTER**: **0 records for batches 843855/843856** - ALL DELETED ✅

All LotTransaction records with IssueDocNo = "843855" or "843856" were removed.

---

## UNPICK Backend Implementation Pattern

### What the "Delete/Unpick" Function Does:

```typescript
// Pseudo-code for Unpick operation based on observed behavior

async function unpickItem(runNo: number, rowNum: number, lineId: number) {

  // Step 1: Update cust_PartialPicked - Reset weight to 0
  await db.execute(`
    UPDATE cust_PartialPicked
    SET PickedPartialQty = 0
    WHERE RunNo = @runNo
      AND RowNum = @rowNum
      AND LineId = @lineId
  `);
  // NOTE: ItemBatchStatus, PickingDate, ModifiedBy remain UNCHANGED!

  // Step 2: Delete ALL lot allocation records
  await db.execute(`
    DELETE FROM Cust_PartialLotPicked
    WHERE RunNo = @runNo
      AND RowNum = @rowNum
      AND LineId = @lineId
  `);

  // Step 3: Delete ALL lot transaction records
  const batchNo = await getBatchNo(runNo, rowNum);
  await db.execute(`
    DELETE FROM LotTransaction
    WHERE IssueDocNo = @batchNo
      AND IssueDocLineNo = @lineId
  `);

  // Step 4: (Possibly) Restore LotMaster.QtyCommitSales
  // Decrement QtyCommitSales by the allocated quantity
  // NOTE: Cannot verify without knowing specific LotNo/BinNo
}
```

### Critical Observations:

1. ✅ **Weight is cleared** (`PickedPartialQty = 0`)
2. ⚠️ **Status remains "Allocated"** (not reset to NULL)
3. ⚠️ **PickingDate remains set** (not cleared)
4. ⚠️ **Audit trail preserved** (ModifiedBy, ModifiedDate unchanged)
5. ✅ **Lot allocations completely deleted** (Cust_PartialLotPicked)
6. ✅ **Transactions completely deleted** (LotTransaction)
7. ❓ **LotMaster.QtyCommitSales** - Cannot verify changes without lot details

### Frontend "Delete" Button Implementation:

```typescript
// DELETE endpoint for unpicking
DELETE /api/picks/:runNo/:rowNum/:lineId

// Expected behavior:
// 1. Reset PickedPartialQty to 0
// 2. Delete Cust_PartialLotPicked records
// 3. Delete LotTransaction records
// 4. Restore LotMaster.QtyCommitSales (decrement)
// 5. Keep ItemBatchStatus, PickingDate for audit trail
```

### UI Considerations:

**Item should show as "Unpicked" when:**
- `PickedPartialQty = 0` ✅
- `ItemBatchStatus = "Allocated"` ⚠️ (This still shows as allocated!)

**Recommended UI logic:**
```typescript
const isUnpicked = pickedQty === 0 && batchStatus === 'Allocated';
const isPicked = pickedQty > 0 && batchStatus === 'Allocated';
const isNotStarted = pickedQty === 0 && batchStatus === null;

// Display status:
if (isPicked) {
  return "✅ Picked";
} else if (isUnpicked) {
  return "⚠️ Unpicked (reset)";
} else {
  return "⏳ Pending";
}
```

---

## PICKING Operation Results - INSALT02 (Batch 843856)

### What Changed After Picking INSALT02

**User**: DECHAWAT
**Timestamp**: 2025-10-06 09:40:01-09:40:05
**Item**: INSALT02 - Salt Medium without anticaking
**Batch**: 843856 (RowNum 2, LineId 4)
**Lot Selected**: 2510403-1
**Bin Selected**: PWBB-12
**Weight Picked**: 20.00 KG (Target: 20.00 KG)

---

#### ✅ Table: `cust_PartialPicked` - UPDATED

| Field | BEFORE (Unpicked) | AFTER (Picked) | Change |
|-------|-------------------|----------------|--------|
| `PickedPartialQty` | 0 | **20.00** | ✅ Weight recorded |
| `ItemBatchStatus` | "Allocated" | "Allocated" | ✅ Remains allocated |
| `PickingDate` | 2025-05-29 00:12:23 | **2025-10-06 09:40:05** | ✅ Updated to current |
| `ModifiedBy` | "WS3" | **"DECHAWAT"** | ✅ User recorded |
| `ModifiedDate` | 2025-05-28 23:09:49 | **2025-10-06 09:40:01** | ✅ Timestamp updated |

---

#### ✅ Table: `Cust_PartialLotPicked` - NEW RECORD CREATED

**New LotTranNo**: 4326079

```json
{
  "LotTranNo": 4326079,
  "RunNo": 213972,
  "RowNum": 2,
  "BatchNo": "843856",
  "LineId": 4,
  "LotNo": "2510403-1",
  "ItemKey": "INSALT02",
  "LocationKey": "TFC1",
  "BinNo": "PWBB-12",
  "AllocLotQty": 20,
  "QtyReceived": 20,
  "QtyUsed": 20,
  "User11": 1,
  "LotStatus": "Allocated",
  "TransactionType": 5,
  "DateReceived": "2025-10-06T09:40:01.000Z",
  "DateExpiry": "2028-04-23T00:00:00.000Z",
  "RecUserid": "DECHAWAT",
  "Processed": "N"
}
```

**📌 Pattern Confirmed:**
- ✅ `AllocLotQty` = `QtyReceived` = `QtyUsed` = 20 KG
- ✅ `User11` = 1 (flag indicator)
- ✅ `TransactionType` = 5 (Issue/Picking)
- ✅ `Processed` = "N" (not yet processed)
- ✅ `DateReceived` = Picking timestamp (NOT receipt date!)

---

#### ✅ Table: `LotTransaction` - NEW TRANSACTION CREATED

**New LotTranNo**: 17284806

```json
{
  "LotTranNo": 17284806,
  "LotNo": "2510403-1",
  "ItemKey": "INSALT02",
  "LocationKey": "TFC1",
  "BinNo": "PWBB-12",
  "TransactionType": 5,
  "IssueDocNo": "843856",
  "IssueDocLineNo": 4,
  "IssueDate": "2025-10-06T09:40:05.000Z",
  "QtyIssued": 20,
  "ReceiptDocNo": "BT-26019174",
  "ReceiptDocLineNo": 1,
  "CustomerKey": "PTB03",
  "RecUserid": "DECHAWAT",
  "RecDate": "2025-10-06T09:40:01.000Z",
  "Processed": "N",
  "User5": "Picking Customization"
}
```

**📌 Pattern Confirmed:**
- ✅ `IssueDocNo` = BatchNo ("843856")
- ✅ `IssueDocLineNo` = LineId (4)
- ✅ `QtyIssued` = Actual picked weight (20 KG)
- ✅ `IssueDate` = Picking completion timestamp
- ✅ `ReceiptDocNo` = "BT-26019174" (original bin transfer reference)
- ✅ `User5` = "Picking Customization" (tracking marker)
- ✅ `CustomerKey` = "PTB03" (customer code)
- ❌ `DateReceived`, `QtyReceived`, `Vendorkey`, `VendorlotNo` = NULL/0 (not used for picking)

---

#### ❌ Table: `Cust_PartialPalletLotPicked` - NO CHANGE

**BEFORE**: 0 records
**AFTER**: 0 records

Pallet assignment still not triggered - likely happens after all items are picked.

---

#### ✅ **CORRECTED: LotMaster.QtyCommitSales WAS UPDATED!**

**LotNo**: 2510403-1
**BinNo**: PWBB-12

**Initial State (Before Any Picking):**
- `QtyCommitSales`: 3,695.803 KG
- `AvailableQty`: 588.927 KG

**After First Pick (Batch 843856 - 20 KG):**

| Field | Before | After | Change |
|-------|--------|-------|--------|
| `QtyOnHand` | 4,284.73 KG | 4,284.73 KG | No change |
| `QtyCommitSales` | 3,695.803 KG | **3,715.803 KG** | ✅ +20 KG |
| `AvailableQty` | 588.927 KG | **568.927 KG** | ✅ -20 KG |

### ✅ Inventory Commitment Working Correctly!

**Confirmed Workflow:**
1. User selects lot/bin for picking ✅
2. Create `Cust_PartialLotPicked` record ✅
3. **Increment `LotMaster.QtyCommitSales`** ✅ **WORKING!**
4. Update `cust_PartialPicked` weight ✅
5. Create `LotTransaction` record ✅

**System Behavior Confirmed:**
- ✅ QtyCommitSales increments immediately during picking
- ✅ Available quantity reduces in real-time
- ✅ Inventory commitment is accurate
- ✅ Prevents over-allocation of lots

---

## Complete Picking Workflow (Actual Observed Pattern)

### Phase 1: Lot Selection & Allocation ✅

**When user selects lot/bin:**

```sql
-- 1. Create allocation record
INSERT INTO Cust_PartialLotPicked (
  RunNo, RowNum, BatchNo, LineId,
  LotNo, ItemKey, LocationKey, BinNo,
  AllocLotQty, QtyReceived, QtyUsed,
  TransactionType, DateReceived, DateExpiry,
  User11, LotStatus, Processed,
  RecUserid, RecDate
) VALUES (
  213972, 2, '843856', 4,
  '2510403-1', 'INSALT02', 'TFC1', 'PWBB-12',
  20, 20, 20,
  5, GETDATE(), '2028-04-23',
  1, 'Allocated', 'N',
  'DECHAWAT', GETDATE()
);

-- 2. ✅ LotMaster.QtyCommitSales IS updated
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + 20
WHERE LotNo = '2510403-1'
  AND ItemKey = 'INSALT02'
  AND LocationKey = 'TFC1'
  AND BinNo = 'PWBB-12'
-- Verified: 3695.803 → 3715.803 (+20)
```

### Phase 2: Weight Confirmation ✅

**When user weighs item:**

```sql
UPDATE cust_PartialPicked
SET
  PickedPartialQty = 20,
  PickingDate = GETDATE(),
  ModifiedBy = 'DECHAWAT',
  ModifiedDate = GETDATE()
WHERE RunNo = 213972
  AND RowNum = 2
  AND LineId = 4;
```

### Phase 3: Transaction Recording ✅

**Create picking transaction:**

```sql
INSERT INTO LotTransaction (
  LotNo, ItemKey, LocationKey, BinNo,
  TransactionType,
  IssueDocNo, IssueDocLineNo, IssueDate, QtyIssued,
  ReceiptDocNo, ReceiptDocLineNo,
  CustomerKey, RecUserid, RecDate,
  Processed, User5
) VALUES (
  '2510403-1', 'INSALT02', 'TFC1', 'PWBB-12',
  5,
  '843856', 4, GETDATE(), 20,
  'BT-26019174', 1,
  'PTB03', 'DECHAWAT', GETDATE(),
  'N', 'Picking Customization'
);
```

### Phase 4: Inventory Commitment ✅

**This DOES execute during picking:**

```sql
-- ✅ Confirmed: This executes when lot is allocated
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + 20
WHERE LotNo = '2510403-1'
  AND ItemKey = 'INSALT02'
  AND LocationKey = 'TFC1'
  AND BinNo = 'PWBB-12';

-- Result verified:
-- QtyCommitSales: 3695.803 → 3715.803 (+20 KG) ✅
```

---

---

## Second Pick - INSALT02 Batch 843855

**User**: DECHAWAT
**Timestamp**: 2025-10-06 09:48:49-09:48:51
**Item**: INSALT02 (Batch 843855, RowNum 1, LineId 4)
**Lot Selected**: 2510403-1 (Same lot as first pick!)
**Bin Selected**: PWBB-12 (Same bin as first pick!)
**Weight Picked**: 20.00 KG

### Tables Updated:

✅ **cust_PartialPicked** - PickedPartialQty = 20, status updated
✅ **Cust_PartialLotPicked** - New record (LotTranNo: 4326080)
✅ **LotTransaction** - New transaction (LotTranNo: 17284807)
✅ **LotMaster.QtyCommitSales** - Should increment to 3,735.803 KG

**Current QtyCommitSales**: 3,715.803 KG
- After 1st pick: 3,715.803 KG (from 3,695.803)
- After 2nd pick: Should be 3,735.803 KG (+20)

---

## Frontend Implementation Recommendation

### ✅ QtyCommitSales Update Pattern (Confirmed Working)

```typescript
// Match official app behavior - update QtyCommitSales during lot allocation
async function pickItem(data: PickingData) {
  await db.transaction(async (tx) => {
    // 1. Create lot allocation
    await tx.insert(Cust_PartialLotPicked, {
      RunNo: data.runNo,
      RowNum: data.rowNum,
      LineId: data.lineId,
      LotNo: data.lotNo,
      BinNo: data.binNo,
      AllocLotQty: data.qty,
      // ... other fields
    });

    // 2. ✅ Update QtyCommitSales (official app does this)
    await tx.execute(`
      UPDATE LotMaster
      SET QtyCommitSales = QtyCommitSales + @AllocLotQty
      WHERE LotNo = @LotNo
        AND ItemKey = @ItemKey
        AND LocationKey = @LocationKey
        AND BinNo = @BinNo
    `, {
      AllocLotQty: data.qty,
      LotNo: data.lotNo,
      ItemKey: data.itemKey,
      LocationKey: data.locationKey,
      BinNo: data.binNo
    });

    // 3. Update weight
    await tx.update(cust_PartialPicked, {
      PickedPartialQty: data.weight,
      PickingDate: new Date(),
      ModifiedBy: data.userId,
      ModifiedDate: new Date()
    }, {
      RunNo: data.runNo,
      RowNum: data.rowNum,
      LineId: data.lineId
    });

    // 4. Create transaction
    await tx.insert(LotTransaction, {
      LotNo: data.lotNo,
      ItemKey: data.itemKey,
      TransactionType: 5,
      IssueDocNo: data.batchNo,
      IssueDocLineNo: data.lineId,
      QtyIssued: data.weight,
      User5: 'Picking Customization',
      // ... other fields
    });
  });
}
```

---

## SINGLE LINE UNPICK Operation (Delete Button for Individual Line)

### Test Case: Delete INSALT02 from Batch 843855

**User**: DECHAWAT
**Timestamp**: 2025-10-06 (after picking operations)
**Action**: Unpick/Delete single line (INSALT02, Batch 843855, RowNum 1, LineId 4)
**Previous State**: PickedPartialQty = 20 KG, LotTranNo 4326080, LotTransaction 17284807

---

#### ✅ Table: `cust_PartialPicked` - Weight Reset, Status PRESERVED

| Field | BEFORE (Picked) | AFTER (Unpicked) | Change |
|-------|----------------|------------------|--------|
| `PickedPartialQty` | 20 KG | **0 KG** | ✅ Weight cleared |
| `ItemBatchStatus` | "Allocated" | **"Allocated"** | ⚠️ Status UNCHANGED |
| `PickingDate` | 2025-10-06 09:48:51 | **2025-10-06 09:48:51** | ⚠️ Date UNCHANGED |
| `ModifiedBy` | "DECHAWAT" | **"DECHAWAT"** | ⚠️ User UNCHANGED |
| `ModifiedDate` | 2025-10-06 09:48:49 | **2025-10-06 09:48:49** | ⚠️ Date UNCHANGED |

**📌 Critical Finding**: Only `PickedPartialQty` is reset to 0. All audit fields remain intact for history tracking.

---

#### ✅ Table: `Cust_PartialLotPicked` - RECORD DELETED

**BEFORE**: 1 record (LotTranNo: 4326080)
**AFTER**: **0 records** - DELETED ✅

The lot allocation record was completely removed:
- RunNo: 213972, RowNum: 1, LineId: 4
- LotNo: 2510403-1, BinNo: PWBB-12
- AllocLotQty: 20 KG

---

#### ✅ Table: `LotTransaction` - RECORD DELETED

**BEFORE**: 1 transaction (LotTranNo: 17284807)
**AFTER**: **0 records** - DELETED ✅

The picking transaction was completely removed:
- IssueDocNo: 843855, IssueDocLineNo: 4
- QtyIssued: 20 KG
- User5: "Picking Customization"

---

#### ✅ Table: `LotMaster` - QtyCommitSales DECREMENTED

**LotNo**: 2510403-1
**BinNo**: PWBB-12

| Field | BEFORE | AFTER | Change |
|-------|--------|-------|--------|
| `QtyOnHand` | 4,284.73 KG | 4,284.73 KG | No change |
| `QtyCommitSales` | 3,695.803 KG | **3,675.803 KG** | ✅ -20 KG |
| `AvailableQty` | 588.927 KG | **608.927 KG** | ✅ +20 KG |

**📌 Critical Finding**: QtyCommitSales is properly decremented when unpicking, restoring inventory availability.

---

## Single Line Unpick Implementation Pattern

### Backend DELETE Operation for Individual Line:

```typescript
// DELETE endpoint for unpicking a single line
async function unpickSingleLine(
  runNo: number,
  rowNum: number,
  lineId: number
) {
  await db.transaction(async (tx) => {

    // Step 1: Get lot allocation details BEFORE deleting
    const lotAlloc = await tx.query(`
      SELECT LotNo, ItemKey, LocationKey, BinNo, AllocLotQty
      FROM Cust_PartialLotPicked
      WHERE RunNo = @runNo
        AND RowNum = @rowNum
        AND LineId = @lineId
    `, { runNo, rowNum, lineId });

    // Step 2: Update cust_PartialPicked - Reset weight to 0 ONLY
    await tx.execute(`
      UPDATE cust_PartialPicked
      SET PickedPartialQty = 0
      WHERE RunNo = @runNo
        AND RowNum = @rowNum
        AND LineId = @lineId
    `, { runNo, rowNum, lineId });
    // NOTE: ItemBatchStatus, PickingDate, ModifiedBy remain UNCHANGED for audit trail

    // Step 3: Restore LotMaster.QtyCommitSales
    if (lotAlloc.length > 0) {
      const { LotNo, ItemKey, LocationKey, BinNo, AllocLotQty } = lotAlloc[0];

      await tx.execute(`
        UPDATE LotMaster
        SET QtyCommitSales = QtyCommitSales - @AllocLotQty
        WHERE LotNo = @LotNo
          AND ItemKey = @ItemKey
          AND LocationKey = @LocationKey
          AND BinNo = @BinNo
      `, { AllocLotQty, LotNo, ItemKey, LocationKey, BinNo });
      // Verified: 3,695.803 → 3,675.803 (-20 KG) ✅
    }

    // Step 4: Delete lot allocation record
    await tx.execute(`
      DELETE FROM Cust_PartialLotPicked
      WHERE RunNo = @runNo
        AND RowNum = @rowNum
        AND LineId = @lineId
    `, { runNo, rowNum, lineId });

    // Step 5: Delete lot transaction record
    const batchNo = await getBatchNo(runNo, rowNum);
    await tx.execute(`
      DELETE FROM LotTransaction
      WHERE IssueDocNo = @batchNo
        AND IssueDocLineNo = @lineId
    `, { batchNo, lineId });
  });
}
```

---

### UI Implementation - Delete Button Per Line

```typescript
// DELETE button for each picked line in the grid
interface PickedLineAction {
  runNo: number;
  rowNum: number;
  lineId: number;
  itemKey: string;
  pickedQty: number;
}

async function handleDeleteLine(line: PickedLineAction) {
  // Confirm action
  const confirmed = await confirmDialog({
    title: 'Unpick Item?',
    message: `Remove ${line.itemKey} (${line.pickedQty} KG) from picking?`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  // Call DELETE endpoint
  await fetch(`/api/picks/${line.runNo}/${line.rowNum}/${line.lineId}`, {
    method: 'DELETE'
  });

  // Refresh grid
  await refreshPickingGrid();
}

// Grid column configuration
const columns = [
  { field: 'itemKey', header: 'Item' },
  { field: 'pickedQty', header: 'Picked Qty' },
  {
    field: 'actions',
    header: 'Actions',
    body: (row) => (
      <Button
        icon="pi pi-trash"
        className="p-button-danger p-button-text"
        onClick={() => handleDeleteLine(row)}
        disabled={row.pickedQty === 0} // Disable if not picked
        tooltip="Delete/Unpick"
      />
    )
  }
];
```

---

### Critical Observations - Single Line Unpick:

1. ✅ **Weight cleared**: `PickedPartialQty = 0`
2. ✅ **QtyCommitSales restored**: Decremented by 20 KG (3,695.803 → 3,675.803)
3. ✅ **Available quantity restored**: Incremented by 20 KG (588.927 → 608.927)
4. ✅ **Lot allocation deleted**: Cust_PartialLotPicked record removed
5. ✅ **Transaction deleted**: LotTransaction record removed
6. ⚠️ **Audit trail preserved**: ItemBatchStatus, PickingDate, ModifiedBy remain unchanged
7. ✅ **Inventory consistency**: System properly reverses inventory commitment

---

---

## AUTO-PRINT LABEL After Picking (Individual Item Label)

### Label Specification

**Print Trigger**: Automatically prints when user clicks "Save" after adding lot for each item
**Label Size**: 4" x 4" (10.16 cm x 10.16 cm)
**Label Format**: Individual item label with barcode

### Label Content Structure

Based on actual picked item **INSAPP01** (Batch 843856):

```
┌─────────────────────────────┐
│      INSAPP01               │  ← ItemKey (Large, Bold)
│      7.01        KG         │  ← PickedPartialQty + UOM
│      843856                 │  ← BatchNo (Blue color)
│   2510591                   │  ← LotNo
│   DECHAWAT 06/10/2025       │  ← User + Date (PickingDate)
│   10:04:18AM                │  ← Time
│                             │
│  *INSAPP01--7.01*           │  ← Barcode 128 Format
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │  ← Code128 Barcode
└─────────────────────────────┘
```

### Data Mapping for Label Print

**Example**: INSAPP01 picked on 2025-10-06 10:04:18

#### Source Tables and Fields:

```typescript
interface LabelData {
  // From cust_PartialPicked
  itemKey: string;           // "INSAPP01"
  pickedQty: number;         // 7.01
  batchNo: string;           // "843856"
  pickingDate: Date;         // "2025-10-06T10:04:15.000Z"
  pickedBy: string;          // "DECHAWAT"

  // From Cust_PartialLotPicked
  lotNo: string;             // "2510591"
  binNo: string;             // "PWBB-08" (optional for label)
  dateExpiry: Date;          // "2026-11-19" (optional)

  // Calculated/Formatted
  uom: string;               // "KG" (from system or item master)
  barcodeText: string;       // "*INSAPP01--7.01*"
}
```

### SQL Query to Retrieve Label Data

```sql
-- Query to get label print data after picking
SELECT
    cp.ItemKey,
    cp.PickedPartialQty,
    cp.BatchNo,
    cp.PickingDate,
    cp.ModifiedBy AS PickedBy,
    cpl.LotNo,
    cpl.BinNo,
    cpl.DateExpiry,
    -- Format barcode text: *ITEMKEY--QTY*
    '*' + cp.ItemKey + '--' + CAST(cp.PickedPartialQty AS VARCHAR(20)) + '*' AS BarcodeText
FROM [TFCPILOT3].[dbo].[cust_PartialPicked] cp
INNER JOIN [TFCPILOT3].[dbo].[Cust_PartialLotPicked] cpl
    ON cp.RunNo = cpl.RunNo
    AND cp.RowNum = cpl.RowNum
    AND cp.LineId = cpl.LineId
WHERE cp.RunNo = @RunNo
    AND cp.RowNum = @RowNum
    AND cp.LineId = @LineId
    AND cp.PickedPartialQty > 0;

-- Example result for INSAPP01:
-- ItemKey: INSAPP01
-- PickedPartialQty: 7.01
-- BatchNo: 843856
-- PickingDate: 2025-10-06 10:04:15
-- PickedBy: DECHAWAT
-- LotNo: 2510591
-- BinNo: PWBB-08
-- DateExpiry: 2026-11-19
-- BarcodeText: *INSAPP01--7.01*
```

### Actual Data from Test Pick (INSAPP01 - Batch 843856)

**cust_PartialPicked:**
- ItemKey: `INSAPP01`
- PickedPartialQty: `7.01` KG
- BatchNo: `843856`
- PickingDate: `2025-10-06 10:04:15`
- ModifiedBy: `DECHAWAT`

**Cust_PartialLotPicked:**
- LotTranNo: `4326083`
- LotNo: `2510591`
- BinNo: `PWBB-08`
- AllocLotQty: `7.01` KG
- DateExpiry: `2026-11-19`

**Barcode Format:**
- Text: `*INSAPP01--7.01*`
- Type: Code 128
- Pattern: `*{ItemKey}--{PickedQty}*`

### Print Function Implementation

```typescript
// Print label after successful picking save
async function printPickingLabel(
  runNo: number,
  rowNum: number,
  lineId: number
) {
  // 1. Retrieve label data
  const labelData = await db.query(`
    SELECT
        cp.ItemKey,
        cp.PickedPartialQty,
        cp.BatchNo,
        cp.PickingDate,
        cp.ModifiedBy AS PickedBy,
        cpl.LotNo,
        cpl.BinNo,
        cpl.DateExpiry,
        '*' + cp.ItemKey + '--' + CAST(cp.PickedPartialQty AS VARCHAR(20)) + '*' AS BarcodeText
    FROM cust_PartialPicked cp
    INNER JOIN Cust_PartialLotPicked cpl
        ON cp.RunNo = cpl.RunNo
        AND cp.RowNum = cpl.RowNum
        AND cp.LineId = cpl.LineId
    WHERE cp.RunNo = @runNo
        AND cp.RowNum = @rowNum
        AND cp.LineId = @lineId
        AND cp.PickedPartialQty > 0
  `, { runNo, rowNum, lineId });

  if (labelData.length === 0) {
    console.error('No picking data found for label');
    return;
  }

  const data = labelData[0];

  // 2. Format data for label
  const label = {
    itemKey: data.ItemKey,                              // INSAPP01
    pickedQty: data.PickedPartialQty.toFixed(2),       // 7.01
    uom: 'KG',                                         // Hardcoded or from item master
    batchNo: data.BatchNo,                             // 843856
    lotNo: data.LotNo,                                 // 2510591
    pickedBy: data.PickedBy,                           // DECHAWAT
    pickingDate: formatDate(data.PickingDate),         // 06/10/2025
    pickingTime: formatTime(data.PickingDate),         // 10:04:18AM
    barcodeText: data.BarcodeText                      // *INSAPP01--7.01*
  };

  // 3. Generate ZPL (Zebra) or other label format
  const zpl = generateLabelZPL(label);

  // 4. Send to printer
  await sendToPrinter(zpl, {
    printerName: 'Label_Printer_4x4',
    labelSize: { width: 4, height: 4 } // inches
  });
}

// Label generation (ZPL example for 4x4 inch label)
function generateLabelZPL(label: LabelData): string {
  return `
^XA
^PW406    // 4 inch width at 203 DPI
^LL406    // 4 inch height

// ItemKey (Large, Bold)
^FO50,30^A0N,80,80^FD${label.itemKey}^FS

// Picked Qty + UOM
^FO50,130^A0N,60,60^FD${label.pickedQty}^FS
^FO250,130^A0N,60,60^FDKG^FS

// BatchNo (Blue text if color printer)
^FO50,200^A0N,50,50^FD${label.batchNo}^FS

// LotNo
^FO50,260^A0N,40,40^FD${label.lotNo}^FS

// User + Date
^FO50,310^A0N,30,30^FD${label.pickedBy} ${label.pickingDate}^FS

// Time
^FO50,350^A0N,30,30^FD${label.pickingTime}^FS

// Barcode 128
^FO50,400^BCN,60,Y,N,N^FD${label.barcodeText}^FS

^XZ
  `.trim();
}

// Integration with save function
async function handleSavePickedItem(data: PickingData) {
  await db.transaction(async (tx) => {
    // 1. Save picking data (existing logic)
    await savePicking(tx, data);

    // 2. Auto-print label
    await printPickingLabel(
      data.runNo,
      data.rowNum,
      data.lineId
    );
  });
}
```

### Label Print Workflow

1. **User Action**: Click "Add Lot" → Select lot/bin → Weigh item → Click "Save"
2. **System Action**:
   - Save to `cust_PartialPicked` (weight)
   - Save to `Cust_PartialLotPicked` (lot allocation)
   - Save to `LotTransaction` (picking transaction)
   - Update `LotMaster.QtyCommitSales`
   - **Auto-trigger label print** ← NEW
3. **Label Print**:
   - Query combined data from `cust_PartialPicked` + `Cust_PartialLotPicked`
   - Format barcode text: `*{ItemKey}--{PickedQty}*`
   - Generate Code 128 barcode
   - Print 4x4 inch label
4. **User receives physical label** to attach to picked material

### Barcode Format Specification

**Pattern**: `*{ItemKey}--{PickedQty}*`

**Examples**:
- `*INSAPP01--7.01*`
- `*INSALT02--20.00*`
- `*INCORS01--14.50*`

**Barcode Type**: Code 128 (supports alphanumeric + special characters)

**Scan Result**: Returns exact string including asterisks and dashes

---

## WEIGHT RANGE TOLERANCE VALIDATION (Add Lot Button Control)

### Weight Range Calculation from INMAST Table

**Purpose**: Validate scale weight is within acceptable tolerance before allowing lot addition

**Source Table**: `INMAST` (Item Master)
**Tolerance Field**: `User9` (decimal) - **Absolute tolerance value in KG**

### INMAST Tolerance Fields

| Field | Data Type | Purpose | Example Value |
|-------|-----------|---------|---------------|
| `User7` | float | Bag size or standard pack size | 25.0 KG |
| `User8` | float | Tolerance as percentage (not used in current system) | 0.025 (2.5%) |
| `User9` | decimal | **Absolute tolerance in KG** (USED) | 0.025 KG |
| `User10` | decimal | Reserved/unused | 0 |

### Weight Range Formula

```typescript
// Calculate acceptable weight range for picking
WeightRangeLow  = TargetQty - INMAST.User9
WeightRangeHigh = TargetQty + INMAST.User9
```

**Note**: `User9` is an **absolute value** in KG, NOT a percentage!

### Real Data Examples

#### INSALT02 (Salt Medium without anticaking)
- **Target Qty**: 20.00 KG
- **User9 (Tolerance)**: 0.025 KG
- **Weight Range**: 19.975 to 20.025 KG
- **Valid weights**: 19.975 ≤ weight ≤ 20.025
- **Invalid weights**: < 19.975 or > 20.025

#### INSAPP01 (SAPP 28)
- **Target Qty**: 7.00 KG
- **User9 (Tolerance)**: 0.025 KG
- **Weight Range**: 6.975 to 7.025 KG
- **Actual picked**: 7.01 KG ✓ (within range)

#### INBC1404 (Avon Batter Starch)
- **Target Qty**: 12.2 KG
- **User9 (Tolerance)**: 0.025 KG
- **Weight Range**: 12.175 to 12.225 KG

### SQL Query to Retrieve Weight Range

```sql
-- Get weight range for picking validation
SELECT
    cp.RunNo,
    cp.RowNum,
    cp.LineId,
    cp.ItemKey,
    cp.BatchPartialQty AS TargetQty,
    im.User9 AS ToleranceKG,
    -- Calculate weight range
    cp.BatchPartialQty - im.User9 AS WeightRangeLow,
    cp.BatchPartialQty + im.User9 AS WeightRangeHigh,
    im.Desc1 AS ItemDescription,
    im.User7 AS BagSizeKG
FROM [TFCPILOT3].[dbo].[cust_PartialPicked] cp
INNER JOIN [TFCPILOT3].[dbo].[INMAST] im
    ON cp.ItemKey = im.Itemkey
WHERE cp.RunNo = @RunNo
    AND cp.RowNum = @RowNum
    AND cp.LineId = @LineId;

-- Example result for INSALT02:
-- TargetQty: 20.00
-- ToleranceKG: 0.025
-- WeightRangeLow: 19.975
-- WeightRangeHigh: 20.025
```

### Frontend Implementation

#### TypeScript Interfaces

```typescript
interface WeightRangeData {
  runNo: number;
  rowNum: number;
  lineId: number;
  itemKey: string;
  targetQty: number;
  toleranceKG: number;
  weightRangeLow: number;
  weightRangeHigh: number;
  itemDescription: string;
}

interface ScaleReading {
  weight: number;
  stable: boolean;
  unit: string; // 'KG'
}
```

#### Weight Validation Logic

```typescript
// Validate if scale weight is within acceptable range
function isWeightValid(
  scaleWeight: number,
  weightRange: WeightRangeData
): boolean {
  return scaleWeight >= weightRange.weightRangeLow &&
         scaleWeight <= weightRange.weightRangeHigh;
}

// Real-time validation with scale integration
async function validateAndEnableAddLot(
  scaleReading: ScaleReading,
  weightRange: WeightRangeData
) {
  const isValid = isWeightValid(scaleReading.weight, weightRange);
  const isStable = scaleReading.stable;

  // Enable "Add Lot" button only if:
  // 1. Weight is stable
  // 2. Weight is within tolerance range
  const canAddLot = isStable && isValid;

  return {
    canAddLot,
    isValid,
    isStable,
    message: getValidationMessage(scaleReading.weight, weightRange, isStable)
  };
}

function getValidationMessage(
  weight: number,
  range: WeightRangeData,
  stable: boolean
): string {
  if (!stable) {
    return 'Waiting for stable weight...';
  }

  if (weight < range.weightRangeLow) {
    const deficit = (range.weightRangeLow - weight).toFixed(3);
    return `Weight too low! Need ${deficit} KG more (Min: ${range.weightRangeLow})`;
  }

  if (weight > range.weightRangeHigh) {
    const excess = (weight - range.weightRangeHigh).toFixed(3);
    return `Weight too high! Remove ${excess} KG (Max: ${range.weightRangeHigh})`;
  }

  return `✓ Weight OK (${range.weightRangeLow} - ${range.weightRangeHigh} KG)`;
}
```

#### UI Component Example (React)

```typescript
function PickingWeightInput({ runNo, rowNum, lineId }: PickingProps) {
  const [weightRange, setWeightRange] = useState<WeightRangeData | null>(null);
  const [scaleReading, setScaleReading] = useState<ScaleReading>({
    weight: 0,
    stable: false,
    unit: 'KG'
  });

  // Fetch weight range on mount
  useEffect(() => {
    fetchWeightRange(runNo, rowNum, lineId).then(setWeightRange);
  }, [runNo, rowNum, lineId]);

  // Monitor scale in real-time
  useEffect(() => {
    const interval = setInterval(async () => {
      const reading = await readScale();
      setScaleReading(reading);
    }, 100); // Poll every 100ms

    return () => clearInterval(interval);
  }, []);

  const validation = weightRange
    ? validateAndEnableAddLot(scaleReading, weightRange)
    : { canAddLot: false, message: 'Loading...' };

  return (
    <div className="picking-weight-input">
      {/* Weight Range Display */}
      <div className="weight-range">
        <label>Weight Range</label>
        <div className="range-values">
          {weightRange?.weightRangeLow.toFixed(5)}
          {' to '}
          {weightRange?.weightRangeHigh.toFixed(5)} KG
        </div>
      </div>

      {/* Scale Weight Display */}
      <div className="scale-weight">
        <label>Weight</label>
        <div className={`weight-value ${scaleReading.stable ? 'stable' : 'unstable'}`}>
          {scaleReading.weight.toFixed(5)} KG
        </div>
      </div>

      {/* Validation Message */}
      <div className={`validation-message ${validation.isValid ? 'valid' : 'invalid'}`}>
        {validation.message}
      </div>

      {/* Add Lot Button */}
      <button
        className="btn-add-lot"
        disabled={!validation.canAddLot}
        onClick={handleAddLot}
      >
        Add Lot
      </button>

      {/* Visual Indicator */}
      {weightRange && (
        <div className="weight-indicator">
          <div
            className="weight-marker"
            style={{
              left: `${getWeightPosition(scaleReading.weight, weightRange)}%`
            }}
          />
          <div className="range-bar">
            <span className="min">{weightRange.weightRangeLow}</span>
            <span className="max">{weightRange.weightRangeHigh}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Calculate position for visual indicator (0-100%)
function getWeightPosition(
  weight: number,
  range: WeightRangeData
): number {
  const rangeWidth = range.weightRangeHigh - range.weightRangeLow;
  const position = ((weight - range.weightRangeLow) / rangeWidth) * 100;
  return Math.max(0, Math.min(100, position)); // Clamp 0-100
}
```

#### Backend API Endpoint

```typescript
// GET /api/picking/weight-range/:runNo/:rowNum/:lineId
router.get('/weight-range/:runNo/:rowNum/:lineId', async (req, res) => {
  const { runNo, rowNum, lineId } = req.params;

  const weightRange = await db.query(`
    SELECT
        cp.RunNo,
        cp.RowNum,
        cp.LineId,
        cp.ItemKey,
        cp.BatchPartialQty AS TargetQty,
        im.User9 AS ToleranceKG,
        cp.BatchPartialQty - im.User9 AS WeightRangeLow,
        cp.BatchPartialQty + im.User9 AS WeightRangeHigh,
        im.Desc1 AS ItemDescription,
        im.User7 AS BagSizeKG
    FROM cust_PartialPicked cp
    INNER JOIN INMAST im ON cp.ItemKey = im.Itemkey
    WHERE cp.RunNo = @runNo
        AND cp.RowNum = @rowNum
        AND cp.LineId = @lineId
  `, { runNo, rowNum, lineId });

  if (weightRange.length === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(weightRange[0]);
});
```

### Validation Workflow

1. **User selects item to pick** → Fetch weight range from INMAST
2. **Display weight range** on screen (e.g., "19.975 to 20.025 KG")
3. **User places item on scale** → Read weight continuously
4. **Validate weight in real-time**:
   - ✓ Green indicator if within range
   - ❌ Red indicator if out of range
   - ⏳ Yellow indicator if weight unstable
5. **Enable "Add Lot" button** ONLY when:
   - Weight is stable (not fluctuating)
   - Weight is within tolerance range
6. **User clicks "Add Lot"** → Proceed to lot selection

### Critical Business Rules

1. **Strict Validation**: Cannot bypass weight tolerance check
2. **Real-time Feedback**: User sees immediate visual feedback
3. **Absolute Tolerance**: `User9` is absolute KG value, NOT percentage
4. **Stable Weight Required**: Scale must report stable reading
5. **No Manual Override**: System does not allow manual weight entry if out of range

### Test Data Reference

| ItemKey | Description | Target Qty | User9 (Tolerance) | Weight Range |
|---------|-------------|------------|-------------------|--------------|
| INSALT02 | Salt Medium | 20.00 KG | 0.025 KG | 19.975 - 20.025 |
| INSAPP01 | SAPP 28 | 7.00 KG | 0.025 KG | 6.975 - 7.025 |
| INBC1404 | Batter Starch | 12.2 KG | 0.025 KG | 12.175 - 12.225 |
| INCORS01 | Corn Starch | 14.5 KG | 0.025 KG | 14.475 - 14.525 |
| INSBIC01 | Sodium Bicarbonate | 5.00 KG | 0.025 KG | 4.975 - 5.025 |
| SPPEPWV1 | White Pepper | 5.00 KG | 0.025 KG | 4.975 - 5.025 |

**All items tested have User9 = 0.025 KG tolerance** ✓

---

---

## PRINT SUMMARY LABELS (Batch Completion)

### Print Summary Specification

**Print Trigger**: When all items in ALL batches are picked (Status = "PRINT")
**Label Size**: 4" x 4" (10.16 cm x 10.16 cm)
**Number of Labels**: 1 label per batch (e.g., 4 batches = 4 labels)
**Label Format**: Summary table showing all picked items for each batch

### Label Content Structure

Based on actual Run **213989** with 4 batches:

```
┌─────────────────────────────────────────────┐
│                          24/09/25  2:15:28PM │
│  PRODUCT:  TB44122B    Battermix            │
│  Run #  213989  BATCH:    845983   05/29/25 │
│                                   Page 1 of 4│
│  Item No.      BIN        Lot-No      QTY UM │
│  ─────────────────────────────────────────  │
│  INYELC03    PWBB-04    2510537     18.00 KG│
│  INWSTA02    PWBA-01    2510566     10.00 KG│
│  INSAPP02    PWBB-05    2509563      7.72 KG│
│  SPPEPWV1    PWBE-09    2509548     11.02 KG│
│  INDEXT01    PWBB-05    2510487-1   11.00 KG│
│  INSALT02    PWBB-12    2510403-1   22.00 KG│
│  INSBIC01    PWBB-10    2510226      5.50 KG│
│                                              │
└─────────────────────────────────────────────┘
```

**Header Information:**
- Print timestamp (top right): `24/09/25 2:15:28PM`
- Product: `TB44122B Battermix`
- Run #: `213989`
- Batch #: `845983` (changes per label)
- Production Date: `05/29/25` (from system date or RecDate)
- Page indicator: `Page 1 of 4` (RowNum of NoOfBatches)

**Table Columns:**
- Item No. (ItemKey)
- BIN (BinNo from Cust_PartialLotPicked)
- Lot-No (LotNo from Cust_PartialLotPicked)
- QTY (PickedPartialQty)
- UM (Unit of Measure - always "KG")

### SQL Query to Retrieve Print Summary Data

```sql
-- Get print summary data for a specific batch
SELECT
    -- Header data
    pr.RunNo,
    pr.RowNum,
    pr.BatchNo,
    pr.FormulaId AS ProductCode,
    pr.FormulaDesc AS ProductName,
    pr.NoOfBatches,
    CONVERT(VARCHAR(10), GETDATE(), 101) AS ProductionDate,  -- MM/DD/YY format
    CONVERT(VARCHAR(20), GETDATE(), 100) AS PrintDateTime,   -- Mon DD YYYY HH:MIAMPM

    -- Item details
    cp.LineId,
    cp.ItemKey AS ItemNo,
    cpl.BinNo AS BIN,
    cpl.LotNo AS LotNo,
    cp.PickedPartialQty AS QTY,
    'KG' AS UM

FROM [TFCPILOT3].[dbo].[Cust_PartialRun] pr
INNER JOIN [TFCPILOT3].[dbo].[cust_PartialPicked] cp
    ON pr.RunNo = cp.RunNo
    AND pr.RowNum = cp.RowNum
LEFT JOIN [TFCPILOT3].[dbo].[Cust_PartialLotPicked] cpl
    ON cp.RunNo = cpl.RunNo
    AND cp.RowNum = cpl.RowNum
    AND cp.LineId = cpl.LineId
WHERE pr.RunNo = @RunNo
    AND pr.RowNum = @RowNum
    AND cp.PickedPartialQty > 0  -- Only picked items
ORDER BY cp.LineId;

-- Get all batches for run to generate multiple labels
SELECT
    RunNo,
    RowNum,
    BatchNo,
    NoOfBatches
FROM [TFCPILOT3].[dbo].[Cust_PartialRun]
WHERE RunNo = @RunNo
    AND Status = 'PRINT'  -- Only print when status is PRINT
ORDER BY RowNum;
```

### Actual Test Data - Run 213989

**Run Summary:**
- RunNo: 213989
- Product: TB44122B (Battermix)
- NoOfBatches: 4
- Status: PRINT
- Batches: 845983, 845984, 845985, 845986

**Batch 1 (845983) - Page 1 of 4:**

| Item No. | BIN | Lot-No | QTY | UM |
|----------|-----|--------|-----|-----|
| INYELC03 | PWBB-04 | 2510537 | 18.00 | KG |
| INDEXT01 | PWBB-05 | 2510487-1 | 11.00 | KG |
| INSBIC01 | PWBB-10 | 2510226 | 5.50 | KG |
| INSAPP02 | PWBB-05 | 2509563 | 7.72 | KG |
| INSALT02 | PWBB-12 | 2510403-1 | 22.00 | KG |
| SPPEPWV1 | PWBE-09 | 2509548 | 11.02 | KG |
| INWSTA02 | PWBA-01 | 2510566 | 10.00 | KG |

**Batch 2 (845984) - Page 2 of 4:**

| Item No. | BIN | Lot-No | QTY | UM |
|----------|-----|--------|-----|-----|
| INYELC03 | PWBB-04 | 2510537 | 18.00 | KG |
| INDEXT01 | PWBB-05 | 2510487-1 | 11.02 | KG |
| INSBIC01 | PWBB-10 | 2510226 | 5.50 | KG |
| INSAPP02 | PWBB-05 | 2509563 | 7.70 | KG |
| INSALT02 | PWBB-12 | 2510403-1 | 22.00 | KG |
| SPPEPWV1 | PWBE-09 | 2509548 | 10.99 | KG |
| INWSTA02 | PWBA-01 | 2510566 | 9.99 | KG |

**Batch 3 (845985) - Page 3 of 4:**
- Same items, different quantities

**Batch 4 (845986) - Page 4 of 4:**
- Same items, different quantities

### Print Function Implementation

```typescript
// Generate summary labels for all batches in a run
async function printBatchSummaryLabels(runNo: number) {
  // 1. Get all batches for the run
  const batches = await db.query(`
    SELECT RunNo, RowNum, BatchNo, NoOfBatches, FormulaId, FormulaDesc
    FROM Cust_PartialRun
    WHERE RunNo = @runNo
      AND Status = 'PRINT'
    ORDER BY RowNum
  `, { runNo });

  if (batches.length === 0) {
    throw new Error('No batches ready for printing');
  }

  const totalBatches = batches[0].NoOfBatches;

  // 2. Generate label for each batch
  for (const batch of batches) {
    const items = await db.query(`
      SELECT
          cp.ItemKey AS ItemNo,
          cpl.BinNo AS BIN,
          cpl.LotNo,
          cp.PickedPartialQty AS QTY
      FROM cust_PartialPicked cp
      LEFT JOIN Cust_PartialLotPicked cpl
          ON cp.RunNo = cpl.RunNo
          AND cp.RowNum = cpl.RowNum
          AND cp.LineId = cpl.LineId
      WHERE cp.RunNo = @runNo
          AND cp.RowNum = @rowNum
          AND cp.PickedPartialQty > 0
      ORDER BY cp.LineId
    `, { runNo: batch.RunNo, rowNum: batch.RowNum });

    // 3. Generate label
    const label = {
      printDateTime: formatDateTime(new Date()), // "24/09/25  2:15:28PM"
      productCode: batch.FormulaId,              // "TB44122B"
      productName: batch.FormulaDesc,            // "Battermix"
      runNo: batch.RunNo,                        // 213989
      batchNo: batch.BatchNo,                    // "845983"
      productionDate: formatDate(new Date()),    // "05/29/25"
      pageNum: batch.RowNum,                     // 1
      totalPages: totalBatches,                  // 4
      items: items.map(item => ({
        itemNo: item.ItemNo,
        bin: item.BIN,
        lotNo: item.LotNo,
        qty: item.QTY.toFixed(2),
        um: 'KG'
      }))
    };

    // 4. Generate ZPL and print
    const zpl = generateSummaryLabelZPL(label);
    await sendToPrinter(zpl, {
      printerName: 'Label_Printer_4x4',
      labelSize: { width: 4, height: 4 }
    });
  }
}

// ZPL generation for summary label
function generateSummaryLabelZPL(label: SummaryLabelData): string {
  return `
^XA
^PW406    // 4 inch width at 203 DPI
^LL406    // 4 inch height

// Print DateTime (top right)
^FO280,10^A0N,20,20^FD${label.printDateTime}^FS

// Product line
^FO10,35^A0N,25,25^FDPRODUCT:^FS
^FO120,35^A0N,25,25^FD${label.productCode}^FS
^FO220,35^A0N,25,25^FD${label.productName}^FS

// Run and Batch line
^FO10,65^A0N,25,25^FDRun #^FS
^FO90,65^A0N,25,25^FD${label.runNo}^FS
^FO170,65^A0N,25,25^FDBATCH:^FS
^FO250,65^A0N,25,25^FD${label.batchNo}^FS
^FO330,65^A0N,20,20^FD${label.productionDate}^FS

// Page indicator
^FO280,90^A0N,20,20^FDPage ${label.pageNum} of ${label.totalPages}^FS

// Table header
^FO10,115^A0N,20,20^FDItem No.^FS
^FO120,115^A0N,20,20^FDBIN^FS
^FO200,115^A0N,20,20^FDLot-No^FS
^FO310,115^A0N,20,20^FDQTY UM^FS

// Line separator
^FO10,135^GB380,1,2^FS

// Items (dynamic rows)
${label.items.map((item, idx) => {
  const yPos = 145 + (idx * 25);
  return `
^FO10,${yPos}^A0N,20,20^FD${item.itemNo}^FS
^FO120,${yPos}^A0N,20,20^FD${item.bin}^FS
^FO200,${yPos}^A0N,20,20^FD${item.lotNo}^FS
^FO310,${yPos}^A0N,20,20^FD${item.qty} ${item.um}^FS
  `.trim();
}).join('\n')}

^XZ
  `.trim();
}

// Date/Time formatting
function formatDateTime(date: Date): string {
  // Format: "24/09/25  2:15:28PM"
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${mm}/${dd}/${yy}  ${displayHours}:${mins}:${secs}${ampm}`;
}

function formatDate(date: Date): string {
  // Format: "05/29/25"
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}
```

### Print Summary Workflow

1. **Trigger Condition**: All items in ALL batches must be picked
2. **Status Check**: `Cust_PartialRun.Status = 'PRINT'`
3. **Loop Through Batches**:
   - For each RowNum (1 to NoOfBatches)
   - Query picked items for that batch
   - Generate label with header + item table
   - Include page indicator (Page X of Y)
4. **Print Output**: 4 labels for 4 batches (one 4x4" label per batch)
5. **Each Label Contains**:
   - Run metadata (RunNo, Product, Date)
   - Batch-specific info (BatchNo, RowNum/Page)
   - Table of picked items (ItemNo, BIN, LotNo, QTY, UM)

### Critical Business Rules

1. **Print Condition**: Only print when `Status = 'PRINT'`
2. **Complete Picking**: All items in all batches must be picked first
3. **One Label Per Batch**: NoOfBatches determines number of labels
4. **Page Numbering**: RowNum serves as page number (Page 1 of 4, etc.)
5. **Item Filtering**: Only show items where `PickedPartialQty > 0`
6. **Same Lots Across Batches**: Same lots (e.g., 2510537) can be used for multiple batches
7. **Quantity Variations**: Each batch may have slightly different quantities

### UI Implementation - Print Summary Button

```typescript
// Print Summary button (enabled when all items picked)
async function handlePrintSummary(runNo: number) {
  // 1. Check if all batches are ready
  const runStatus = await checkRunStatus(runNo);

  if (runStatus.status !== 'PRINT') {
    alert('Cannot print: Not all items are picked yet');
    return;
  }

  // 2. Confirm with user
  const confirmed = await confirmDialog({
    title: 'Print Batch Summary Labels?',
    message: `Print ${runStatus.noOfBatches} summary labels for Run ${runNo}?`,
    confirmText: 'Print',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  // 3. Generate and print all labels
  try {
    await printBatchSummaryLabels(runNo);

    toast.success(`Successfully printed ${runStatus.noOfBatches} summary labels`);

    // 4. Update status or navigate
    await updateRunStatus(runNo, 'COMPLETED');

  } catch (error) {
    toast.error('Failed to print summary labels: ' + error.message);
  }
}

// Check if run is ready for printing
async function checkRunStatus(runNo: number) {
  const result = await db.query(`
    SELECT
      RunNo,
      NoOfBatches,
      Status,
      COUNT(DISTINCT RowNum) AS CompletedBatches
    FROM Cust_PartialRun
    WHERE RunNo = @runNo
    GROUP BY RunNo, NoOfBatches, Status
  `, { runNo });

  return result[0];
}
```

### Test Data Reference - Run 213989

| RowNum | BatchNo | Items Picked | Status | Page |
|--------|---------|--------------|--------|------|
| 1 | 845983 | 7 items | PRINT | Page 1 of 4 |
| 2 | 845984 | 7 items | PRINT | Page 2 of 4 |
| 3 | 845985 | 7 items | PRINT | Page 3 of 4 |
| 4 | 845986 | 7 items | PRINT | Page 4 of 4 |

**Common lots used across all batches:**
- INYELC03 → Lot 2510537, Bin PWBB-04
- INDEXT01 → Lot 2510487-1, Bin PWBB-05
- INSBIC01 → Lot 2510226, Bin PWBB-10
- INSAPP02 → Lot 2509563, Bin PWBB-05
- INSALT02 → Lot 2510403-1, Bin PWBB-12
- SPPEPWV1 → Lot 2509548, Bin PWBE-09
- INWSTA02 → Lot 2510566, Bin PWBA-01

---

**Document Version**: 1.7
**Updated**: 2025-10-06
**New Feature Documented**: Print Summary Labels (4x4" batch summary, 1 label per batch)
**Test Data**: Run 213989 with 4 batches generating 4 summary labels
**Print Trigger**: Status = 'PRINT' (all items in all batches picked)
