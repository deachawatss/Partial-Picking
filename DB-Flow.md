# DB-Flow.md

**Database Schema & Operational Workflows - Single Source of Truth**

This document consolidates database schema information and operational workflows for the Partial Picking System. Read this BEFORE implementing any database or workflow features.

---

## Quick Reference

### Critical Tables
- **`Cust_PartialRun`** - Master run records (RunNo, FormulaId, FormulaDesc, Status)
- **`cust_PartialPicked`** - Picking transactions (lowercase 'c', composite key: RunNo+RowNum+LineId)
- **`Cust_PartialLotPicked`** - Lot allocations (RunNo+RowNum+LineId+LotNo+BinNo)
- **`LotMaster`** - Inventory (ItemKey+Location+LotNo, QtyOnHand, QtyCommitSales)
- **`LotTransaction`** - Transaction history (LotTranNo, Type='PT', SequenceNo from Seqnum)
- **`BINMaster`** - Warehouse bins (511 TFC1 PARTIAL bins only)
- **`INMAST`** - Item master (ItemKey, User9=absolute tolerance KG)
- **`Seqnum`** - Sequence generator (SeqType='PT' for pallet IDs)

### Critical Field Names (EXACT CASING)
```
✅ CORRECT                          ❌ WRONG (Always NULL or doesn't exist)
cust_PartialPicked                  Cust_PartialPicked (uppercase C)
ToPickedPartialQty                  ToPickedPartialQtyKG (NULL field)
PickedPartialQty                    PickedPartialQtyKG (NULL field)
picked_partial_qty                  N/A (field doesn't exist)
QtyCommitSales                      QtyCommitted (different field)
```

### Composite Primary Keys
```sql
-- ALWAYS use ALL key components in WHERE clauses:
WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId  -- ✅ CORRECT
WHERE RunNo = @runNo AND LineId = @lineId                       -- ❌ MISSING RowNum
```

---

## Database Schema Essentials

### 1. Cust_PartialRun (Master Production Runs)

**Purpose**: Master records for production runs with formula-based auto-population

**Primary Key**: `RunNo` (int)

**Critical Columns**:
```sql
RunNo           INT PRIMARY KEY    -- Example: 213972, 213989, 6000037
FormulaId       VARCHAR(50)        -- Maps to FG Item Key (e.g., "TL60-1-36")
FormulaDesc     VARCHAR(255)       -- Maps to FG Description
fgItemKey       VARCHAR(50)        -- Auto-populated from FormulaId
fgDescription   VARCHAR(255)       -- Auto-populated from FormulaDesc
ProductionDate  DATE               -- Auto-populated to today
Status          VARCHAR(20)        -- 'NEW' or 'PRINT'
NoOfBatches     INT                -- Auto-calculated from formula (e.g., 6)
CreatedBy       VARCHAR(50)
CreatedDate     DATETIME
```

**Auto-Population Rules**:
- FormulaId → fgItemKey (direct mapping)
- FormulaDesc → fgDescription (direct mapping)
- ProductionDate → TODAY()
- NoOfBatches → Calculated from formula requirements

**Example Production Run**:
```
Run 6000037:
  FormulaId: "TL60-1-36"
  FormulaDesc: "Tomato lasagne 60mm 1kg portion 36 per case"
  fgItemKey: "TL60-1-36"
  fgDescription: "Tomato lasagne 60mm 1kg portion 36 per case"
  NoOfBatches: 6
  Status: "NEW"
  ProductionDate: 2025-01-22
```

---

### 2. cust_PartialPicked (Picking Transactions)

**⚠️ CRITICAL**: Table name uses **lowercase 'c'** (`cust_PartialPicked`)

**Purpose**: Individual picking line items (batch ingredients)

**Composite Primary Key**: `RunNo + RowNum + LineId`

**Critical Columns**:
```sql
RunNo               INT NOT NULL           -- Links to Cust_PartialRun
RowNum              INT NOT NULL           -- Batch number (1, 2, 3...)
LineId              INT NOT NULL           -- Line item within batch
ItemKey             VARCHAR(50)            -- Ingredient item code
ItemDescription     VARCHAR(255)
ToPickedPartialQty  DECIMAL(18,3)          -- Target weight (KG)
PickedPartialQty    DECIMAL(18,3)          -- Actual picked weight (KG)
LotNo               VARCHAR(50)            -- Selected lot
BinNo               VARCHAR(50)            -- Selected bin
ItemBatchStatus     VARCHAR(20)            -- Audit trail (preserved on unpick)
PickingDate         DATETIME               -- Audit trail (preserved on unpick)
ModifiedBy          VARCHAR(50)            -- Audit trail (preserved on unpick)
ModifiedDate        DATETIME
```

**⚠️ Weight Field Clarification**:
```sql
-- These fields are ALWAYS USED:
ToPickedPartialQty    -- Target weight in KG (e.g., 20.000)
PickedPartialQty      -- Actual weight in KG (e.g., 20.025)

-- These fields are ALWAYS NULL (do NOT use):
ToPickedPartialQtyKG  -- NULL (legacy field)
PickedPartialQtyKG    -- NULL (legacy field)
```

**Example Picking Record**:
```
Run 213972, Batch 2, Line 1:
  ItemKey: "INSALT02"
  ItemDescription: "Iodated Salt 25Kg"
  ToPickedPartialQty: 20.000 KG (target)
  PickedPartialQty: 20.025 KG (actual)
  LotNo: "2510403-1"
  BinNo: "PWBB-12"
  ItemBatchStatus: "Allocated"
  PickingDate: 2025-01-20 14:32:15
  ModifiedBy: "deachawat"
```

---

### 3. Cust_PartialLotPicked (Lot Allocations)

**Purpose**: Track lot allocations for each picking transaction

**Composite Primary Key**: `RunNo + RowNum + LineId + LotNo + BinNo`

**Critical Columns**:
```sql
RunNo               INT NOT NULL
RowNum              INT NOT NULL
LineId              INT NOT NULL
ItemKey             VARCHAR(50)
LotNo               VARCHAR(50) NOT NULL
BinNo               VARCHAR(50) NOT NULL
PickedPartialQty    DECIMAL(18,3)         -- Weight allocated from this lot
PickingDate         DATETIME
PickingBy           VARCHAR(50)
```

**Relationship**: 1-to-1 with cust_PartialPicked (for single-lot picks)

---

### 4. LotMaster (Inventory Management)

**Purpose**: Central inventory repository with FEFO lot selection

**Composite Primary Key**: `ItemKey + Location + LotNo`

**Critical Columns**:
```sql
ItemKey         VARCHAR(50) NOT NULL
Location        VARCHAR(10) NOT NULL         -- 'TFC1' for partial picking
LotNo           VARCHAR(50) NOT NULL
DateExpiry      DATE                         -- FEFO sort key (earliest first)
QtyOnHand       DECIMAL(18,3)                -- Physical inventory KG
QtyCommitSales  DECIMAL(18,3)                -- Committed/allocated KG
LotStatus       VARCHAR(10)                  -- 'P'=Production, 'C'=Complete, ''=Open
BinNo           VARCHAR(50)
```

**QtyCommitSales Workflow**:
```
Initial State:
  QtyOnHand: 100.000 KG
  QtyCommitSales: 3,695.803 KG
  AvailableQty: (100.000 - 3,695.803) = -3,595.803 KG (oversold)

After Picking 20 KG:
  QtyCommitSales: 3,695.803 + 20.000 = 3,715.803 KG (increased)
  AvailableQty: (100.000 - 3,715.803) = -3,615.803 KG

After Unpicking 20 KG:
  QtyCommitSales: 3,715.803 - 20.000 = 3,695.803 KG (decreased)
  AvailableQty: (100.000 - 3,695.803) = -3,595.803 KG (restored)
```

**FEFO Selection Query** (Constitutional Principle #1):
```sql
SELECT TOP 1
    LotNo,
    BinNo,
    DateExpiry,
    QtyOnHand,
    QtyCommitSales,
    (QtyOnHand - QtyCommitSales) AS AvailableQty
FROM LotMaster
WHERE ItemKey = @itemKey
  AND Location = 'TFC1'
  AND (QtyOnHand - QtyCommitSales) >= @targetQty
  AND LotStatus IN ('P', 'C', '', NULL)
ORDER BY DateExpiry ASC, Location ASC  -- FEFO: Earliest expiry first
```

**Real Example** (INSALT02, Lot 2510403-1):
```
Before Pick:
  QtyOnHand: 100.000 KG
  QtyCommitSales: 3,695.803 KG
  AvailableQty: -3,595.803 KG
  DateExpiry: 2026-04-25

After Pick (20 KG):
  QtyCommitSales: 3,715.803 KG (+20 KG)
```

---

### 5. LotTransaction (Transaction History)

**Purpose**: Immutable audit trail for all lot movements

**Primary Key**: `LotTranNo` (int, identity)

**Critical Columns**:
```sql
LotTranNo       INT IDENTITY PRIMARY KEY    -- Auto-generated
ItemKey         VARCHAR(50)
LotNo           VARCHAR(50)
Type            VARCHAR(10)                 -- 'PT' for Partial Picking
SequenceNo      VARCHAR(50)                 -- PT pallet ID (from Seqnum)
TransQty        DECIMAL(18,3)               -- Signed quantity (+pick, -unpick)
TransDate       DATETIME
TransBy         VARCHAR(50)
Location        VARCHAR(10)                 -- 'TFC1'
BinNo           VARCHAR(50)
Reference       VARCHAR(100)                -- "Run 213972 Batch 2"
```

**SequenceNo Format**: `"PT" + Seqnum.NextValue` (e.g., "PT000123")

**Real Example**:
```
LotTranNo: 789012
ItemKey: "INSALT02"
LotNo: "2510403-1"
Type: "PT"
SequenceNo: "PT000156"  (from Seqnum)
TransQty: +20.000 KG
TransDate: 2025-01-20 14:32:15
TransBy: "deachawat"
Location: "TFC1"
BinNo: "PWBB-12"
Reference: "Run 213972 Batch 2"
```

---

### 6. BINMaster (Warehouse Bins)

**Purpose**: Physical bin locations in warehouse

**Primary Key**: `Location + BinNo`

**TFC1 PARTIAL Filtering** (Constitutional Principle):
```sql
SELECT BinNo, Description, Aisle, Row, Rack, Location, User1, User4
FROM BINMaster
WHERE Location = 'TFC1'
  AND User1 = 'WHTFC1'
  AND User4 = 'PARTIAL'
```

**Result**: 511 bins (out of 6,722 total) qualified for partial picking

**Example Bins**:
```
BinNo: "PWBB-12"
Description: "Powder Bin B-12"
Aisle: "A"
Row: "1"
Rack: "2"
Location: "TFC1"
User1: "WHTFC1"
User4: "PARTIAL"
```

---

### 7. INMAST (Item Master)

**Purpose**: Item definitions with tolerance settings

**Primary Key**: `ItemKey`

**Critical Columns**:
```sql
ItemKey         VARCHAR(50) PRIMARY KEY
Description     VARCHAR(255)
User9           DECIMAL(18,3)               -- Absolute tolerance in KG
```

**Weight Tolerance Validation**:
```sql
-- User9 = 0.025 KG for INSALT02
Target: 20.000 KG
Min: 19.975 KG (20.000 - 0.025)
Max: 20.025 KG (20.000 + 0.025)

Validation:
  19.980 KG ✅ PASS (within tolerance)
  20.030 KG ❌ FAIL (exceeds max by 0.005 KG)
```

**Real Example** (INSALT02):
```
ItemKey: "INSALT02"
Description: "Iodated Salt 25Kg"
User9: 0.025 KG (absolute tolerance)
```

---

### 8. Seqnum (Sequence Generator)

**Purpose**: Generate unique sequential numbers for pallet IDs

**Primary Key**: `SeqType`

**Schema**:
```sql
SeqType         VARCHAR(10) PRIMARY KEY     -- 'PT' for Partial Picking
NextValue       INT                         -- Next sequence number
```

**Usage Pattern**:
```sql
-- Get next PT sequence (transaction-safe)
DECLARE @nextSeq INT
UPDATE Seqnum
SET NextValue = NextValue + 1, @nextSeq = NextValue + 1
WHERE SeqType = 'PT'

-- Format as pallet ID
DECLARE @palletId VARCHAR(50) = 'PT' + RIGHT('000000' + CAST(@nextSeq AS VARCHAR), 6)
-- Result: "PT000156"
```

---

## Complete Picking Workflow

### 4-Phase Atomic Transaction (Constitutional Principle #4)

**Rule**: ALL 4 phases MUST execute atomically with rollback on ANY failure.

```sql
BEGIN TRANSACTION

-- Phase 1: Insert Lot Allocation (Cust_PartialLotPicked)
INSERT INTO Cust_PartialLotPicked (
    RunNo, RowNum, LineId, ItemKey, LotNo, BinNo,
    PickedPartialQty, PickingDate, PickingBy
) VALUES (
    @runNo,           -- 213972
    @rowNum,          -- 2
    @lineId,          -- 1
    @itemKey,         -- 'INSALT02'
    @lotNo,           -- '2510403-1'
    @binNo,           -- 'PWBB-12'
    @pickedQty,       -- 20.025
    GETDATE(),
    @userId           -- 'deachawat'
)

-- Phase 2: Update Picking Record (cust_PartialPicked) with CUSTOM1 audit trail
UPDATE cust_PartialPicked
SET PickedPartialQty = @pickedQty,      -- 20.025
    LotNo = @lotNo,                      -- '2510403-1'
    BinNo = @binNo,                      -- 'PWBB-12'
    ItemBatchStatus = 'Allocated',
    PickingDate = GETDATE(),
    ModifiedBy = @userId,                -- 'deachawat'
    ModifiedDate = GETDATE(),
    CUSTOM1 = @weightSource              -- Audit: 'MANUAL' when manual entry, NULL when automatic (scale)
WHERE RunNo = @runNo                     -- 213972
  AND RowNum = @rowNum                   -- 2
  AND LineId = @lineId                   -- 1

-- Weight Source Audit Trail (CUSTOM1):
--   NULL = Automatic weight from scale (FETCH WEIGHT button)
--   'MANUAL' = Manual weight entry via numeric keyboard
--   Use case: Audit compliance, quality analysis, operator performance tracking

-- Phase 3: Insert Transaction Record (LotTransaction)
DECLARE @nextSeq INT
UPDATE Seqnum
SET NextValue = NextValue + 1, @nextSeq = NextValue + 1
WHERE SeqType = 'PT'

DECLARE @palletId VARCHAR(50) = 'PT' + RIGHT('000000' + CAST(@nextSeq AS VARCHAR), 6)
-- @palletId = 'PT000156'

INSERT INTO LotTransaction (
    ItemKey, LotNo, Type, SequenceNo, TransQty,
    TransDate, TransBy, Location, BinNo, Reference
) VALUES (
    @itemKey,                                   -- 'INSALT02'
    @lotNo,                                     -- '2510403-1'
    'PT',
    @palletId,                                  -- 'PT000156'
    @pickedQty,                                 -- +20.025
    GETDATE(),
    @userId,                                    -- 'deachawat'
    'TFC1',
    @binNo,                                     -- 'PWBB-12'
    'Run ' + CAST(@runNo AS VARCHAR) + ' Batch ' + CAST(@rowNum AS VARCHAR)
)

-- Phase 4: Update Inventory Commitment (LotMaster)
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @pickedQty  -- 3,695.803 + 20.025 = 3,715.828
WHERE ItemKey = @itemKey                          -- 'INSALT02'
  AND Location = 'TFC1'
  AND LotNo = @lotNo                              -- '2510403-1'

-- Commit all phases atomically
COMMIT TRANSACTION

-- On ANY error: ROLLBACK TRANSACTION (all 4 phases reversed)
```

**Real Production Example** (Run 213972, Batch 2, INSALT02):
```
Input:
  RunNo: 213972
  RowNum: 2 (Batch 2)
  LineId: 1
  ItemKey: "INSALT02"
  LotNo: "2510403-1"
  BinNo: "PWBB-12"
  PickedQty: 20.025 KG
  UserId: "deachawat"

Before Transaction:
  LotMaster.QtyCommitSales: 3,695.803 KG
  cust_PartialPicked.PickedPartialQty: 0.000 KG
  Seqnum.NextValue (PT): 155

After Transaction (All 4 phases committed):
  ✅ Cust_PartialLotPicked: 1 row inserted
  ✅ cust_PartialPicked.PickedPartialQty: 20.025 KG
  ✅ LotTransaction: 1 row inserted (SequenceNo='PT000156')
  ✅ LotMaster.QtyCommitSales: 3,715.828 KG
  ✅ Seqnum.NextValue (PT): 156
```

---

## Unpick/Delete Operation

### Reversal Workflow (Preserves Audit Trail)

**Constitutional Principle #7**: NEVER delete audit metadata (ItemBatchStatus, PickingDate, ModifiedBy)

```sql
BEGIN TRANSACTION

-- Step 1: Delete Lot Allocation (Cust_PartialLotPicked)
DELETE FROM Cust_PartialLotPicked
WHERE RunNo = @runNo                     -- 213972
  AND RowNum = @rowNum                   -- 2
  AND LineId = @lineId                   -- 1
  AND LotNo = @lotNo                     -- '2510403-1'

-- Step 2: Reset Picking Record (cust_PartialPicked) - PRESERVE AUDIT TRAIL
UPDATE cust_PartialPicked
SET PickedPartialQty = 0,                -- Reset to 0 (not NULL)
    LotNo = NULL,                        -- Clear lot selection
    BinNo = NULL,                        -- Clear bin selection
    -- ItemBatchStatus PRESERVED (stays 'Allocated')
    -- PickingDate PRESERVED (stays original timestamp)
    -- ModifiedBy PRESERVED (stays original user)
    ModifiedDate = GETDATE()             -- Update modification timestamp only
WHERE RunNo = @runNo                     -- 213972
  AND RowNum = @rowNum                   -- 2
  AND LineId = @lineId                   -- 1

-- Step 3: Insert Reversal Transaction (LotTransaction)
INSERT INTO LotTransaction (
    ItemKey, LotNo, Type, SequenceNo, TransQty,
    TransDate, TransBy, Location, BinNo, Reference
) VALUES (
    @itemKey,                                   -- 'INSALT02'
    @lotNo,                                     -- '2510403-1'
    'PT',
    'UNPICK',                                   -- Special marker for reversals
    -@pickedQty,                                -- -20.025 (negative)
    GETDATE(),
    @userId,                                    -- 'deachawat'
    'TFC1',
    @binNo,                                     -- 'PWBB-12'
    'Unpick Run ' + CAST(@runNo AS VARCHAR) + ' Batch ' + CAST(@rowNum AS VARCHAR)
)

-- Step 4: Reverse Inventory Commitment (LotMaster)
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales - @pickedQty  -- 3,715.828 - 20.025 = 3,695.803
WHERE ItemKey = @itemKey                          -- 'INSALT02'
  AND Location = 'TFC1'
  AND LotNo = @lotNo                              -- '2510403-1'

COMMIT TRANSACTION
```

**Real Example** (Unpick INSALT02 20.025 KG):
```
Before Unpick:
  cust_PartialPicked.PickedPartialQty: 20.025 KG
  cust_PartialPicked.ItemBatchStatus: "Allocated"
  cust_PartialPicked.PickingDate: 2025-01-20 14:32:15
  LotMaster.QtyCommitSales: 3,715.828 KG
  Cust_PartialLotPicked: 1 row exists

After Unpick:
  cust_PartialPicked.PickedPartialQty: 0.000 KG (reset)
  cust_PartialPicked.LotNo: NULL
  cust_PartialPicked.BinNo: NULL
  cust_PartialPicked.ItemBatchStatus: "Allocated" (PRESERVED ✅)
  cust_PartialPicked.PickingDate: 2025-01-20 14:32:15 (PRESERVED ✅)
  cust_PartialPicked.ModifiedBy: "deachawat" (PRESERVED ✅)
  LotMaster.QtyCommitSales: 3,695.803 KG (restored)
  Cust_PartialLotPicked: 0 rows (deleted)
  LotTransaction: +1 reversal row (TransQty=-20.025, SequenceNo='UNPICK')
```

---

## Auto-Population Workflows

### 1. Run Selection → Auto-Populate Run Details

**Trigger**: User enters Run No (e.g., 6000037)

**Query**:
```sql
SELECT
    RunNo,
    FormulaId,                    -- Maps to fgItemKey
    FormulaDesc,                  -- Maps to fgDescription
    fgItemKey,                    -- "TL60-1-36"
    fgDescription,                -- "Tomato lasagne 60mm 1kg portion 36 per case"
    ProductionDate,               -- 2025-01-22
    Status,                       -- "NEW"
    NoOfBatches                   -- 6
FROM Cust_PartialRun
WHERE RunNo = @runNo              -- 6000037
```

**UI Auto-Population**:
```
Run No: 6000037                              (user input)
  → FG Item Key: "TL60-1-36"                 (auto-filled from FormulaId)
  → Description: "Tomato lasagne 60mm..."    (auto-filled from FormulaDesc)
  → Production Date: 2025-01-22              (auto-filled)
  → Status: NEW                              (auto-filled)
  → No of Batches: 6                         (auto-filled)
```

---

### 2. Batch Selection → Load Batch Items

**Trigger**: User selects Batch No (e.g., Batch 2 of Run 213972)

**Query**:
```sql
SELECT
    RowNum,                       -- Batch number (2)
    LineId,                       -- Line item ID (1, 2, 3...)
    ItemKey,                      -- "INSALT02", "INBAKEPOW01", ...
    ItemDescription,
    ToPickedPartialQty,           -- Target KG (20.000)
    PickedPartialQty,             -- Actual KG (0.000 or picked value)
    LotNo,                        -- NULL or selected lot
    BinNo,                        -- NULL or selected bin
    ItemBatchStatus               -- "Allocated" or NULL
FROM cust_PartialPicked
WHERE RunNo = @runNo              -- 213972
  AND RowNum = @batchNo           -- 2
ORDER BY LineId ASC
```

**Real Example** (Run 213972, Batch 2):
```
Batch 2 Items:
  Line 1: INSALT02    - Iodated Salt 25Kg          - Target: 20.000 KG
  Line 2: INBAKEPOW01 - Baking Powder 25Kg         - Target: 5.000 KG
  Line 3: INTOMPUR02  - Tomato Puree Concentrate   - Target: 15.000 KG
```

---

### 3. Item Selection → FEFO Lot Selection

**Trigger**: User selects item (e.g., INSALT02) with target 20.000 KG

**Query** (FEFO - First Expired First Out):
```sql
SELECT TOP 10
    LotNo,
    DateExpiry,
    BinNo,
    QtyOnHand,
    QtyCommitSales,
    (QtyOnHand - QtyCommitSales) AS AvailableQty
FROM LotMaster
WHERE ItemKey = @itemKey                          -- 'INSALT02'
  AND Location = 'TFC1'
  AND LotStatus IN ('P', 'C', '', NULL)
ORDER BY DateExpiry ASC, Location ASC             -- FEFO sort (earliest expiry first)
```

**Real Example** (INSALT02, Target 20 KG):
```
Lot Selection (FEFO sorted):
  ⭐ Lot 2510403-1 | Expiry: 2026-04-25 | Bin: PWBB-12 | Available: -3,595.803 KG  (FEFO RECOMMENDED)
     Lot 2510403-2 | Expiry: 2026-05-10 | Bin: PWBB-13 | Available: 50.000 KG
     Lot 2510403-3 | Expiry: 2026-06-15 | Bin: PWBB-14 | Available: 75.000 KG
```

**Note**: Negative available quantity indicates oversold inventory (common in production).

---

### 4. Manual Bin Override

**Trigger**: User clicks "Select Bin" to override FEFO bin recommendation

**Query** (TFC1 PARTIAL bins only):
```sql
SELECT
    BinNo,
    Description,
    Aisle,
    Row,
    Rack,
    Location,
    User1,
    User4
FROM BINMaster
WHERE Location = 'TFC1'
  AND User1 = 'WHTFC1'
  AND User4 = 'PARTIAL'
  AND BinNo LIKE '%' + @searchTerm + '%'          -- Client-side search filter
ORDER BY BinNo ASC
```

**Result**: 511 qualified bins available for selection

---

## Weight Range Validation

### Tolerance Formula (INMAST.User9)

**Validation Rule**:
```
Min Weight = Target - |User9|
Max Weight = Target + |User9|

Example (INSALT02):
  Target: 20.000 KG
  User9: 0.025 KG
  Min: 19.975 KG
  Max: 20.025 KG
```

**Validation Logic**:
```typescript
function validateWeight(pickedWeight: number, targetWeight: number, tolerance: number): boolean {
  const min = targetWeight - Math.abs(tolerance)
  const max = targetWeight + Math.abs(tolerance)
  return pickedWeight >= min && pickedWeight <= max
}
```

**Real Examples**:
```
INSALT02 (Target: 20.000 KG, Tolerance: 0.025 KG):
  19.980 KG ✅ PASS (within 19.975 - 20.025)
  20.025 KG ✅ PASS (exactly at max)
  20.030 KG ❌ FAIL (exceeds max by 0.005 KG)
  19.970 KG ❌ FAIL (below min by 0.005 KG)
```

---

## Label Printing

### 1. Individual Item Labels (Auto-Print After Pick)

**Trigger**: Immediately after successful 4-phase pick transaction

**Label Specifications**:
- Size: 4" x 4" thermal label
- QR Code: 2D QR code (ITEMKEY--QTY format, 150×150px)
- Error Correction: Medium level (M)
- Printer: Default thermal printer (Windows native print)
- Quantity: 1 label per pick

**Label Content**:
```
╔════════════════════════════════╗
║   PARTIAL PICK LABEL           ║
║                                ║
║   Item: INSALT02               ║
║   Lot: 2510403-1               ║
║   Bin: PWBB-12                 ║
║   Weight: 20.025 KG            ║
║                                ║
║   ┌───────────────┐            ║
║   │  QR Code      │            ║
║   │  (INSALT02--  │            ║
║   │   20.025)     │            ║
║   └───────────────┘            ║
║                                ║
║   Run: 213972  Batch: 2        ║
║   Date: 2025-01-20 14:32       ║
║   Picker: deachawat            ║
╚════════════════════════════════╝
```

**Implementation Note**:
- Uses HTML/CSS template with `@media print` for 4×4" sizing
- QR Code generated with `qrcode.react` library (QRCodeCanvas component)
- Print via browser `window.print()` for Windows native print dialog
- Data format: Simple string `ITEMKEY--QTY` (e.g., "INSALT02--20.025")

---

### 2. Summary Batch Labels (Manual Print)

**Trigger**: User clicks "Print Summary" after completing all items in batch

**Label Specifications**:
- Size: 4" x 6" thermal label
- Quantity: 1 label per batch
- Printer: Default thermal printer

**Label Content**:
```
╔════════════════════════════════════╗
║   BATCH SUMMARY LABEL              ║
║                                    ║
║   Run: 213972                      ║
║   Batch: 2                         ║
║   FG Item: TL60-1-36               ║
║   Description: Tomato lasagne...   ║
║                                    ║
║   Items Picked: 3                  ║
║   ─────────────────────────────    ║
║   1. INSALT02      20.025 KG       ║
║   2. INBAKEPOW01    5.010 KG       ║
║   3. INTOMPUR02    15.005 KG       ║
║   ─────────────────────────────    ║
║   Total Weight: 40.040 KG          ║
║                                    ║
║   Completed: 2025-01-20 15:45      ║
║   Picker: deachawat                ║
╚════════════════════════════════════╝
```

---

## Critical SQL Queries (Production-Tested)

### 1. Get Run Details
```sql
SELECT
    RunNo,
    FormulaId AS fgItemKey,
    FormulaDesc AS fgDescription,
    ProductionDate,
    Status,
    NoOfBatches
FROM Cust_PartialRun
WHERE RunNo = @runNo
```

### 2. Get Batch Items
```sql
SELECT
    RowNum AS batchNo,
    LineId,
    ItemKey,
    ItemDescription AS description,
    ToPickedPartialQty AS totalNeeded,
    PickedPartialQty AS pickedQty,
    (ToPickedPartialQty - PickedPartialQty) AS remainingQty,
    CASE
        WHEN ItemBatchStatus = 'Allocated' THEN 'Allocated'
        ELSE 'Not Allocated'
    END AS status
FROM cust_PartialPicked
WHERE RunNo = @runNo AND RowNum = @batchNo
ORDER BY LineId ASC
```

### 3. FEFO Lot Selection
```sql
SELECT TOP 10
    LotNo,
    DateExpiry AS expiryDate,
    BinNo,
    QtyOnHand,
    QtyCommitSales,
    (QtyOnHand - QtyCommitSales) AS availableQty
FROM LotMaster
WHERE ItemKey = @itemKey
  AND Location = 'TFC1'
  AND LotStatus IN ('P', 'C', '', NULL)
ORDER BY DateExpiry ASC, Location ASC
```

### 4. Get TFC1 PARTIAL Bins
```sql
SELECT
    BinNo,
    Description,
    Aisle,
    Row,
    Rack,
    Location,
    User1,
    User4
FROM BINMaster
WHERE Location = 'TFC1'
  AND User1 = 'WHTFC1'
  AND User4 = 'PARTIAL'
ORDER BY BinNo ASC
```

### 5. Get Item Tolerance
```sql
SELECT
    ItemKey,
    Description,
    User9 AS toleranceKG
FROM INMAST
WHERE ItemKey = @itemKey
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Wrong Table Name Casing
```sql
-- ❌ WRONG
SELECT * FROM Cust_PartialPicked  -- Uppercase C (won't work in some environments)

-- ✅ CORRECT
SELECT * FROM cust_PartialPicked  -- Lowercase c (production table name)
```

---

### ❌ Pitfall 2: Wrong Weight Field Names
```sql
-- ❌ WRONG (These fields are ALWAYS NULL)
SELECT PickedPartialQtyKG, ToPickedPartialQtyKG FROM cust_PartialPicked

-- ✅ CORRECT (These are the actual weight fields in KG)
SELECT PickedPartialQty, ToPickedPartialQty FROM cust_PartialPicked
```

---

### ❌ Pitfall 3: Missing Composite Key Components
```sql
-- ❌ WRONG (Missing RowNum)
UPDATE cust_PartialPicked
SET PickedPartialQty = 20.025
WHERE RunNo = 213972 AND LineId = 1

-- ✅ CORRECT (All 3 key components)
UPDATE cust_PartialPicked
SET PickedPartialQty = 20.025
WHERE RunNo = 213972 AND RowNum = 2 AND LineId = 1
```

---

### ❌ Pitfall 4: Deleting Audit Trail on Unpick
```sql
-- ❌ WRONG (Loses audit trail)
UPDATE cust_PartialPicked
SET PickedPartialQty = 0,
    ItemBatchStatus = NULL,      -- ❌ NEVER do this
    PickingDate = NULL,           -- ❌ NEVER do this
    ModifiedBy = NULL             -- ❌ NEVER do this
WHERE RunNo = 213972 AND RowNum = 2 AND LineId = 1

-- ✅ CORRECT (Preserves audit trail)
UPDATE cust_PartialPicked
SET PickedPartialQty = 0,
    LotNo = NULL,
    BinNo = NULL
    -- ItemBatchStatus, PickingDate, ModifiedBy PRESERVED
WHERE RunNo = 213972 AND RowNum = 2 AND LineId = 1
```

---

### ❌ Pitfall 5: Wrong FEFO Sort Order
```sql
-- ❌ WRONG (Location first, expiry second)
ORDER BY Location ASC, DateExpiry ASC

-- ✅ CORRECT (Constitutional Principle: Expiry FIRST for FEFO)
ORDER BY DateExpiry ASC, Location ASC
```

---

### ❌ Pitfall 6: QtyCommitSales Direction
```sql
-- ❌ WRONG (Decrementing on pick increases available qty)
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales - @pickedQty  -- ❌ Wrong direction

-- ✅ CORRECT (Incrementing on pick decreases available qty)
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @pickedQty  -- ✅ Correct
```

---

## Constitutional Compliance Checklist

Before implementing ANY database or workflow feature, verify:

- ✅ **Contract-First**: Does this match openapi.yaml/websocket.md specs?
- ✅ **Type Safety**: Are Rust/TypeScript types enforced at compile time?
- ✅ **TDD**: Did you write failing tests FIRST?
- ✅ **Atomic Transactions**: Are all 4 picking phases in single transaction with rollback?
- ✅ **Real-Time Performance**: Does WebSocket update meet <200ms latency?
- ✅ **Security**: Are queries parameterized? JWT validated? CORS configured?
- ✅ **Audit Trail**: Are ItemBatchStatus/PickingDate/ModifiedBy preserved on unpick?
- ✅ **No Surrogate Keys**: Using composite keys (RunNo+RowNum+LineId), not ID columns?

---

**Last Updated**: 2025-01-22
**Version**: 1.0.0
**Source Files**: database-schema.md (1803 lines) + PickingFlow.md (1992 lines) → Consolidated to 600 lines
