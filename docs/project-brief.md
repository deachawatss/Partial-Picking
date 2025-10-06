# Project Brief: Partial Picking System PWA

**Version:** 1.0
**Date:** 2025-10-06
**Status:** Draft for Review

---

## Executive Summary

A modern Progressive Web Application (PWA) for warehouse partial picking operations that replaces the existing desktop application with a responsive, real-time weight scale-integrated system. The PWA will provide workstation operators with an intuitive interface for picking materials with live weight monitoring, FEFO-based lot selection, tolerance validation, automatic label printing via Windows print system, and complete inventory tracking - all optimized for 17-inch 1280x1024 displays while maintaining responsive design for other screen sizes.

**Key Innovation:** Automated FEFO (First Expired, First Out) bin selection with real-time weight integration, eliminating manual bin selection while ensuring optimal inventory rotation and regulatory compliance.

---

## Problem Statement

### Current State
The existing Partial Picking desktop application has several operational limitations:

**Technical Constraints:**
- Desktop-only deployment requiring individual installations across WS1, WS2, WS3, WS4 workstations
- Manual update deployment causing downtime and version inconsistencies
- Limited real-time weight scale integration capabilities
- Older UI/UX patterns requiring modernization

**Operational Inefficiencies:**
- Manual bin selection increases picking time and error risk
- No automated FEFO enforcement - operators must manually check expiry dates
- Complex label printing setup (ZPL programming) limiting printer compatibility
- Difficulty scaling to additional picking stations

### Impact
- **Time Loss:** Average 30-45 seconds per pick for manual bin selection and expiry validation
- **Compliance Risk:** Manual FEFO enforcement leads to potential expired material usage
- **Operational Overhead:** IT team spends ~4 hours/month on desktop app updates across workstations
- **Error Rate:** 2-3% incorrect bin selection due to manual lookup errors

### Why Existing Solutions Fall Short
- Current desktop app lacks automated lot rotation logic
- No intelligent bin selection based on expiry dates and available quantities
- Complex printer configuration limits hardware flexibility
- Manual processes prone to human error in high-volume picking scenarios

### Urgency and Importance
- **Database & workflows fully documented:** Schema v2.4 and PickingFlow v1.7 provide complete implementation blueprint
- **Infrastructure ready:** .NET 8 WebSocket bridge service production-tested, installer package available
- **Compliance pressure:** Food safety regulations require strict FEFO adherence with audit trails
- **Scalability needs:** Plans to expand from 4 to 8+ workstations within 6 months

---

## Proposed Solution

### Core Concept and Approach

Build a **Progressive Web Application** using:
- **Frontend:** React 19 + TypeScript + Tailwind CSS (optimized for 1280x1024, responsive for other sizes)
- **Backend:** Rust with Axum framework (high-performance, memory-safe API layer)
- **Real-time Integration:** WebSocket connection to existing .NET bridge service for dual-scale support (SMALL/BIG)
- **Intelligent Automation:** FEFO-based bin selection algorithm with available quantity filtering

### Key Differentiators

1. **Automated FEFO Bin Selection:**
   - User scans/searches lot number → System automatically selects optimal bin
   - Prioritizes earliest expiry date (DateExpiry ASC)
   - Filters out bins with zero available quantity (`QtyOnHand - QtyCommitSales <= 0`)
   - Excludes non-PARTIAL bins (enforces TFC1, WHTFC1, PARTIAL filter)
   - **Result:** 30-45 second time saving per pick, zero expiry date lookup errors

2. **Zero-Install Progressive Deployment:**
   - Instant updates across all workstations (no manual deployment)
   - Offline capability with service worker caching
   - Native app-like experience via PWA manifest
   - **Result:** Update deployment from 4 hours → 30 seconds

3. **Simplified Print Integration:**
   - Windows native print system (no ZPL programming required)
   - HTML/CSS print templates with `@media print` optimization
   - 4x4" label format using browser print API
   - **Result:** Compatible with any Windows-supported printer

4. **Dual-Scale Real-Time Monitoring:**
   - Concurrent SMALL/BIG scale WebSocket streams (`/ws/scale/small`, `/ws/scale/big`)
   - Sub-400ms weight updates with visual progress bar
   - Color-coded tolerance validation (Green: valid, Red: out of range, Yellow: unstable)
   - **Result:** Immediate visual feedback, reduced picking errors

### Why This Solution Will Succeed

**Technical Foundation:**
- Proven database schema (v2.4) with real production data patterns (Run 213972, 213989)
- Existing .NET bridge service handles hardware complexity (serial ports, scale communication)
- Rust backend provides performance + safety for high-concurrency workload (4-8 workstations)

**Operational Alignment:**
- Exact replication of validated picking workflows from PickingFlow.md
- FEFO automation matches food safety compliance requirements
- 1280x1024 optimization fits existing workstation hardware

**User Experience:**
- Simplified workflow: Scan → Auto-select bin → Fetch weight → Save → Print
- Visual tolerance indicators reduce cognitive load
- Progressive enhancement supports offline operation during network issues

### High-Level Vision

**MVP (Weeks 1-8):** Core picking workflow with FEFO automation, weight integration, Windows printing
**Phase 2 (Months 3-6):** Mobile supervisor dashboard, advanced analytics, barcode scanner integration
**Phase 3 (Months 6-12):** Multi-warehouse expansion, predictive inventory, voice-guided picking

---

## Target Users

### Primary User Segment: Warehouse Picking Operators

**Demographic/Firmographic Profile:**
- Factory floor workers at TFC1 warehouse (WHTFC1)
- Operating fixed workstations: WS1, WS2, WS3, WS4
- Age range: 25-55 years old
- Technical proficiency: Basic computer skills (familiar with desktop picking app)
- Shift pattern: 8-hour shifts, 2-3 operators per shift

**Current Behaviors and Workflows:**
1. Login to desktop picking application
2. Select Run/Batch from queue (filtered by Status: NEW, PRINT)
3. Review items pending picking (Target Qty from ToPickedPartialQty)
4. Place item on scale, visually monitor weight reading
5. **Manually search for lot number** in system (text input or barcode scan)
6. **Manually select bin** from dropdown (check expiry dates, available qty)
7. **Manually record weight** from scale display
8. Click "Add Lot" → Save → Wait for label print
9. Attach printed label to picked material
10. Repeat for all items in batch (typically 7-10 items per batch)
11. Print batch summary labels when all batches complete (Status = 'PRINT')

**Specific Needs and Pain Points:**
- **Time Pressure:** Need to complete batches quickly to meet production schedules
- **Manual Errors:** Selecting wrong bin or recording incorrect weight causes downstream issues
- **Expiry Date Confusion:** Multiple lots with similar expiry dates lead to FEFO mistakes
- **Weight Tolerance Stress:** Uncertainty about acceptable weight range (±0.025 KG) causes hesitation
- **Print Reliability:** Label printer failures create bottlenecks (material can't move without label)
- **System Downtime:** Desktop app updates require shutdown during peak hours

**Goals They're Trying to Achieve:**
- Complete assigned batches accurately and efficiently (target: <30 min per batch)
- Maintain zero expiry date compliance violations (FEFO adherence)
- Minimize picking errors that require rework (weight tolerance violations)
- Reduce waiting time for system responses and label printing
- Work confidently with clear visual feedback on weight and tolerance status

### Secondary User Segment: Warehouse Supervisors

**Profile:**
- Oversee 2-4 picking operators per shift
- Monitor picking progress and inventory levels
- Troubleshoot issues (scale problems, printer failures, lot shortages)
- Generate shift reports and performance metrics

**Needs (Out of Scope for MVP, Phase 2 Consideration):**
- Real-time dashboard view of all workstation statuses
- Mobile/tablet access for floor monitoring
- Alerts for stuck batches or repeated errors
- Performance analytics (picks per hour, accuracy rates)

---

## Goals & Success Metrics

### Business Objectives

1. **Operational Efficiency**
   - **Goal:** Reduce average batch completion time by 20% (from 30 min to 24 min per batch)
   - **Metric:** Track completion timestamps (PickingDate) across 100 batches pre/post deployment
   - **Target:** Achieve by Week 4 post-MVP launch

2. **Compliance Adherence**
   - **Goal:** 100% FEFO compliance with automated bin selection
   - **Metric:** Zero expiry date violations in audit logs (LotMaster.DateExpiry vs pick date)
   - **Target:** Maintain through first 90 days of operation

3. **System Availability**
   - **Goal:** Increase uptime from 97% to 99.5% via PWA offline capability
   - **Metric:** Track workstation availability (operational hours / scheduled hours)
   - **Target:** 99.5% uptime within 8 weeks post-deployment

4. **Deployment Agility**
   - **Goal:** Reduce update deployment time from 4 hours to <5 minutes
   - **Metric:** Time from code merge to all workstations running new version
   - **Target:** Immediate (PWA instant refresh)

### User Success Metrics

1. **Pick Accuracy**
   - **Metric:** Weight tolerance compliance rate (picks within INMAST.User9 ±0.025 KG range)
   - **Target:** 99%+ accuracy (vs current 97%)
   - **Measurement:** Compare PickedPartialQty against calculated weight range

2. **Task Completion Rate**
   - **Metric:** Percentage of batches completed without errors/rework
   - **Target:** 98%+ first-pass success rate
   - **Measurement:** Track unpick/delete operations (Cust_PartialLotPicked deletions)

3. **User Adoption**
   - **Metric:** Operator preference survey (PWA vs old desktop app)
   - **Target:** 90% preference for PWA within 2 weeks
   - **Measurement:** Weekly satisfaction survey (1-5 scale, target avg 4.2+)

4. **Cognitive Load Reduction**
   - **Metric:** Time spent on bin selection (scan lot → save)
   - **Target:** <10 seconds (vs current 30-45 seconds manual lookup)
   - **Measurement:** Frontend timer tracking (lot scan timestamp → save timestamp)

### Key Performance Indicators (KPIs)

| KPI | Definition | Target | Measurement Method |
|-----|------------|--------|-------------------|
| **Weight Update Latency** | Time from scale reading to UI display | <500ms (p95) | WebSocket message timestamp delta |
| **API Response Time** | Backend query execution (picking operations) | <200ms (p95) | Rust Axum middleware metrics |
| **Label Print Success Rate** | Successful prints / total print attempts | 99.9% | Windows print queue success logs |
| **PWA Install Rate** | Workstations with PWA installed | 100% (4/4 workstations) | Service worker registration logs |
| **FEFO Auto-Selection Accuracy** | Correct bin selected (earliest expiry) | 100% | Audit LotMaster.DateExpiry ordering |
| **Offline Capability** | Operations completed while network down | 95%+ (read-only ops) | Service worker cache hit rate |
| **Concurrent User Support** | Simultaneous workstations without degradation | 4 (MVP), 8 (Phase 2) | Load testing, DB connection pool monitoring |

---

## MVP Scope

### Core Features (Must Have)

#### 1. **Optimized UI Layout for 1280x1024 Resolution**

**Primary Display (17-inch, 1280x1024 - 5:4 aspect ratio):**
- **Top Bar (Height: 80px):**
  - Weight display: `0.0000 KG` (large, centered)
  - Scale indicator: `SMALL` / `BIG` toggle buttons (orange active state)
  - Status: "Place item on scale" prompt

- **Header Row (Height: 60px):**
  - Run No, FG Item Key, Batches count, Production Date
  - Status tabs: `PENDING TO PICKED` / `PICKED` (toggle view)

- **Main Content (Height: 780px, 3-column layout):**

  **Left Panel (Width: 380px) - Item Details:**
  - Batch No (display only)
  - Item Description (from INMAST.Desc1)
  - **Lot No (Input + Scan):** Text field with barcode scanner support
  - **Bin No (Auto-selected, display only):** FEFO algorithm result
  - **Stock on Hand (SOH) - Real-Time Breakdown:**
    - Physical Stock: `XXX.XXX KG` (QtyOnHand)
    - Committed: `XX.XXX KG` (QtyCommitSales - reserved)
    - **Available: `XXX.XXX KG`** (Usable stock - bold, highlighted)
  - Weight Range (Min - Max KG) - from INMAST.User9 tolerance
  - Total Needed (ToPickedPartialQty)
  - Remaining Qty (calculated)
  - Allergens (display W, SU, etc.)

  **Center Panel (Width: 320px) - Actions:**
  - `ADD LOT` button (orange, enabled when: lot scanned + weight valid)
  - `VIEW LOTS` button (opens View Lots modal - see ViewLots.png)
    - Shows picked and pending items in split-panel view
    - Re-Print button: Re-print individual labels for selected items
    - Delete button: Unpick selected items and restore inventory
  - **Weight Display (Clickable):** Click to open on-screen numeric keyboard for manual weight entry
  - `FETCH WEIGHT` button (orange, captures current scale reading)
  - `ENTER WEIGHT MANUALLY` button (blue, opens numeric keyboard for manual input)
  - Visual progress bar: Current weight vs Target
  - Color-coded zones: Green (valid), Yellow (unstable), Red (out of range)

  **Right Panel (Width: 580px) - Item Grid (ALL batches):**
  - **Displays ALL items from ALL batches**, ordered alphabetically by ItemKey
  - Same ItemKey appears multiple times (once per batch)
  - Table columns: Item | Batch No | Partial | Weighted | Balance | Allergens | Actions
  - Action icons: Trash (delete/unpick), Search (view lot details)
  - Row highlighting: Completed (green tint), Pending (default)
  - Example: Run 6000037 with 2 batches shows INRICF05 twice (batch 850417 and 850416)

- **Bottom Bar (Height: 64px):**
  - `PRINT` button (batch summary labels)
    - **Disabled (grayed out):** Until all items picked
    - **Enabled (orange):** When all items have ItemBatchStatus = 'Allocated'
    - **Action:** Prints batch summary matching printsum.png format
  - `SAVE` button (orange, commits transaction)
  - `EXIT` button (red)

**Responsive Breakpoints (Phase 2):**
- 1920x1080 (expand grid columns, larger text)
- 1366x768 (compact mode, smaller padding)
- Mobile/Tablet (Phase 2 - supervisor view only)

**CSS Framework:**
- Tailwind CSS with custom theme
- Brown/orange primary colors (matching NewApp-UI.png)
- Custom breakpoint: `@media (min-width: 1280px) and (max-width: 1280px)` for exact 1280x1024 optimization

---

#### 2. **Run No Search & Auto-Population Workflow**

**Purpose**: When user searches for a Run No, the system automatically populates all header fields and loads batch/item data.

**Data Source & Retrieval Pattern:**

```sql
-- Step 1: Get Run header information
SELECT
    RunNo,
    RowNum,
    BatchNo,
    FormulaId AS FGItemKey,        -- FG = Finished Goods
    FormulaDesc AS FGDescription,
    NoOfBatches AS Batches,
    Status
    -- NOTE: ProductionDate NOT from RecDate - using client-side today's date (Bangkok timezone)
FROM Cust_PartialRun
WHERE RunNo = @RunNo
ORDER BY RowNum;

-- Step 2: Get ALL items for the entire run (all batches combined)
-- Items are displayed in the right-side table ordered by ItemKey
SELECT
    cp.RunNo,
    cp.RowNum,
    cp.LineId,
    cp.ItemKey,
    cp.BatchNo,
    cp.ToPickedPartialQty AS TotalNeeded,
    ISNULL(cp.PickedPartialQty, 0) AS PickedQty,
    (cp.ToPickedPartialQty - ISNULL(cp.PickedPartialQty, 0)) AS RemainingQty,
    im.Desc1 AS Description,
    im.User9 AS ToleranceKG,
    (cp.ToPickedPartialQty - im.User9) AS WeightRangeLow,
    (cp.ToPickedPartialQty + im.User9) AS WeightRangeHigh
FROM cust_PartialPicked cp
INNER JOIN INMAST im ON cp.ItemKey = im.Itemkey
WHERE cp.RunNo = @RunNo
ORDER BY cp.ItemKey, cp.RowNum, cp.LineId;
-- This shows ALL items from ALL batches, grouped by ItemKey alphabetically
```

**Real Example - Run No 6000037:**

**Auto-Populated Header Fields:**
- Run No: `6000037`
- FG Item Key: `TSM2285A` (from `FormulaId`)
- FG Description: `Marinade, Savory` (from `FormulaDesc`)
- Batch No: `850417` (RowNum 1) or `850416` (RowNum 2)
- Batches: `2` (from `NoOfBatches`)
- Production Date: `06/10/25` (today's date in Bangkok timezone, formatted as DD/MM/YY)

**Auto-Populated Item Fields (e.g., INRICF05):**
- Item Key: `INRICF05`
- Description: `Rice Flour (RF-0010)` (from `INMAST.Desc1`)
- Weight Range Low: `14.215` (calculated: `14.24 - 0.025`)
- Weight Range High: `14.265` (calculated: `14.24 + 0.025`)
- Total Needed: `14.24` KG (from `ToPickedPartialQty`)
- Remaining Qty: `14.24` KG (calculated: `ToPickedPartialQty - PickedPartialQty`)

**Field Mapping Reference:**

| UI Display | Database Source | Calculation/Notes |
|------------|----------------|-------------------|
| Run No | `Cust_PartialRun.RunNo` | Direct value |
| FG Item Key | `Cust_PartialRun.FormulaId` | Finished Goods item code |
| FG Description | `Cust_PartialRun.FormulaDesc` | Product name/description |
| Batch No | `Cust_PartialRun.BatchNo` | Varies per RowNum (batch) |
| Batches | `Cust_PartialRun.NoOfBatches` | Total number of batches |
| Production Date | **Client-side: Today's date** | Bangkok timezone (Asia/Bangkok), Format: DD/MM/YY |
| Item Key | `cust_PartialPicked.ItemKey` | Raw material/ingredient code |
| Description | `INMAST.Desc1` | Item description from master |
| Weight Range Low | `ToPickedPartialQty - INMAST.User9` | Absolute tolerance (KG) |
| Weight Range High | `ToPickedPartialQty + INMAST.User9` | Absolute tolerance (KG) |
| Total Needed | `cust_PartialPicked.ToPickedPartialQty` | Target weight to pick |
| Remaining Qty | `ToPickedPartialQty - PickedPartialQty` | Uses ISNULL for null safety |

**Frontend Implementation:**

```typescript
// API call on Run No search
async function loadRunData(runNo: number) {
  // 1. Fetch run header
  const runHeader = await fetch(`/api/runs/${runNo}`).then(r => r.json());

  // Auto-populate header fields
  setFormData({
    runNo: runHeader.RunNo,
    fgItemKey: runHeader.FormulaId,           // ← FROM FormulaId
    fgDescription: runHeader.FormulaDesc,      // ← FROM FormulaDesc
    batches: runHeader.NoOfBatches,
    productionDate: getTodayBangkokDate(),     // ← TODAY'S DATE in Bangkok timezone
  });

  // 2. Load batches
  const batches = runHeader.batches.map(batch => ({
    rowNum: batch.RowNum,
    batchNo: batch.BatchNo,
  }));
  setBatchList(batches);

  // 3. Load ALL items from ALL batches (ordered by ItemKey)
  await loadAllRunItems(runNo);
}

async function loadAllRunItems(runNo: number) {
  const items = await fetch(`/api/runs/${runNo}/items`)
    .then(r => r.json());

  // Display ALL items from ALL batches in right-side grid
  // Items are ordered by ItemKey, so same item appears multiple times (once per batch)
  setItemList(items.map(item => ({
    lineId: item.LineId,
    rowNum: item.RowNum,                     // ← Include RowNum to identify batch
    batchNo: item.BatchNo,                   // ← Include BatchNo for display
    itemKey: item.ItemKey,
    description: item.Description,           // ← FROM INMAST.Desc1
    weightRangeLow: item.WeightRangeLow,    // ← CALCULATED
    weightRangeHigh: item.WeightRangeHigh,  // ← CALCULATED
    totalNeeded: item.TotalNeeded,          // ← FROM ToPickedPartialQty
    remainingQty: item.RemainingQty,        // ← CALCULATED
  })));
}

// Get today's date in Bangkok timezone (Asia/Bangkok)
// Format: DD/MM/YY (e.g., "06/10/25" for October 6, 2025)
function getTodayBangkokDate(): string {
  const now = new Date();

  // Convert to Bangkok timezone (UTC+7)
  const bangkokDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  // Parse MM/DD/YYYY format and convert to DD/MM/YY
  const [month, day, year] = bangkokDate.split('/');
  const yy = year.slice(-2);

  return `${day}/${month}/${yy}`;  // DD/MM/YY format
}

// Alternative implementation using date-fns-tz (if library available)
// import { formatInTimeZone } from 'date-fns-tz';
//
// function getTodayBangkokDate(): string {
//   return formatInTimeZone(new Date(), 'Asia/Bangkok', 'dd/MM/yy');
// }
```

**Backend Rust Implementation:**

```rust
// GET /api/runs/:runNo
pub async fn get_run_by_no(
    Path(run_no): Path<i32>,
    State(pool): State<SqlConnectionPool>,
) -> Result<Json<RunResponse>, AppError> {
    // Query run header with batches
    let batches = sqlx::query!(
        r#"
        SELECT
            RunNo,
            RowNum,
            BatchNo,
            FormulaId,
            FormulaDesc,
            NoOfBatches,
            Status
        FROM Cust_PartialRun
        WHERE RunNo = @p1
        ORDER BY RowNum
        "#,
        run_no
    )
    .fetch_all(&pool)
    .await?;

    if batches.is_empty() {
        return Err(AppError::NotFound(format!("Run {} not found", run_no)));
    }

    let first = &batches[0];
    Ok(Json(RunResponse {
        run_no: first.RunNo,
        fg_item_key: first.FormulaId.clone(),      // ← FormulaId
        fg_description: first.FormulaDesc.clone(), // ← FormulaDesc
        no_of_batches: first.NoOfBatches,
        status: first.Status.clone(),
        batches: batches.into_iter().map(|b| BatchInfo {
            row_num: b.RowNum,
            batch_no: b.BatchNo,
        }).collect(),
        // NOTE: production_date removed - frontend uses today's date in Bangkok timezone (DD/MM/YY)
    }))
}

// GET /api/runs/:runNo/items (ALL items from ALL batches)
pub async fn get_run_items(
    Path(run_no): Path<i32>,
    State(pool): State<SqlConnectionPool>,
) -> Result<Json<Vec<ItemResponse>>, AppError> {
    let items = sqlx::query!(
        r#"
        SELECT
            cp.RowNum,
            cp.BatchNo,
            cp.LineId,
            cp.ItemKey,
            im.Desc1 AS Description,
            cp.ToPickedPartialQty AS TotalNeeded,
            ISNULL(cp.PickedPartialQty, 0) AS PickedQty,
            (cp.ToPickedPartialQty - ISNULL(cp.PickedPartialQty, 0)) AS RemainingQty,
            im.User9 AS ToleranceKG,
            (cp.ToPickedPartialQty - im.User9) AS WeightRangeLow,
            (cp.ToPickedPartialQty + im.User9) AS WeightRangeHigh
        FROM cust_PartialPicked cp
        INNER JOIN INMAST im ON cp.ItemKey = im.Itemkey
        WHERE cp.RunNo = @p1
        ORDER BY cp.ItemKey, cp.RowNum, cp.LineId
        "#,
        run_no
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(items.into_iter().map(|item| ItemResponse {
        row_num: item.RowNum,
        batch_no: item.BatchNo,
        line_id: item.LineId,
        item_key: item.ItemKey,
        description: item.Description,
        total_needed: item.TotalNeeded,
        picked_qty: item.PickedQty,
        remaining_qty: item.RemainingQty,
        weight_range_low: item.WeightRangeLow,
        weight_range_high: item.WeightRangeHigh,
    }).collect()))
}
```

**UI Workflow:**

1. User enters Run No in search field → Press Enter or click Search
2. System calls `GET /api/runs/{runNo}`
3. **Auto-populate header:**
   - FG Item Key displays `FormulaId`
   - FG Description displays `FormulaDesc`
   - Batches shows `NoOfBatches`
   - **Production Date shows TODAY'S DATE** in Bangkok timezone (DD/MM/YY format, e.g., "06/10/25")
4. **Load batch list:**
   - Dropdown/tabs populated with all BatchNo values
   - Default select first batch (RowNum 1)
5. **Load ALL items from ALL batches for the run:**
   - System calls `GET /api/runs/{runNo}/items` (note: not batch-specific)
   - **Right-side grid displays ALL items from ALL batches**, ordered by ItemKey alphabetically
   - Each ItemKey appears multiple times (once per batch)
   - Example: Run 6000037 with 2 batches shows INRICF05 twice (for batch 850417 and 850416)
6. **Auto-calculate weight ranges:**
   - Display Weight Range Low = `TotalNeeded - ToleranceKG`
   - Display Weight Range High = `TotalNeeded + ToleranceKG`
   - Display Remaining Qty = `TotalNeeded - PickedQty`

**Validation Rules:**

- Run No must exist in `Cust_PartialRun` table
- Status must be 'NEW' or 'PRINT' (not archived/cancelled)
- Weight range calculation requires `INMAST.User9` to be non-null
- Remaining Qty cannot be negative (validate PickedQty ≤ TotalNeeded)

---

#### 3. **Run Completion Workflow & Print Button**

**Purpose:** Finalize picking run when all items are picked, assign pallet, change status to PRINT, and enable batch summary printing.

##### **Print Button Behavior**
- **Disabled State:** Print button is DISABLED until all items in the run are picked
- **Enable Condition:** When ALL items in the run have `ItemBatchStatus = 'Allocated'`
- **Action:** When clicked, prints batch summary label (see printsum.png example)
- **Summary Format:** Shows Product, Run #, Batch, Production Date, and table of all picked items with BIN, Lot-No, QTY

##### **Trigger Condition**
When ALL items in the run have `ItemBatchStatus = 'Allocated'`:

```sql
-- Check if run is ready for completion
SELECT
    COUNT(*) as TotalItems,
    COUNT(CASE WHEN ItemBatchStatus = 'Allocated' THEN 1 END) as PickedItems
FROM cust_PartialPicked
WHERE RunNo = @RunNo AND RowNum = @RowNum;

-- Run is complete when TotalItems = PickedItems
```

##### **Backend Completion Process**

**Endpoint:** `POST /api/runs/:runNo/complete`

**Step 1: Get Next PalletID from PT Sequence**
```sql
-- Atomically increment and retrieve PT sequence
UPDATE Seqnum
SET SeqNum = SeqNum + 1
WHERE SeqName = 'PT';

SELECT SeqNum
FROM Seqnum
WHERE SeqName = 'PT';
-- Returns: 623957 (next pallet ID)
```

**Step 2: Update Run Status (NEW → PRINT)**
```sql
UPDATE Cust_PartialRun
SET Status = 'PRINT',
    ModifiedDate = GETDATE()
WHERE RunNo = @RunNo;
```

**Step 3: Create Pallet Record**
```sql
INSERT INTO Cust_PartialPalletLotPicked (
    RunNo, RowNum, BatchNo, LineId, PalletID,
    RecUserid, RecDate, ModifiedDate
)
VALUES (
    @RunNo, @RowNum, @BatchNo, 1, @PalletID,
    @UserId, GETDATE(), GETDATE()
);
```

**Step 4: Trigger Batch Summary Label Printing**
- Status = 'PRINT' triggers automatic label printing
- One label per batch (e.g., 4 batches = 4 labels)
- Labels contain batch summary table with all picked items

##### **Frontend Implementation**

```typescript
// Check if Print button should be enabled
async function checkPrintButtonState(runNo: number) {
  const items = await fetch(`/api/runs/${runNo}/items`).then(r => r.json());
  const allPicked = items.every(item => item.itemBatchStatus === 'Allocated');

  // Enable Print button only when ALL items are picked
  setPrintButtonEnabled(allPicked);

  return allPicked;
}

// Print batch summary action (triggered by Print button)
async function printBatchSummary(runNo: number) {
  // First, complete the run (assign pallet, change status to PRINT)
  const response = await fetch(`/api/runs/${runNo}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id })
  });

  const result = await response.json();
  // result: { status: 'PRINT', palletId: '623957', success: true }

  // Then print batch summary labels
  if (result.success) {
    await printBatchSummaryLabels(runNo, result.palletId);
    showCompletionMessage(`Run ${runNo} completed. Pallet ID: ${result.palletId}`);
  }
}

// Re-check print button state after each save
async function handleSavePickedItem() {
  // ... save logic ...

  // After successful save, check if all items are now picked
  await checkPrintButtonState(currentRunNo);
}
```

##### **Rust Backend Implementation**

```rust
pub async fn complete_run(
    Path(run_no): Path<i32>,
    State(pool): State<SqlConnectionPool>,
    Json(payload): Json<CompleteRunRequest>,
) -> Result<Json<CompleteRunResponse>, AppError> {
    // Step 1: Verify all items allocated
    let check = sqlx::query!(
        r#"SELECT COUNT(*) as total,
           COUNT(CASE WHEN ItemBatchStatus = 'Allocated' THEN 1 END) as picked
           FROM cust_PartialPicked WHERE RunNo = @p1"#,
        run_no
    ).fetch_one(&pool).await?;

    if check.total != check.picked {
        return Err(AppError::ValidationError("Not all items picked".into()));
    }

    // Step 2: Get next PalletID
    sqlx::query!("UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = 'PT'")
        .execute(&pool).await?;

    let pallet_id = sqlx::query!("SELECT SeqNum FROM Seqnum WHERE SeqName = 'PT'")
        .fetch_one(&pool).await?.SeqNum;

    // Step 3: Update status to PRINT
    sqlx::query!(
        "UPDATE Cust_PartialRun SET Status = 'PRINT', ModifiedDate = GETDATE() WHERE RunNo = @p1",
        run_no
    ).execute(&pool).await?;

    // Step 4: Create pallet record
    let batches = sqlx::query!("SELECT RowNum, BatchNo FROM Cust_PartialRun WHERE RunNo = @p1", run_no)
        .fetch_all(&pool).await?;

    for batch in batches {
        sqlx::query!(
            r#"INSERT INTO Cust_PartialPalletLotPicked
            (RunNo, RowNum, BatchNo, LineId, PalletID, RecUserid, RecDate)
            VALUES (@p1, @p2, @p3, 1, @p4, @p5, GETDATE())"#,
            run_no, batch.RowNum, batch.BatchNo, pallet_id, payload.user_id
        ).execute(&pool).await?;
    }

    Ok(Json(CompleteRunResponse {
        status: "PRINT".to_string(),
        pallet_id: pallet_id.to_string(),
        success: true,
    }))
}
```

##### **UI Workflow**

1. **During Picking:**
   - Status shows "NEW" (run in progress)
   - Print button is DISABLED (grayed out)
2. **Last Item Picked:**
   - System detects all items have `ItemBatchStatus = 'Allocated'`
   - Print button becomes ENABLED (orange/active)
3. **User Clicks Print Button:**
   - Backend assigns PalletID from PT sequence
   - Status changes: NEW → PRINT
   - Pallet record created in Cust_PartialPalletLotPicked
   - Batch summary label prints (format shown in printsum.png)
4. **Batch Summary Label Contents:**
   - Header: Print date/time (24/09/25  2:15:28PM)
   - Product info: Product code (TB44122B) and name (Battermix)
   - Run details: Run # (213989), BATCH (845983), Production date (05/29/25)
   - Table: Item No. | BIN | Lot-No | QTY | UM
   - All picked items listed with their bin, lot, and quantity
5. **Completion Message:** "Run completed. Pallet ID: 623957"

##### **Validation Rules**

- All items must have `ItemBatchStatus = 'Allocated'`
- Run must have Status = 'NEW' (cannot complete twice)
- PT sequence must be available (Seqnum table)
- User must have completion permissions

##### **Real Production Example**

**Run 213935 Completion:**
- All items allocated: 2025-05-29 11:59:28
- Complete button clicked: ~2025-05-29 12:00:00
- PalletID assigned: 623524 (from PT sequence)
- Status changed: NEW → PRINT
- Pallet record created: 2025-05-29 12:00:04
- Labels printed automatically

---

#### 4. **Automated FEFO Bin Selection with Lot Search**

**Stock on Hand (SOH) Calculation:**

The system uses a precise formula to calculate **Available Quantity** (usable stock):

```
AvailableQty = QtyOnHand - QtyCommitSales
```

**Formula Components:**
- **QtyOnHand:** Total physical quantity in the BIN/Lot (actual inventory)
- **QtyCommitSales:** Quantity already committed/reserved for sales orders
- **AvailableQty:** Actual usable quantity available for picking

**Key Principle:** SOH is NOT just `QtyOnHand` - it's the Available Quantity after subtracting commitments. This ensures picks don't consume inventory already promised to other orders.

**Validation Rules (Multi-Layer):**
1. **Physical Stock Check:** `QtyOnHand > 0` (inventory physically exists)
2. **Available Stock Check:** `(QtyOnHand - QtyCommitSales) > 0` (uncommitted stock available)
3. **Lot Status Check:** Must be 'P', 'C', or empty (exclude blocked/damaged/expired)
4. **BIN Location Check:** Must be PARTIAL bin at TFC1/WHTFC1

**Note:** This SOH calculation pattern matches the proven bulk picking system for consistency across warehouse operations.

---

**User Workflow:**
1. **Scan or Search Lot Number:**
   - Barcode scanner input (primary method)
   - Manual text search with autocomplete dropdown
   - Shows: Lot No, Item Description, Available Qty (calculated in real-time)

2. **System Auto-Selects Best Bin (FEFO Algorithm):**
   ```sql
   -- Backend query executed on lot selection
   -- Real-time calculation of Available Quantity for FEFO compliance
   SELECT TOP 1
       lm.LotNo,
       lm.BinNo,
       lm.QtyOnHand,                                            -- Physical stock
       lm.QtyCommitSales,                                       -- Reserved stock
       (lm.QtyOnHand - lm.QtyCommitSales) AS AvailableQty,    -- Calculated usable stock
       lm.DateExpiry,
       lm.LotStatus,
       bm.Description AS BinDescription
   FROM LotMaster lm
   INNER JOIN BINMaster bm
       ON lm.BinNo = bm.BinNo
       AND lm.LocationKey = bm.Location
   WHERE lm.LotNo = @lotNo
       AND lm.ItemKey = @itemKey
       -- BIN Location Filters (PARTIAL bins only)
       AND bm.Location = 'TFC1'
       AND bm.User1 = 'WHTFC1'
       AND bm.User4 = 'PARTIAL'
       -- Stock Validation (multi-layer checks)
       AND lm.QtyOnHand > 0                                    -- RULE 1: Physical stock exists
       AND (lm.QtyOnHand - lm.QtyCommitSales) > 0             -- RULE 2: Available (uncommitted) stock exists
       -- Lot Status Validation
       AND (lm.LotStatus IN ('P', 'C', '') OR lm.LotStatus IS NULL)  -- RULE 3: Include pick-enabled lots
       AND lm.LotStatus NOT IN ('B', 'D', 'E', 'F', 'H', 'L', 'T', 'W')  -- RULE 4: Exclude problematic lots
   ORDER BY
       lm.DateExpiry ASC,                                      -- FEFO PRIMARY: Earliest expiry first (compliance)
       (lm.QtyOnHand - lm.QtyCommitSales) DESC                -- FEFO TIEBREAKER: Highest available qty (efficiency)
   ```

3. **Display Auto-Selected Bin:**
   - Bin No: `PWBB-12` (large, bold)
   - Expiry Date: `2028-04-23` (red if <30 days, yellow if <90 days, green otherwise)
   - **Stock Breakdown (Real-Time Calculation):**
     - QtyOnHand: `588.927 KG` (Physical stock in bin)
     - CommittedQty: `20.000 KG` (Reserved for other orders)
     - **Available Qty: `568.927 KG`** (Usable stock = 588.927 - 20.000)
   - Lot Status: `P` (Pick-enabled)
   - Selection Reason: "Selected: Earliest expiry with sufficient stock"

4. **Exclusion Logic:**
   - Filter out bins with `AvailableQty <= 0`
   - Exclude non-PARTIAL bins (Location ≠ 'TFC1' OR User1 ≠ 'WHTFC1' OR User4 ≠ 'PARTIAL')
   - **Include only lots with LotStatus:** 'P' (Pick-enabled), 'C' (Cycle Count), or empty string ('')
   - **Exclude lots with LotStatus:** 'B' (Blocked), 'D' (Damaged), 'E' (Expired), 'F' (Failed QC), 'H' (Hold), 'L' (Locked), 'T' (In Transit), 'W' (Withdrawn)

5. **Manual Override (Optional):**
   - "Change Bin" link allows supervisor override if FEFO selection inappropriate
   - Logs override reason in audit trail (User field)

**Business Rules:**
- **FEFO Compliance:** Takes precedence over bin location proximity (earliest expiry first)
- **Tiebreaker Logic:** If multiple bins have same expiry date, prefer highest available quantity
- **Validation Failure:** System rejects lot selection if no valid bins available (show error: "No available bins for this lot")
- **SOH Definition:** Stock on Hand (SOH) = Available Quantity (QtyOnHand - QtyCommitSales), NOT just physical stock
- **Real-Time Calculation:** Available quantity calculated dynamically on every lot search (no cached values)
- **System Alignment:** FEFO algorithm and SOH calculation pattern matches proven bulk picking system for consistency across warehouse operations
- **Multi-Layer Validation:** Four validation rules ensure data integrity (physical stock, available stock, lot status, bin location)

---

#### 5. **Weight Capture: Automatic Fetch & Manual Entry**

**Weight Scale WebSocket Integration:**

**Connection Setup:**
```typescript
// Frontend WebSocket connection to Rust proxy → .NET bridge
const scaleType = 'SMALL'; // or 'BIG' based on user selection
const ws = new WebSocket(`ws://localhost:5000/ws/scale/${scaleType}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'weight') {
    updateWeightDisplay({
      weight: message.data.weight,
      unit: message.data.unit,
      stable: message.data.stable,
      timestamp: message.data.timestamp
    });
  }

  if (message.type === 'status') {
    updateScaleStatus({
      connected: message.data.connected,
      port: message.data.port,
      error: message.data.error
    });
  }
};
```

**Real-Time Weight Display:**
- **Progressive Bar:** Visual indicator showing current weight vs target
  - Min: `TargetQty - INMAST.User9` (e.g., 19.975 KG)
  - Max: `TargetQty + INMAST.User9` (e.g., 20.025 KG)
  - Current: Live scale reading (e.g., 20.002 KG)

- **Color Coding:**
  - **Green:** Weight within tolerance range AND stable
  - **Yellow:** Weight within range but UNSTABLE (fluctuating)
  - **Red:** Weight outside tolerance range
  - **Gray:** Scale disconnected or no reading

**Manual Weight Entry with On-Screen Keyboard:**

**Purpose:** Provide fallback weight input when scale malfunctions or for manual override scenarios.

**Weight Field Interaction:**
- **Normal Mode:** Displays real-time scale reading (live updates)
- **Manual Entry Mode:** Click weight field → On-screen numeric keyboard appears

**On-Screen Keyboard Specification:**
```typescript
interface NumericKeyboardProps {
  onConfirm: (weight: number) => void;
  onCancel: () => void;
  currentValue?: number;
  minValue: number;  // From weight range low
  maxValue: number;  // From weight range high
}

// Keyboard Layout (Optimized for 1280x1024 display)
// ┌─────┬─────┬─────┬─────────┐
// │  7  │  8  │  9  │  CLEAR  │
// ├─────┼─────┼─────┼─────────┤
// │  4  │  5  │  6  │    ←    │
// ├─────┼─────┼─────┼─────────┤
// │  1  │  2  │  3  │  ENTER  │
// ├─────┼─────┼─────┤  (OK)   │
// │  0  │  .  │ DEL ├─────────┤
// └─────┴─────┴─────┤ CANCEL  │
//                    └─────────┘

const NumericKeyboard = ({ onConfirm, onCancel, currentValue, minValue, maxValue }: NumericKeyboardProps) => {
  const [inputValue, setInputValue] = useState(currentValue?.toString() || '');
  const [validationError, setValidationError] = useState('');

  const handleNumberClick = (num: string) => {
    // Prevent multiple decimal points
    if (num === '.' && inputValue.includes('.')) return;

    // Limit to 4 decimal places (e.g., 20.0025)
    if (inputValue.includes('.') && inputValue.split('.')[1].length >= 4) return;

    setInputValue(prev => prev + num);
  };

  const handleClear = () => setInputValue('');

  const handleBackspace = () => setInputValue(prev => prev.slice(0, -1));

  const handleConfirm = () => {
    const weight = parseFloat(inputValue);

    // Validation
    if (isNaN(weight)) {
      setValidationError('Invalid weight value');
      return;
    }

    if (weight < minValue || weight > maxValue) {
      setValidationError(
        `Weight must be between ${minValue.toFixed(3)} - ${maxValue.toFixed(3)} KG`
      );
      return;
    }

    // Valid weight entered
    onConfirm(weight);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-2xl" style={{ width: '420px' }}>
        {/* Display */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-1">
            Valid Range: {minValue.toFixed(3)} - {maxValue.toFixed(3)} KG
          </div>
          <input
            type="text"
            value={inputValue}
            readOnly
            className="w-full text-4xl font-bold text-center border-2 border-orange-500 rounded p-3 bg-gray-50"
            placeholder="0.000"
          />
          {validationError && (
            <div className="text-red-600 text-sm mt-2 text-center">
              ⚠ {validationError}
            </div>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {/* Row 1 */}
          <button onClick={() => handleNumberClick('7')} className="keypad-btn">7</button>
          <button onClick={() => handleNumberClick('8')} className="keypad-btn">8</button>
          <button onClick={() => handleNumberClick('9')} className="keypad-btn">9</button>
          <button onClick={handleClear} className="keypad-btn bg-gray-300">CLEAR</button>

          {/* Row 2 */}
          <button onClick={() => handleNumberClick('4')} className="keypad-btn">4</button>
          <button onClick={() => handleNumberClick('5')} className="keypad-btn">5</button>
          <button onClick={() => handleNumberClick('6')} className="keypad-btn">6</button>
          <button onClick={handleBackspace} className="keypad-btn bg-gray-300">←</button>

          {/* Row 3 */}
          <button onClick={() => handleNumberClick('1')} className="keypad-btn">1</button>
          <button onClick={() => handleNumberClick('2')} className="keypad-btn">2</button>
          <button onClick={() => handleNumberClick('3')} className="keypad-btn">3</button>
          <button
            onClick={handleConfirm}
            className="keypad-btn bg-green-600 text-white row-span-2"
          >
            ENTER
          </button>

          {/* Row 4 */}
          <button onClick={() => handleNumberClick('0')} className="keypad-btn col-span-2">0</button>
          <button onClick={() => handleNumberClick('.')} className="keypad-btn">.</button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
};

// Tailwind CSS custom styles (add to global CSS)
.keypad-btn {
  @apply h-16 text-2xl font-bold rounded border-2 border-gray-300 hover:bg-orange-100 active:bg-orange-200 transition-colors;
}
```

**Weight Field Click Handler:**
```typescript
function handleWeightFieldClick() {
  // Open numeric keyboard modal
  setShowNumericKeyboard(true);
  setManualEntryMode(true);

  // Optionally pre-fill with current scale reading
  setKeyboardInitialValue(currentScaleReading.weight);
}

function handleManualWeightConfirm(weight: number) {
  // Same validation as automatic fetch
  const validation = validateWeight(weight, targetQty, toleranceKG);

  if (validation.valid) {
    setFetchedWeight(weight);
    setWeightSource('manual');  // Track entry method for audit
    setAddLotEnabled(true);
    setShowNumericKeyboard(false);
    setManualEntryMode(false);
  } else {
    // Error shown in keyboard, keep open for correction
    return;
  }
}

function handleManualWeightCancel() {
  setShowNumericKeyboard(false);
  setManualEntryMode(false);
  // Restore live scale reading display
}
```

**Dual-Mode Weight Capture:**
```typescript
// Weight display component with dual functionality
<div className="relative">
  {/* Weight Display Field (Clickable) */}
  <div
    onClick={handleWeightFieldClick}
    className="cursor-pointer border-2 border-orange-500 rounded p-4 text-center hover:bg-orange-50 transition-colors"
    title="Click to enter weight manually"
  >
    <div className="text-5xl font-bold">
      {fetchedWeight !== null ? fetchedWeight.toFixed(4) : currentScaleReading.weight.toFixed(4)} KG
    </div>
    <div className="text-sm text-gray-600 mt-1">
      {manualEntryMode ? '📝 Manual Entry' : '⚡ Live Scale Reading'}
    </div>
  </div>

  {/* Fetch Weight Button (Automatic Mode) */}
  <button
    onClick={handleFetchWeight}
    disabled={!canFetchWeight}
    className="mt-2 w-full bg-orange-600 text-white py-2 rounded disabled:bg-gray-300"
  >
    FETCH WEIGHT
  </button>

  {/* Or Separator */}
  <div className="text-center text-gray-500 my-2">- OR -</div>

  {/* Manual Entry Button */}
  <button
    onClick={handleWeightFieldClick}
    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
  >
    ENTER WEIGHT MANUALLY
  </button>
</div>

{/* On-Screen Keyboard Modal */}
{showNumericKeyboard && (
  <NumericKeyboard
    onConfirm={handleManualWeightConfirm}
    onCancel={handleManualWeightCancel}
    currentValue={currentScaleReading.weight}
    minValue={targetQty - toleranceKG}
    maxValue={targetQty + toleranceKG}
  />
)}
```

**Fetch Weight Button Logic (Original - Still Functional):**
```typescript
// Button enabled ONLY when:
const canFetchWeight =
  scaleConnected &&
  weightStable &&
  weightInRange &&
  lotSelected;

function handleFetchWeight() {
  // Capture current scale reading at button press moment
  const capturedWeight = currentScaleReading.weight;

  // Display in "Weighted" field (frozen value, not live)
  setFetchedWeight(capturedWeight);
  setWeightSource('automatic');  // Track entry method

  // Enable "Add Lot" button (was disabled until weight fetched)
  setAddLotEnabled(true);
}
```

**Weight Tolerance Validation:**
```typescript
function validateWeight(weight: number, targetQty: number, toleranceKG: number) {
  const weightRangeLow = targetQty - toleranceKG;
  const weightRangeHigh = targetQty + toleranceKG;

  const isInRange = weight >= weightRangeLow && weight <= weightRangeHigh;

  return {
    valid: isInRange,
    message: isInRange
      ? `✓ Weight OK (${weightRangeLow.toFixed(3)} - ${weightRangeHigh.toFixed(3)} KG)`
      : weight < weightRangeLow
        ? `⚠ Too light! Add ${(weightRangeLow - weight).toFixed(3)} KG`
        : `⚠ Too heavy! Remove ${(weight - weightRangeHigh).toFixed(3)} KG`
  };
}
```

**Edge Cases & Fallback Scenarios:**

**Scale-Related:**
- **Scale disconnected** → Gray status indicator, disable "Fetch Weight" button, auto-enable manual entry mode
- **Weight unstable** (rapid fluctuation) → Yellow indicator, show "Stabilizing..." message, manual entry available
- **Weight out of range** → Red indicator, disable "Add Lot" button, show exact deficit/excess, allow manual override

**Manual Entry Specific:**
- **Invalid input** (non-numeric) → Show error in keyboard modal, keep keyboard open for correction
- **Out of tolerance** → Show range validation error, keep keyboard open, highlight valid range
- **Empty input** → Disable ENTER button until at least one digit entered
- **Cancel action** → Dismiss keyboard, restore previous/live weight value, clear any validation errors
- **Click outside keyboard** → Same as Cancel (dismiss without saving)
- **Escape key** → Same as Cancel (dismiss without saving)

**Audit Trail:**
- Track weight source in database: `WeightSource` field ('automatic' | 'manual')
- Log manual entries with user ID and timestamp for compliance review
- Include weight source in printed labels (small indicator: "A" for auto, "M" for manual)

---

#### 6. **Save & Transaction Workflow**

**Complete Pick Transaction (4-Phase Pattern from PickingFlow.md):**

**Phase 1: Lot Allocation**
```sql
-- Insert Cust_PartialLotPicked
INSERT INTO Cust_PartialLotPicked (
  RunNo, RowNum, BatchNo, LineId,
  LotNo, ItemKey, LocationKey, BinNo,
  AllocLotQty, QtyReceived, QtyUsed,
  TransactionType, DateReceived, DateExpiry,
  User11, LotStatus, Processed,
  RecUserid, RecDate
) VALUES (
  @runNo, @rowNum, @batchNo, @lineId,
  @lotNo, @itemKey, 'TFC1', @binNo,
  @fetchedWeight, @fetchedWeight, @fetchedWeight,
  5, GETDATE(), @dateExpiry,
  1, 'Allocated', 'N',
  @userId, GETDATE()
);
```

**Phase 2: Update Picked Quantity**
```sql
-- Update cust_PartialPicked (lowercase 'c'!)
UPDATE cust_PartialPicked
SET
  PickedPartialQty = @fetchedWeight,
  PickingDate = GETDATE(),
  ItemBatchStatus = 'Allocated',
  ModifiedBy = @workstationId,  -- e.g., 'WS3'
  ModifiedDate = GETDATE()
WHERE RunNo = @runNo
  AND RowNum = @rowNum
  AND LineId = @lineId;
```

**Phase 3: Create Lot Transaction**
```sql
-- Insert LotTransaction
INSERT INTO LotTransaction (
  LotNo, ItemKey, LocationKey, BinNo,
  TransactionType,
  IssueDocNo, IssueDocLineNo, IssueDate, QtyIssued,
  ReceiptDocNo, ReceiptDocLineNo,
  CustomerKey, RecUserid, RecDate,
  Processed, User5
) VALUES (
  @lotNo, @itemKey, 'TFC1', @binNo,
  5,  -- TransactionType = 5 (Issue/Picking)
  @batchNo, @lineId, GETDATE(), @fetchedWeight,
  @receiptDocNo, @receiptDocLineNo,
  @customerKey, @workstationId, GETDATE(),
  'N', 'Picking Customization'
);
```

**Phase 4: Inventory Commitment**
```sql
-- Update LotMaster.QtyCommitSales
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @fetchedWeight
WHERE LotNo = @lotNo
  AND ItemKey = @itemKey
  AND LocationKey = 'TFC1'
  AND BinNo = @binNo;
```

**Rust Backend Transaction:**
```rust
// Axum handler with database transaction
async fn save_picking(
    State(pool): State<SqlConnectionPool>,
    Json(payload): Json<PickingRequest>,
) -> Result<Json<PickingResponse>, AppError> {
    let mut tx = pool.begin().await?;

    // Phase 1: Lot allocation
    sqlx::query!(/* INSERT Cust_PartialLotPicked */)
        .execute(&mut tx).await?;

    // Phase 2: Update picked qty
    sqlx::query!(/* UPDATE cust_PartialPicked */)
        .execute(&mut tx).await?;

    // Phase 3: Lot transaction
    sqlx::query!(/* INSERT LotTransaction */)
        .execute(&mut tx).await?;

    // Phase 4: Inventory commit
    sqlx::query!(/* UPDATE LotMaster */)
        .execute(&mut tx).await?;

    tx.commit().await?;

    Ok(Json(PickingResponse { success: true }))
}
```

**Error Handling:**
- Database transaction rollback on any failure
- Show specific error to user: "Save failed: [reason]"
- Log full error to backend for debugging
- Retry mechanism (max 3 attempts) for transient network errors

---

#### 7. **Windows Native Label Printing**

**Print Strategy: Browser Print API + HTML/CSS Templates**

**Individual Item Label (4x4" - Auto-Print on Save):**

```html
<!-- Print Template: individual-label.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page {
        size: 4in 4in;
        margin: 0;
      }

      body {
        margin: 0;
        padding: 0.25in;
        font-family: Arial, sans-serif;
      }

      .item-key { font-size: 36pt; font-weight: bold; }
      .quantity { font-size: 28pt; margin: 0.1in 0; }
      .batch-no { font-size: 18pt; color: #1E40AF; margin: 0.05in 0; }
      .lot-no { font-size: 16pt; margin: 0.05in 0; }
      .meta { font-size: 12pt; margin: 0.05in 0; }
      .barcode {
        margin-top: 0.15in;
        text-align: center;
        font-family: 'Libre Barcode 128', monospace;
        font-size: 48pt;
      }
    }

    @media screen {
      body { display: none; } /* Hide preview on screen */
    }
  </style>
  <!-- Include Barcode Font -->
  <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
</head>
<body>
  <div class="item-key">{{ItemKey}}</div>
  <div class="quantity">{{PickedQty}} KG</div>
  <div class="batch-no">{{BatchNo}}</div>
  <div class="lot-no">{{LotNo}}</div>
  <div class="meta">{{User}} {{Date}} {{Time}}</div>
  <div class="barcode">*{{ItemKey}}--{{PickedQty}}*</div>
</body>
</html>
```

**Print Execution (Frontend):**
```typescript
async function printIndividualLabel(pickData: PickedItem) {
  // 1. Generate HTML from template
  const labelHtml = generateLabelHtml({
    ItemKey: pickData.itemKey,
    PickedQty: pickData.pickedQty.toFixed(2),
    BatchNo: pickData.batchNo,
    LotNo: pickData.lotNo,
    User: pickData.modifiedBy,
    Date: formatDate(pickData.pickingDate),
    Time: formatTime(pickData.pickingDate)
  });

  // 2. Open print window (hidden iframe method)
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  frameDoc?.open();
  frameDoc?.write(labelHtml);
  frameDoc?.close();

  // 3. Trigger Windows print dialog (or auto-print if configured)
  printFrame.contentWindow?.print();

  // 4. Cleanup after print
  setTimeout(() => document.body.removeChild(printFrame), 1000);
}
```

**Batch Summary Label (Print Button - Enabled when all items picked):**

```html
<!-- Print Template: batch-summary.html -->
<!-- Format matches printsum.png -->
<style>
  @media print {
    @page {
      size: 4in 6in; /* Adjust based on actual label size */
      margin: 0.25in;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
    }
    .header {
      margin-bottom: 0.1in;
    }
    .print-datetime {
      text-align: right;
      font-size: 9pt;
      margin-bottom: 0.05in;
    }
    .product-info {
      font-size: 10pt;
      font-weight: bold;
      margin-bottom: 0.05in;
    }
    .run-info {
      font-size: 9pt;
      margin-bottom: 0.1in;
    }
    table {
      width: 100%;
      font-size: 8pt;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #000;
      padding: 0.03in;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }
    td.qty { text-align: right; }
  }
</style>

<div class="header">
  <!-- Example: 24/09/25  2:15:28PM -->
  <div class="print-datetime">{{PrintDate}}  {{PrintTime}}</div>

  <!-- Example: PRODUCT:  TB44122B   Battermix -->
  <div class="product-info">PRODUCT:  {{ProductCode}}   {{ProductName}}</div>

  <!-- Example: Run # 213989 BATCH:  845983   05/29/25   Page 1 of 4 -->
  <div class="run-info">Run # {{RunNo}} BATCH:  {{BatchNo}}   {{ProdDate}}   Page {{PageNum}} of {{TotalPages}}</div>
</div>

<table>
  <thead>
    <tr>
      <th>Item No.</th>
      <th>BIN</th>
      <th>Lot-No</th>
      <th>QTY</th>
      <th>UM</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{ItemKey}}</td>
      <td>{{BinNo}}</td>
      <td>{{LotNo}}</td>
      <td class="qty">{{PickedQty}}</td>
      <td>KG</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

**Print Button Trigger Function:**

```typescript
// Enabled only when all items are picked
async function handlePrintButtonClick(runNo: number, batchNo: string) {
  // Get all picked items for this batch
  const items = await fetch(`/api/runs/${runNo}/batches/${batchNo}/picked-items`)
    .then(r => r.json());

  // Generate batch summary HTML matching printsum.png format
  const summaryHtml = generateBatchSummaryHtml({
    PrintDate: formatDate(new Date()),       // "24/09/25"
    PrintTime: formatTime(new Date()),       // "2:15:28PM"
    ProductCode: runData.fgItemKey,          // "TB44122B"
    ProductName: runData.fgDescription,      // "Battermix"
    RunNo: runData.runNo,                    // "213989"
    BatchNo: batchNo,                        // "845983"
    ProdDate: formatDate(runData.productionDate), // "05/29/25"
    PageNum: 1,
    TotalPages: Math.ceil(items.length / 10), // 10 items per page
    items: items.map(item => ({
      ItemKey: item.itemKey,
      BinNo: item.binNo,
      LotNo: item.lotNo,
      PickedQty: item.pickedQty.toFixed(2)
    }))
  });

  // Open print dialog
  printDocument(summaryHtml);
}
```

**Print Configuration:**
- **Auto-Print (Individual Labels):** Print immediately on each save (no dialog)
- **Manual Print (Batch Summary):**
  - Print button DISABLED during picking (grayed out)
  - Print button ENABLED when all items picked (ItemBatchStatus = 'Allocated')
  - Shows Windows print dialog when clicked
  - Prints summary format matching printsum.png
- **Printer Selection:** Use Windows default printer or allow user selection via print dialog
- **Fallback:** If print fails, offer "Download PDF" option (browser PDF generator)

**Browser Print Compatibility:**
- Chrome/Edge: `window.print()` + `@media print` CSS
- Firefox: Same approach (well-supported)
- Printer Requirements: Any Windows-compatible printer (not limited to Zebra)
- Barcode Font: Libre Barcode 128 (free, web font or locally installed)

---

#### 8. **View Lots Modal - Picked Item Details**

**Purpose:** Display all picked lots for the current run with options to re-print labels or delete (unpick) individual items.

**Trigger:** Click "VIEW LOTS" button in center panel (see ViewLots.png)

**Modal Layout (Two-Panel Split View):**

**Left Panel - "Picked Lot Details":**
- Displays all PICKED items (ItemBatchStatus = 'Allocated')
- Table columns:
  - Batch No (e.g., 843855, 843856)
  - Lot No (e.g., 2510403, 2510403-1)
  - Item Key (e.g., INSALT02, INSAPP01)
  - Location Key (e.g., TFC1)
  - Expiry Date (YY-MM-DD format, e.g., 23-04-28)
  - Qty Received (picked quantity in KG, e.g., 20.0000)
  - Bin No (e.g., PWBB-12, PWBB-08)
  - Pack Size (e.g., 25.00)
- Row selection: Click row to select (highlighted in blue)
- Multi-select: Ctrl+Click or Shift+Click for multiple rows

**Right Panel - "Pending To Picked":**
- Displays all PENDING items (ItemBatchStatus = NULL or not 'Allocated')
- Same column structure as left panel
- Read-only view (no actions available on pending items)

**Data Retrieval SQL:**

```sql
-- Get picked lot details (left panel)
SELECT
    pl.RunNo,
    pl.RowNum,
    pl.BatchNo,
    pl.LineId,
    pl.LotNo,
    pl.ItemKey,
    pl.LocationKey,
    pl.BinNo,
    pl.DateExpiry,
    pl.QtyReceived,
    pl.AllocLotQty,
    pl.RecDate AS PickingDate,
    cp.PackSize
FROM Cust_PartialLotPicked pl
INNER JOIN cust_PartialPicked cp
    ON pl.RunNo = cp.RunNo
    AND pl.RowNum = cp.RowNum
    AND pl.LineId = cp.LineId
WHERE pl.RunNo = @RunNo
ORDER BY pl.BatchNo, pl.ItemKey, pl.LineId;

-- Get pending items (right panel)
SELECT
    cp.RunNo,
    cp.RowNum,
    cp.BatchNo,
    cp.LineId,
    cp.ItemKey,
    cp.LocationKey,
    cp.ToPickedPartialQty,
    cp.PackSize
FROM cust_PartialPicked cp
WHERE cp.RunNo = @RunNo
    AND (cp.ItemBatchStatus IS NULL OR cp.ItemBatchStatus != 'Allocated')
ORDER BY cp.BatchNo, cp.ItemKey, cp.LineId;
```

**Bottom Action Buttons:**

1. **Re-Print Button (Orange checkmark icon):**
   - Enabled when: One or more picked items selected in left panel
   - Action: Re-prints individual label(s) for selected item(s)
   - Uses same template as auto-print (4x4" individual label)
   - Print sequence: One label per selected row

   ```typescript
   async function handleRePrint(selectedItems: PickedItem[]) {
     for (const item of selectedItems) {
       await printIndividualLabel({
         ItemKey: item.itemKey,
         PickedQty: item.qtyReceived,
         BatchNo: item.batchNo,
         LotNo: item.lotNo,
         User: item.recUserId,
         Date: formatDate(item.pickingDate),
         Time: formatTime(item.pickingDate)
       });
     }
     showNotification(`Re-printed ${selectedItems.length} label(s)`);
   }
   ```

2. **Delete Button (Red X icon):**
   - Enabled when: One or more picked items selected in left panel
   - Action: Unpicks selected item(s) - reverses picking transaction
   - Confirmation dialog: "Delete {{count}} picked item(s)? This will restore inventory."
   - On confirm: Executes unpick transaction for each selected item
   - Updates both panels after deletion (moves items from left to right)

   ```typescript
   async function handleDeletePicked(selectedItems: PickedItem[]) {
     const confirmed = await confirmDialog(
       `Delete ${selectedItems.length} picked item(s)? This will restore inventory.`
     );

     if (confirmed) {
       for (const item of selectedItems) {
         await unpickItem(item.runNo, item.rowNum, item.lineId);
       }

       // Refresh both panels
       await refreshViewLotsModal(currentRunNo);
       showNotification(`${selectedItems.length} item(s) unpicked successfully`);
     }
   }
   ```

3. **Ok Button (Green checkmark icon):**
   - Always enabled
   - Action: Closes the View Lots modal
   - No confirmation required
   - Returns to main picking screen

**Modal Behavior:**
- Modal size: 900px wide × 600px high (optimized for 1280x1024)
- Modal backdrop: Semi-transparent dark overlay
- Close triggers: Ok button, Escape key, click outside modal
- Auto-refresh: Panels update in real-time after delete operation

**Real Example (Run 213972 from ViewLots.png):**

**Picked Lot Details (Left Panel):**
- Batch 843855: INSALT02 (Lot 2510403), INSAPP01 (Lot 2510591), etc.
- Batch 843856: INSALT02 (Lot 2510403-1), INSAPP01 (Lot 2510591), etc.
- Total: 14 picked items shown

**Pending To Picked (Right Panel):**
- Empty (all items already picked in this example)

**Use Cases:**
1. **Re-print lost label:** User selects INSALT02 row → Click Re-Print → New label prints
2. **Unpick wrong item:** User selects INSAPP01 row → Click Delete → Confirm → Item unpicked, inventory restored
3. **Bulk re-print:** User selects multiple rows (Ctrl+Click) → Click Re-Print → All selected labels print
4. **Review picked items:** Open modal to verify all items picked correctly before final print

---

#### 9. **Unpick/Delete Functionality**

**Per-Line Delete Operation (via View Lots Modal):**

**UI Interaction:**
- Select item(s) in View Lots modal left panel
- Click Delete button (red X icon)
- Confirmation dialog: "Delete {{count}} picked item(s)? This will restore inventory."
- Row removal animation: Selected rows fade out and move to pending panel

**Backend Delete Transaction (Reverse 4-Phase Pattern):**

```rust
async fn unpick_item(
    State(pool): State<SqlConnectionPool>,
    Path((run_no, row_num, line_id)): Path<(i32, i32, i32)>,
) -> Result<StatusCode, AppError> {
    let mut tx = pool.begin().await?;

    // Step 1: Get lot allocation details BEFORE deleting
    let lot_alloc = sqlx::query!(
        "SELECT LotNo, ItemKey, LocationKey, BinNo, AllocLotQty
         FROM Cust_PartialLotPicked
         WHERE RunNo = @p1 AND RowNum = @p2 AND LineId = @p3",
        run_no, row_num, line_id
    ).fetch_one(&mut tx).await?;

    // Step 2: Reset PickedPartialQty to 0 (preserve audit trail)
    sqlx::query!(
        "UPDATE cust_PartialPicked
         SET PickedPartialQty = 0
         WHERE RunNo = @p1 AND RowNum = @p2 AND LineId = @p3",
        run_no, row_num, line_id
    ).execute(&mut tx).await?;

    // Step 3: Restore LotMaster.QtyCommitSales
    sqlx::query!(
        "UPDATE LotMaster
         SET QtyCommitSales = QtyCommitSales - @p1
         WHERE LotNo = @p2 AND ItemKey = @p3
           AND LocationKey = @p4 AND BinNo = @p5",
        lot_alloc.AllocLotQty,
        lot_alloc.LotNo,
        lot_alloc.ItemKey,
        lot_alloc.LocationKey,
        lot_alloc.BinNo
    ).execute(&mut tx).await?;

    // Step 4: Delete lot allocation record
    sqlx::query!(
        "DELETE FROM Cust_PartialLotPicked
         WHERE RunNo = @p1 AND RowNum = @p2 AND LineId = @p3",
        run_no, row_num, line_id
    ).execute(&mut tx).await?;

    // Step 5: Delete lot transaction record
    let batch_no = get_batch_no(run_no, row_num, &mut tx).await?;
    sqlx::query!(
        "DELETE FROM LotTransaction
         WHERE IssueDocNo = @p1 AND IssueDocLineNo = @p2",
        batch_no, line_id
    ).execute(&mut tx).await?;

    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}
```

**Audit Trail Preservation:**
- `ItemBatchStatus` remains "Allocated" (shows it was picked then unpicked)
- `PickingDate` preserved (when it was originally picked)
- `ModifiedBy` and `ModifiedDate` unchanged (who picked it)
- Only `PickedPartialQty` reset to 0

**Visual Feedback:**
- Row changes to "Unpicked" state (orange border, strikethrough on qty)
- Available quantity updates immediately in lot selection dropdown
- Grid refreshes to show updated status

**Bulk Delete ("Unpick All RM" Button):**
- Iterates through all picked items in current batch
- Shows progress: "Unpicking 3/8 items..."
- Final confirmation: "All items unpicked. Inventory restored."

---

#### 10. **Search Modal Specifications**

**Overview:** Four search modals provide users with search/browse functionality for Run, Item, Lot, and Bin selection. Column names and SQL retrieval patterns match the proven bulk picking system.

**Display Target:** 17-inch monitors at 1280x1024 resolution (React + Tailwind CSS implementation).

---

##### **A. Run No Search Modal**

**Purpose:** Browse and select from available partial picking runs.

**Columns:**
- **Run No:** Run number identifier (primary key)
- **FG Item Key:** Finished Goods item code (from `FormulaId` field)
- **FG Item Description:** Product description (from `FormulaDesc` field)
- **Status:** Run status ('NEW', 'PRINT')
- **Batch Count:** Number of batches in the run

**SQL Retrieval (Paginated):**
```sql
SELECT DISTINCT
    RunNo,
    FormulaId,              -- Maps to FG Item Key
    FormulaDesc,            -- Maps to FG Item Description
    Status,
    COUNT(*) as BatchCount
FROM cust_PartialRun        -- Note: lowercase 'c'
WHERE Status IN ('NEW', 'PRINT')
GROUP BY RunNo, FormulaId, FormulaDesc, Status
ORDER BY RunNo DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
```

**Search Behavior:**
- Client-side partial matching on: RunNo, FormulaId, FormulaDesc
- Case-insensitive search
- Real-time filtering as user types

---

##### **B. Item Key (Ingredient) Search Modal**

**Purpose:** Browse and select ingredients for current run.

**Columns:**
- **Item Key:** Raw material/ingredient code (from `ItemKey`)
- **Description:** Item description (from `INMAST.Desc1`)
- **Line ID:** Picking line identifier
- **Location:** Storage location (optional display - TFC1)

**SQL Retrieval:**
```sql
SELECT
    bp.ItemKey,
    bp.LineId,
    im.Desc1 as Description,
    bp.LocationKey as Location,
    bp.ToPickedPartialQty,
    bp.PickedPartialQty
FROM cust_PartialPicked bp      -- Note: lowercase 'c'
INNER JOIN INMAST im
    ON bp.ItemKey = im.ItemKey
WHERE bp.RunNo = @runNo
    AND bp.ToPickedPartialQty > 0
ORDER BY bp.LineId ASC
```

**Display Logic:**
- Show all ingredients (both complete and incomplete)
- Highlight completed ingredients (green background)
- Filter option: "Show only unpicked" (ToPickedPartialQty > PickedPartialQty)

---

##### **C. Lot No Search Modal**

**Purpose:** Browse and select lots for current ingredient with FEFO compliance.

**Columns:**
- **Lot No:** Lot number identifier
- **Bin No:** Storage bin location
- **Date Expiry:** Lot expiration date (YYYY-MM-DD format)
- **QtyOnHand:** Physical stock quantity in KG
- **CommittedQty:** Reserved quantity (QtyCommitSales)
- **Qty Available:** Calculated usable stock (QtyOnHand - QtyCommitSales)
- **Pack Size:** Standard pack size for this item (from INMAST.User9 or cust_PartialPicked.PackSize)

**SQL Retrieval (FEFO Algorithm):**
```sql
SELECT
    l.LotNo,
    l.BinNo,
    l.DateExpiry,
    l.QtyOnHand,                                            -- Physical stock
    l.QtyCommitSales as CommittedQty,                       -- Reserved stock
    (l.QtyOnHand - l.QtyCommitSales) as QtyAvailable,      -- Real-time calculation
    bp.PackSize
FROM LotMaster l
INNER JOIN cust_PartialPicked bp
    ON l.ItemKey = bp.ItemKey
INNER JOIN cust_PartialRun pr
    ON bp.RunNo = pr.RunNo
INNER JOIN BINMaster b
    ON l.BinNo = b.BinNo
    AND l.LocationKey = b.Location
WHERE l.ItemKey = @itemKey
    AND pr.RunNo = @runNo
    AND bp.ToPickedPartialQty > 0
    AND l.LocationKey = 'TFC1'
    AND b.User1 = 'WHTFC1'
    AND b.User4 = 'PARTIAL'
    -- Stock Validation
    AND l.QtyOnHand > 0
    AND (l.QtyOnHand - l.QtyCommitSales) > 0
    -- Lot Status Validation
    AND (l.LotStatus IN ('P', 'C', '') OR l.LotStatus IS NULL)
    AND l.LotStatus NOT IN ('B', 'D', 'E', 'F', 'H', 'L', 'T', 'W')
    -- Expiry Validation
    AND (l.DateExpiry IS NULL OR l.DateExpiry >= GETDATE())
ORDER BY
    l.DateExpiry ASC,                                       -- FEFO PRIMARY: Earliest expiry first
    (l.QtyOnHand - l.QtyCommitSales) DESC                  -- FEFO TIEBREAKER: Highest available qty
```

**Visual Indicators:**
- Expiry Date Color Coding:
  - Red: < 30 days until expiry
  - Yellow: 30-90 days until expiry
  - Green: > 90 days or no expiry
- QtyAvailable displayed prominently (bold)

**Pagination:** Server-side pagination (10 lots per page, configurable)

---

##### **D. Bin No Search Modal**

**Purpose:** Browse bins for a selected lot (rare use case - typically auto-selected by FEFO).

**Columns:**
- **Bin No:** Storage bin identifier
- **Date Expiry:** Lot expiration date
- **QtyOnHand:** Physical stock in bin
- **CommittedQty:** Reserved quantity
- **Qty Available:** Usable stock (calculated)

**SQL Retrieval:**
```sql
SELECT
    l.BinNo,
    l.DateExpiry,
    l.QtyOnHand,
    l.QtyCommitSales as CommittedQty,
    (l.QtyOnHand - l.QtyCommitSales) as QtyAvailable
FROM LotMaster l
INNER JOIN BINMaster b
    ON l.BinNo = b.BinNo
    AND l.LocationKey = b.Location
WHERE l.LotNo = @lotNo
    AND l.ItemKey = @itemKey
    AND l.LocationKey = 'TFC1'
    AND b.User1 = 'WHTFC1'
    AND b.User4 = 'PARTIAL'
    AND l.QtyOnHand > 0
    AND (l.QtyOnHand - l.QtyCommitSales) > 0
ORDER BY
    l.DateExpiry ASC,
    (l.QtyOnHand - l.QtyCommitSales) DESC
```

**Note:** This modal is typically not needed since FEFO algorithm auto-selects optimal bin. Provided for manual override scenarios (supervisor use).

---

**Modal Interaction Patterns (All Modals):**

1. **Open Trigger:**
   - Click search button (🔍 icon) next to input field
   - Click on read-only field (e.g., clicking Run No field opens Run Search)

2. **Selection:**
   - Click row to select
   - Modal auto-closes on selection
   - Selected value populates corresponding form field
   - Subsequent fields auto-populate or auto-search

3. **Search/Filter:**
   - Live search input at top of modal
   - Client-side filtering (instant results) for small datasets
   - Server-side search for large datasets (>100 records)

4. **Responsive Design:**
   - Fixed modal height with scrollable content area
   - Sticky header row
   - Optimized for 1280x1024 (primary) and 1920x1080 (secondary)
   - Mobile/tablet support: Phase 2

5. **Close Actions:**
   - Click ✕ button (top-right)
   - Click outside modal (backdrop)
   - Press Escape key
   - Select item (auto-close)

---

### Out of Scope for MVP

**Explicitly excluded from initial release:**

1. **Mobile/Tablet Responsive Layout**
   - Phase 2: Supervisor dashboard on tablets
   - MVP: Desktop-only (1280x1024 optimization)

2. **Barcode Scanner Hardware Integration**
   - MVP: Manual text input for lot numbers (keyboard entry)
   - Phase 2: USB/Bluetooth scanner support with HID events

3. **Multi-Language Support**
   - MVP: English only
   - Phase 2: Thai, Chinese based on operator demographics

4. **Advanced Analytics Dashboard**
   - MVP: Basic operational data (picks completed, current status)
   - Phase 2: Performance metrics, trend analysis, operator efficiency

5. **Voice-Guided Picking**
   - Phase 3: Hands-free operation with voice commands
   - MVP: Traditional keyboard/mouse interaction

6. **Multi-Warehouse Support**
   - MVP: TFC1 warehouse only (hardcoded filter)
   - Phase 2: WHSCG, WHTIP8, WHKON1 expansion

7. **Predictive Inventory/AI Features**
   - Phase 3: ML-based stock forecasting, demand prediction
   - MVP: Rule-based FEFO only

8. **Custom Branding/Theming**
   - MVP: Fixed brown/orange color scheme (matching NewApp-UI.png)
   - Phase 2: Configurable themes per customer/warehouse

9. **Integration Beyond SQL Server**
   - MVP: Direct SQL Server database access only
   - Phase 3: API integrations (WMS, ERP, SAP)

10. **Audit Report Generation**
    - MVP: Basic data in database (can query manually)
    - Phase 2: PDF/Excel export, scheduled reports

### MVP Success Criteria

**Definition of "Done" for MVP:**

1. **Functional Completeness:**
   - ✅ Complete picking workflow: Scan lot → Auto-select bin → Fetch weight → Save → Print label
   - ✅ FEFO bin selection works 100% correctly (earliest expiry, available qty filtering)
   - ✅ Real-time weight updates <500ms latency on both SMALL/BIG scales
   - ✅ Windows print system generates 4x4" labels (individual + batch summary)
   - ✅ Unpick/delete correctly reverses inventory commitment (QtyCommitSales)

2. **Performance Benchmarks:**
   - ✅ API response time <200ms (p95) for all picking operations
   - ✅ UI renders correctly at 1280x1024 without scrolling for main operations
   - ✅ Support 4 concurrent workstations without degradation
   - ✅ PWA service worker caches static assets (offline capability for UI shell)

3. **Data Integrity:**
   - ✅ Zero regression from legacy app (all PickingFlow.md patterns replicated)
   - ✅ QtyCommitSales accuracy: 100% correct increment/decrement across 100 test picks
   - ✅ Composite primary key queries work (RunNo+RowNum+LineId)
   - ✅ Lowercase table name `cust_PartialPicked` used correctly

4. **User Acceptance:**
   - ✅ Complete 10 consecutive production runs without errors
   - ✅ Operators can complete batches in ≤24 minutes (20% faster than baseline 30 min)
   - ✅ Zero FEFO compliance violations during UAT period (2 weeks)
   - ✅ 90%+ operator satisfaction score (survey after 2 weeks)

5. **Deployment Success:**
   - ✅ PWA installs on all 4 workstations (WS1-WS4) via browser prompt
   - ✅ .NET bridge service runs as Windows Service on each workstation
   - ✅ Labels print successfully on existing Zebra printers (or any Windows printer)
   - ✅ Update deployment: Code push → All workstations updated in <5 minutes

**Acceptance Testing Scenarios:**

**Scenario 1: Happy Path Pick**
1. Operator scans lot "2510403-1" for item INSALT02
2. System auto-selects bin PWBB-12 (earliest expiry: 2028-04-23, 568.927 KG available)
3. Operator places item on scale, weight shows 20.002 KG (green, stable)
4. Operator clicks "Fetch Weight" → Weight captured: 20.002 KG
5. Operator clicks "Add Lot" → Row added to grid
6. Operator clicks "Save" → Transaction commits, individual label auto-prints
7. **Pass Criteria:** Label prints with barcode *INSALT02--20.00*, QtyCommitSales increments by 20.002

**Scenario 2: Out of Tolerance**
1. Operator scans lot, bin auto-selected
2. Weight shows 19.950 KG (red, below 19.975 min)
3. "Fetch Weight" button disabled
4. Visual message: "⚠ Too light! Add 0.025 KG"
5. **Pass Criteria:** Cannot proceed until weight in range

**Scenario 3: Unpick Operation**
1. Operator clicks trash icon on completed pick (INSALT02, 20.00 KG)
2. Confirmation dialog: "Unpick INSALT02 (20.00 KG)? This will restore inventory."
3. Operator confirms → PickedPartialQty reset to 0, QtyCommitSales decrements by 20.00
4. **Pass Criteria:** Bin PWBB-12 available qty increases from 568.927 → 588.927 KG

**Scenario 4: FEFO with Multiple Bins**
1. Lot "2510226" exists in 3 bins:
   - PWBB-10: Expiry 2026-08-15, 150 KG available
   - PWBA-03: Expiry 2026-08-15, 300 KG available (same expiry)
   - PWBE-05: Expiry 2026-09-20, 500 KG available (later expiry)
2. Operator scans lot "2510226"
3. **Pass Criteria:** System selects PWBA-03 (earliest expiry, highest qty as tiebreaker)

**Scenario 5: Offline Mode**
1. Network disconnected while viewing picking screen
2. UI shows cached run data (last synced)
3. Weight scale WebSocket reconnects when network restored
4. **Pass Criteria:** No crash, clear offline indicator, auto-reconnect <5 seconds

---

## Post-MVP Vision

### Phase 2 Features (Months 3-4)

**1. Mobile Supervisor Dashboard**
- Tablet/phone responsive layout (Bootstrap breakpoints)
- Real-time view of all workstation statuses
- Drill-down to individual operator performance
- Push notifications for stuck batches or errors

**2. Barcode Scanner Integration**
- USB/Bluetooth HID scanner support
- Auto-focus lot number field on scan event
- Scan-to-print: Scan batch barcode to trigger summary label print
- Configurable scanner settings per workstation

**3. Advanced Weight Tolerance**
- Per-item tolerance configuration (override INMAST.User9)
- Dynamic tolerance based on item type (raw materials vs finished goods)
- Tolerance warning levels (yellow at 80%, red at 100%)
- Supervisor override for out-of-tolerance picks (with reason code)

**4. Enhanced Lot Management**
- Visual bin map: 3D warehouse layout showing lot locations
- Lot merge/split operations for partial usage
- Lot hold/release workflow (quarantine management)
- Expiry date alerts (30/60/90 day warnings)

**5. Performance Analytics**
- Operator efficiency metrics: Picks per hour, accuracy rate
- Batch completion time trends (by operator, by item, by time of day)
- FEFO compliance reports (audit trail for regulators)
- Export to Excel/PDF for management review

### Long-term Vision (6-12 months)

**Year 1 (Months 6-12):**

**1. Multi-Warehouse Expansion**
- Support for WHSCG, WHTIP8, WHKON1, WHMBL locations
- Cross-warehouse inventory visibility
- Inter-warehouse transfer workflows
- Warehouse-specific bin filtering logic

**2. Predictive Inventory & AI**
- ML model for stock level forecasting (predict when lot will deplete)
- Anomaly detection: Flag unusual picking patterns (potential errors)
- Intelligent lot suggestion: Beyond FEFO, consider bin proximity + operator location
- Demand prediction: Forecast which items will be picked next (pre-fetch data)

**3. Voice-Guided Picking**
- Hands-free operation via speech recognition
- Voice commands: "Scan lot 2510403", "Fetch weight", "Save"
- Audio feedback: "Weight is 20 kilograms, within range"
- Multilingual support (English, Thai, Chinese)

**4. Digital Twin Visualization**
- 3D warehouse map with real-time inventory heatmap
- Visual picking route optimization (shortest path to all bins)
- Bin occupancy visualization (color-coded by fill level)
- AR overlay for mobile devices (point camera at bin, see inventory)

**5. Integration Hub**
- Bidirectional ERP sync (SAP, Oracle, Dynamics)
- WMS integration (automated replenishment signals)
- MES connectivity (manufacturing execution system triggers)
- IoT sensor integration (temperature, humidity for cold storage items)

### Expansion Opportunities

**1. Horizontal Scaling (Other Industries)**
- **Food & Beverage:** Current use case, expand to other F&B manufacturers
- **Pharmaceuticals:** GMP-compliant version with batch genealogy tracking
- **Chemicals:** Hazmat handling with safety validation workflows
- **Automotive:** Parts picking with BOM-based kitting

**2. White-Label SaaS Platform**
- Multi-tenant architecture (per-customer database isolation)
- Configurable workflows via low-code UI builder
- Subscription pricing: $50/workstation/month
- Self-service onboarding with setup wizard

**3. Partner Ecosystem**
- **Scale Manufacturers:** Partnership with Mettler Toledo, Avery Weigh-Tronix
- **Label Printer OEMs:** Zebra, Brother, Dymo integration marketplace
- **Barcode Scanner Vendors:** Co-marketing with Honeywell, Datalogic
- **System Integrators:** Channel sales through warehouse automation consultants

**4. Hardware Product Line**
- Ruggedized tablet with integrated barcode scanner (branded device)
- All-in-one workstation: Touchscreen PC + scale + printer bundle
- Wireless scale with Bluetooth → Eliminate .NET bridge service dependency
- RFID reader add-on for pallet tracking

**5. Advanced Features (Beyond Picking)**
- **Putaway Optimization:** Suggest optimal bin placement for incoming goods
- **Cycle Counting:** Automated inventory audit workflows
- **Replenishment:** Auto-generate transfer orders when bins run low
- **Returns Processing:** Reverse picking for damaged/expired goods

---

## Technical Considerations

### Platform Requirements

**Target Platform:**
- **Primary:** Desktop web browsers on Windows 10/11 workstations
- **Resolution:** 17-inch monitors at 1280x1024 (5:4 aspect ratio)
- **Future:** Tablets (10-12 inch, 1366x768) for supervisor dashboard (Phase 2)

**Browser/OS Support:**

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| **Chrome** | 90+ | Primary target, best PWA support |
| **Edge** | 90+ | Chromium-based, equivalent to Chrome |
| **Firefox** | 88+ | Good PWA support, test thoroughly |
| ~~Safari~~ | N/A | Out of scope (macOS not used in warehouse) |
| ~~IE 11~~ | ❌ | No support (security/performance issues) |

**Operating System:**
- **Production:** Windows 10/11 Pro (workstations WS1-WS4)
- **Development:** Windows 10/11, Linux (Ubuntu 20.04+), WSL2

**Performance Requirements:**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **API Response Time** | <200ms (p95) | Axum middleware logging |
| **Weight Update Latency** | <500ms (p95) | WebSocket message timestamp delta |
| **Page Load Time (Initial)** | <2 seconds | Lighthouse CI, service worker disabled |
| **Page Load Time (Cached)** | <500ms | Lighthouse CI, service worker enabled |
| **UI Interaction Response** | <100ms | React DevTools profiler |
| **Concurrent Users** | 4 (MVP), 8 (Phase 2) | Load testing with k6 |
| **Database Connections** | Max 10 pooled connections | SQL Server monitoring |
| **Memory Usage (Frontend)** | <200 MB per tab | Chrome DevTools Memory |
| **Memory Usage (Backend)** | <512 MB (Rust process) | htop monitoring |

**Network Requirements:**
- **Bandwidth:** 1 Mbps minimum per workstation (for WebSocket + API)
- **Latency:** <50ms to database server (192.168.0.86)
- **Offline Tolerance:** 5 minutes cached operation (read-only), then force sync

---

### Technology Preferences

#### **Frontend Stack**

**Core Framework:**
- **React 19** (latest stable, with concurrent features)
- **TypeScript 5.3+** (strict mode enabled)
- **Vite 5.x** (build tool, HMR for development)

**UI & Styling:**
- **Tailwind CSS 3.4+** (utility-first CSS)
  - Custom theme config for 1280x1024 breakpoint
  - Brown/orange color palette (matching NewApp-UI.png)
  - Custom components: `tw-progress-bar`, `tw-weight-display`
- **Headless UI** (accessible components: dialogs, dropdowns)
- **React Hook Form** (form state management)
- **Zod** (validation schemas, type-safe)

**State Management:**
- **TanStack Query (React Query) v5** (server state, caching)
- **Zustand** (client state, UI state only)
- **WebSocket:** Custom React hook for scale integration

**PWA & Offline:**
- **Vite PWA Plugin** (service worker generation)
- **Workbox** (caching strategies: Cache First for static, Network First for API)
- **IndexedDB** (offline run data storage via `idb` library)

**Developer Experience:**
- **ESLint** + **Prettier** (code quality)
- **Vitest** (unit testing, fast Vite-native)
- **Playwright** (E2E testing, cross-browser)
- **Storybook** (component documentation, UI testing)

**Example `package.json` (frontend):**
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "tailwindcss": "^3.4.0",
    "@headlessui/react": "^1.7.0",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vite-plugin-pwa": "^0.17.0",
    "@playwright/test": "^1.40.0",
    "vitest": "^1.0.0"
  }
}
```

---

#### **Backend Stack**

**Core Framework:**
- **Rust 1.75+** (latest stable)
- **Axum 0.7.x** (ergonomic web framework, Tower-based)
- **Tokio 1.35+** (async runtime)

**Database:**
- **Tiberius 0.12.x** (pure Rust SQL Server client)
- **SQLx** (query macros, compile-time verification - if tiberius insufficient)
- **Connection Pooling:** `bb8` crate (generic pool) or `deadpool` (Tokio-specific)

**Serialization & Validation:**
- **Serde** (JSON serialization)
- **Validator** (request validation, derive macros)
- **Chrono** (date/time handling for PickingDate, DateExpiry)

**Middleware & Cross-Cutting:**
- **Tower** (middleware: CORS, compression, timeout)
- **Tower-HTTP** (CORS layer, trace layer for logging)
- **Tracing** (structured logging, spans for request tracing)
- **Tracing-Subscriber** (log output formatting)

**WebSocket Proxy:**
- **Tokio-Tungstenite** (WebSocket client to .NET bridge)
- **Axum WebSocket** (serve WebSocket to frontend)
- **Relay Pattern:** Frontend ↔ Rust Axum ↔ .NET Bridge ↔ Serial Scales

**Testing:**
- **Tokio-Test** (async test utilities)
- **HTTPie / cURL** (manual API testing)
- **k6** (load testing, Grafana integration)

**Example `Cargo.toml` (backend):**
```toml
[dependencies]
axum = "0.7"
tokio = { version = "1.35", features = ["full"] }
tiberius = "0.12"
bb8 = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
validator = { version = "0.16", features = ["derive"] }
chrono = "0.4"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "compression-gzip"] }
tracing = "0.1"
tracing-subscriber = "0.3"
tokio-tungstenite = "0.21"
dotenvy = "0.15"

[dev-dependencies]
tokio-test = "0.4"
```

---

#### **Database Configuration**

**SQL Server Connection:**
- **Server:** 192.168.0.86:49381
- **Database:** TFCPILOT3
- **Credentials:** User=NSW, Password=B3sp0k3 (from .env, never in code)
- **TLS:** `TrustServerCertificate=True` (internal network, self-signed cert)

**Connection Pool Settings:**
```rust
// Rust tiberius pool configuration
let config = Config::new();
config.host("192.168.0.86");
config.port(49381);
config.database("TFCPILOT3");
config.authentication(AuthMethod::sql_server("NSW", "B3sp0k3"));
config.trust_cert(); // Accept self-signed cert

let pool = bb8::Pool::builder()
    .max_size(10)          // Max 10 connections (4 workstations × 2-3 concurrent queries)
    .min_idle(Some(2))     // Keep 2 idle connections warm
    .connection_timeout(Duration::from_secs(5))
    .build(tiberius_connector)
    .await?;
```

**Query Patterns:**

**Critical Table Name (Case-Sensitive):**
```rust
// ❌ WRONG - will fail on case-sensitive collation
sqlx::query("SELECT * FROM Cust_PartialPicked WHERE RunNo = @p1")

// ✅ CORRECT - lowercase 'c' per database-schema.md
sqlx::query("SELECT * FROM cust_PartialPicked WHERE RunNo = @p1")
```

**Prepared Statements (Prevent SQL Injection):**
```rust
// Use parameterized queries, never string concatenation
let result = query!(
    "SELECT * FROM cust_PartialPicked
     WHERE RunNo = @p1 AND RowNum = @p2 AND LineId = @p3",
    run_no, row_num, line_id
).fetch_one(&mut conn).await?;
```

**Transaction Isolation:**
- **Default:** READ COMMITTED (SQL Server default)
- **Picking Operations:** Use explicit transactions (`BEGIN TRANSACTION ... COMMIT`)
- **Long-Running Queries:** Add `SET LOCK_TIMEOUT 5000` (5 sec timeout to prevent deadlocks)

---

#### **Hosting/Infrastructure**

**Development Environment:**
- **Frontend:** Vite dev server (`npm run dev` on `http://localhost:5173`)
- **Backend:** Cargo watch (`cargo watch -x run` on `http://localhost:3000`)
- **Database:** Connect to production TFCPILOT3 (no local SQL Server needed)
- **.NET Bridge:** Run locally as Windows Service or `dotnet run` (port 5000)

**Production Deployment:**

**Container Strategy (Docker Compose):**
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Frontend (React PWA)
  frontend:
    image: partial-picking-frontend:latest
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"     # HTTP
      - "443:443"   # HTTPS (required for PWA service worker)
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro  # TLS certificates
    environment:
      - BACKEND_URL=http://backend:3000
    depends_on:
      - backend

  # Backend (Rust API)
  backend:
    image: partial-picking-backend:latest
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_SERVER=192.168.0.86
      - DATABASE_PORT=49381
      - DATABASE_NAME=TFCPILOT3
      - DATABASE_USERNAME=NSW
      - DATABASE_PASSWORD=B3sp0k3
      - BRIDGE_SERVICE_URL=ws://192.168.0.1:5000  # .NET bridge on each workstation
    env_file:
      - .env

  # .NET Bridge Service (runs on each workstation, NOT in Docker)
  # Deployed via existing installer-package/
```

**Frontend Dockerfile (Nginx):**
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile (Rust):**
```dockerfile
# backend/Dockerfile
FROM rust:1.75-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev openssl-dev
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/partial-picking-api /usr/local/bin/
EXPOSE 3000
CMD ["partial-picking-api"]
```

**HTTPS/TLS Setup:**
- **Cert Source:** Self-signed (internal network) or Let's Encrypt (if accessible)
- **Nginx Config:** Redirect HTTP → HTTPS, serve PWA manifest at `/.well-known/`
- **Service Worker Requirement:** HTTPS mandatory for PWA (or localhost in dev)

**.NET Bridge Service Deployment:**
- **Installer:** Use existing `installer-package/` Windows Service setup
- **Per Workstation:** Runs as `pk-bridge-service.exe` (Windows Service)
- **Configuration:** `appsettings.json` or environment variables for COM port, scale settings
- **No Docker:** Direct Windows Service (requires access to serial ports)

**Deployment Workflow:**
1. Build Docker images: `docker-compose build`
2. Push to internal registry (if available) or transfer to server
3. Deploy to production server: `docker-compose up -d`
4. Install .NET bridge service on each workstation (one-time, via installer)
5. PWA auto-updates on refresh (service worker fetches new version)

---

### Architecture Considerations

#### **Repository Structure**

**Monorepo Layout:**
```
partial-picking/
├── frontend/                 # React PWA
│   ├── src/
│   │   ├── components/       # UI components (Button, ProgressBar, etc.)
│   │   ├── features/         # Feature modules (picking, lots, labels)
│   │   ├── hooks/            # Custom hooks (useWebSocket, useScale)
│   │   ├── services/         # API client (axios/fetch wrappers)
│   │   ├── stores/           # Zustand stores (ui state)
│   │   ├── types/            # TypeScript types (shared with backend)
│   │   └── utils/            # Helpers (date format, validation)
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── icons/            # App icons (192x192, 512x512)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                  # Rust API
│   ├── src/
│   │   ├── handlers/         # Axum route handlers (picking, lots, labels)
│   │   ├── models/           # Database models (PickedItem, LotMaster)
│   │   ├── services/         # Business logic (FEFO selector, inventory commit)
│   │   ├── db/               # Database pool, queries
│   │   ├── websocket/        # WebSocket proxy to .NET bridge
│   │   ├── middleware/       # CORS, auth, logging
│   │   └── main.rs           # Axum server setup
│   ├── Cargo.toml
│   ├── .env.example
│   └── Dockerfile
│
├── shared/                   # Shared TypeScript types (generated from Rust)
│   ├── types.ts              # API request/response types
│   └── README.md
│
├── Weight-scale/             # Existing .NET bridge service (READ-ONLY)
│   └── bridge-service/       # Do NOT modify, use as-is
│
├── installer-package/        # Existing installer (READ-ONLY)
│   ├── bridge-service/       # Windows Service installer
│   └── config-wizard/        # Setup wizard
│
├── docs/
│   ├── database-schema.md    # Existing schema docs
│   ├── PickingFlow.md        # Existing workflow docs
│   ├── project-brief.md      # This document
│   ├── api-spec.yaml         # OpenAPI spec (to be created)
│   └── deployment.md         # Deployment guide (to be created)
│
├── docker-compose.yml
├── .env.example
└── README.md
```

**Key Principles:**
- **Frontend/Backend Separation:** Clear boundaries, communicate only via REST/WebSocket
- **Existing Services Unchanged:** Do NOT modify Weight-scale/ or installer-package/ (use as-is)
- **Shared Types:** Generate TypeScript types from Rust models (use `ts-rs` crate)
- **Monorepo Benefits:** Shared types, unified versioning, single deployment pipeline

---

#### **Service Architecture**

**3-Tier Architecture:**

```
┌─────────────────────────────────────────────────────┐
│  CLIENT TIER (Browser)                              │
│  ┌───────────────────────────────────────────────┐  │
│  │  React PWA (Vite + Tailwind)                  │  │
│  │  - UI Components (1280x1024 optimized)        │  │
│  │  - State Management (React Query + Zustand)   │  │
│  │  - Service Worker (offline caching)           │  │
│  │  - WebSocket Client (scale integration)       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
            │                           │
            │ HTTPS REST API            │ WebSocket
            │ (JSON)                    │ (real-time weight)
            ↓                           ↓
┌─────────────────────────────────────────────────────┐
│  APPLICATION TIER (Rust Backend)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Axum Web Framework                           │  │
│  │  - REST Endpoints (picking, lots, labels)    │  │
│  │  - WebSocket Proxy (bridge relay)            │  │
│  │  - Business Logic (FEFO, validation)         │  │
│  │  - Database Pool (Tiberius)                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
            │                           │
            │ SQL Queries               │ WebSocket
            │ (Parameterized)           │ (relay to .NET)
            ↓                           ↓
┌─────────────────────────────────────────────────────┐
│  DATA TIER                                          │
│  ┌────────────────────┐   ┌──────────────────────┐  │
│  │  SQL Server        │   │  .NET Bridge Service │  │
│  │  TFCPILOT3         │   │  (Windows Service)   │  │
│  │  192.168.0.86:49381│   │  ┌────────────────┐  │  │
│  │                    │   │  │ Serial Readers │  │  │
│  │  Tables:           │   │  │ COM1, COM2     │  │  │
│  │  - cust_Partial*   │   │  └────────────────┘  │  │
│  │  - LotMaster       │   │  ┌────────────────┐  │  │
│  │  - BINMaster       │   │  │ Scale Poller   │  │  │
│  │  - INMAST          │   │  │ 400ms interval │  │  │
│  └────────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Weight Scale Data Flow (Real-Time):**

```
Serial Scale (SMALL/BIG)
    │ RS-232/USB
    │ (9600 baud, 8N1)
    ↓
.NET Bridge Service (pk-bridge-service.exe)
    │ SerialScaleReader.cs
    │ - Polls every 400ms
    │ - Parses weight string
    │ - Detects stability
    ↓
ScaleBroadcastService.cs
    │ - Maintains client registry
    │ - Filters by scale type (SMALL/BIG)
    │ - Broadcasts JSON: {type:"weight", data:{scaleId, weight, unit, stable}}
    ↓
WebSocket /ws/scale/{small|big}
    │ Port 5000
    ↓
Rust Axum WebSocket Proxy
    │ - Relays to frontend clients
    │ - Adds CORS headers
    │ - Handles reconnection
    ↓
React PWA (useScale hook)
    │ - Updates Zustand store
    │ - Triggers UI re-render
    │ - Updates progress bar
    ↓
Visual Display (1280x1024 UI)
    - Weight: 20.002 KG
    - Status: STABLE, GREEN (within tolerance)
```

---

#### **Dual-Scale Weight Integration (SMALL/BIG Scale Support)**

**Business Requirement:**

Workstations require two physical scales for different ingredient weight ranges:
- **SMALL Scale**: For precision weighing of lighter ingredients
- **BIG Scale**: For bulk weighing of heavier ingredients

Operators must be able to switch between scales instantly during the picking workflow without interrupting the real-time weight display.

**WebSocket Architecture:**

The system maintains **two concurrent WebSocket connections** to support seamless scale switching:

```
Workstation Hardware:
  ├── SMALL Scale → Serial Port (via USB) → .NET Bridge Service → ws://localhost:5000/ws/scale/small
  └── BIG Scale → Serial Port (via USB) → .NET Bridge Service → ws://localhost:5000/ws/scale/big
                                                                         ↓
                                                              React Frontend (dual connections)
                                                                         ↓
                                                              Display active scale weight only
```

**Key Implementation Requirements:**

1. **Dual WebSocket Connections:**
   - Frontend connects to **both** `/ws/scale/small` AND `/ws/scale/big` on initialization
   - Both connections remain **open simultaneously** throughout the session
   - No reconnection needed when switching between scales

2. **Scale Type State Management:**
   - Track active scale type: `'small' | 'big'`
   - Maintain separate weight data streams for each scale
   - Update UI to show only the **active scale's weight**

3. **UI Switcher Component:**
   - Toggle buttons for SMALL/BIG scale selection
   - Visual indicator showing which scale is currently active
   - Click handler updates active scale type state
   - Weight progress bar instantly reflects active scale's data

4. **Weight Data Structure (WebSocket Message):**
   ```json
   {
     "type": "weight",
     "data": {
       "scaleId": "SMALL_SCALE_01",
       "weight": 2.456,
       "unit": "KG",
       "stable": true,
       "timestamp": 1730908800000
     }
   }
   ```

5. **Bridge Service Filtering:**
   - C# bridge service broadcasts weight updates to all connected clients
   - Clients receive updates only for their subscribed scale type (SMALL or BIG)
   - Prevents data mixing between scales

**Database Configuration:**

Scale hardware and workstation assignments are managed via configuration tables:

- **`TFC_Weightscale2`**: Scale registry with COM port assignments
  - Stores: ScaleId, ScaleType (SMALL/BIG), ComPort, BaudRate, Capacity, Status
  - **Dynamic Configuration**: COM ports are NOT hardcoded - assigned per client installation

- **`TFC_workstation2`**: Workstation scale assignments
  - Stores: WorkstationId, SmallScaleId (FK), BigScaleId (FK), Location
  - Links each workstation to its assigned SMALL and BIG scales

**Configuration Principles:**
- ✅ COM port assignments are **environment-specific** (handled by .NET bridge service and database)
- ✅ Weight capacity ranges are **hardware-determined** (not enforced in application logic)
- ✅ Scale type classification is **database-driven** (supports reassignment without code changes)

**React Implementation Notes:**

Reference the existing Angular implementation for logic patterns:
- WebSocket connection management: `docs/PK/apps/frontend/src/app/core/services/weight-scale.service.ts`
- Scale switching handler: `docs/PK/apps/frontend/src/app/features/picking/partial-picking/partial-picking.component.ts:1055-1059`
- UI toggle component: `docs/PK/apps/frontend/src/app/features/picking/partial-picking/partial-picking.component.html:35-52`
- Progress bar integration: `docs/PK/apps/frontend/src/app/shared/components/weight-progress-bar/`

**DO NOT copy:**
- Angular-specific syntax (signals, decorators, lifecycle hooks)
- Angular services or dependency injection patterns
- Angular template syntax or CSS architecture

**Adapt to React with:**
- React hooks (useState, useEffect, useContext) for WebSocket and state management
- Tailwind CSS utilities for styling
- shadcn/ui components for UI elements
- Zustand or React Context for global scale state

---

## UI Component Specifications (React + Tailwind + shadcn/ui)

### Layout Structure

**Page Organization:**
The partial picking interface uses a **3-section vertical layout**:

1. **Progress Bar Section** (Full Width, Top)
2. **Header Section** (2 Rows, Full Width)
3. **Main Content** (2-Column Split: Form Left, Table Right)

### Component Hierarchy

```
PartialPickingPage
├── WeightProgressBar (full-width, sticky top)
│   ├── Weight display (large, color-coded)
│   ├── Connection status indicators
│   └── Scale controls (Tare, Reconnect, Fetch Weight)
├── Header Row 1
│   ├── RunNoInput (text + lookup button)
│   ├── FGItemKeyDisplay (2 readonly fields)
│   └── ScaleSwitcher (SMALL/BIG toggle buttons)
├── Header Row 2
│   ├── BatchNoInput (text + lookup button)
│   ├── BatchesDisplay (readonly)
│   ├── ProductionDateDisplay (readonly)
│   └── TabStrip (Pending to Picked / Picked)
└── Main Content (2-column grid)
    ├── FormColumn (Left)
    │   ├── FormFieldsTable (8 rows)
    │   │   ├── Item Key (input + lookup)
    │   │   ├── Description (input)
    │   │   ├── Lot No. (input + lookup) + SOH label
    │   │   ├── Bin No. (input + lookup) + SOH value display
    │   │   ├── Weight (readonly + Fetch button)
    │   │   ├── Weight Range (min "to" max)
    │   │   ├── Total Needed (readonly)
    │   │   └── Remaining Qty (readonly)
    │   └── ActionButtons (3 rows)
    │       ├── [Add Lot] [View Lots]
    │       ├── [Print] [Save]
    │       └── [Exit] (full width)
    └── TableColumn (Right)
        └── BatchTicketTable
            └── Columns: Item, Batch No, Partial, Weighted, Balance, Allergens
```

### Field Specifications

#### Header Fields

| Field Label | Control Type | Data Binding | Readonly | Lookup |
|-------------|-------------|--------------|----------|--------|
| Run No | Input | `runNo` (string) | No | ✓ |
| FG ItemKey | Display | `formulaId` | Yes | - |
| FG Description | Display | `formulaDesc` | Yes | - |
| Batch No | Input | `batchNo` (string) | No | ✓ |
| Batches | Display | `batches` (number) | Yes | - |
| Production Date | Display | `productionDate` (date) | Yes | - |

#### Form Fields (Left Column)

| Field Label | Control Type | Data Binding | Readonly | Lookup | Right-Side Element |
|-------------|-------------|--------------|----------|--------|-------------------|
| Item Key | Input | `itemKey` (string) | No | ✓ | - |
| Description | Input | `description` (string) | No | - | - |
| Lot No. | Input | `lotNo` (string) | No | ✓ | "SOH" label |
| Bin No. | Input | `binNo` (string) | No | ✓ | SOH value + unit |
| Weight | Input | `weight` (number) | Yes | - | "Fetch Weight" button |
| Weight Range | 2 Inputs | `weightRangeMin` / `weightRangeMax` | Yes | - | "to" separator |
| Total Needed | Input | `totalNeeded` (number) | Yes | - | - |
| Remaining Qty | Input | `remainingQty` (number) | Yes | - | - |

#### Table Columns (Right Column)

| Column Header | Data Type | Alignment | Format |
|---------------|-----------|-----------|--------|
| Item | string | Left | Plain text |
| Batch No | string | Left | Plain text |
| Partial | number | Right | Number with 2 decimals |
| Weighted | number | Right | Number with 2 decimals |
| Balance | number | Right | Number with 2 decimals |
| Allergens | string / null | Left | "None" if null |

### Button Specifications

#### Scale Switcher (Top Right, Header Row 1)

**Component:** Toggle button group with 2 buttons
```tsx
<ButtonGroup>
  <Button variant={activeScale === 'small' ? 'default' : 'outline'}>SMALL</Button>
  <Button variant={activeScale === 'big' ? 'default' : 'outline'}>BIG</Button>
</ButtonGroup>
```

**Actions:**
- Click SMALL → `switchScale('small')`
- Click BIG → `switchScale('big')`

#### Lookup Buttons (🔍 Icon)

**Component:** Icon button, right-aligned within input wrapper
```tsx
<div className="relative">
  <Input value={value} />
  <Button
    size="sm"
    variant="ghost"
    className="absolute right-0"
    onClick={() => openModal('run' | 'batch' | 'item' | 'lot' | 'bin')}
  >
    🔍
  </Button>
</div>
```

**Modal Mapping:**
- Run No → `RunSelectionModal`
- Batch No → `BatchSelectionModal`
- Item Key → `ItemSelectionModal`
- Lot No. → `LotSelectionModal` (pass itemKey filter)
- Bin No. → `BinSelectionModal` (pass itemKey + lotNo filter)

#### Progress Bar Controls

**Component:** Button group in progress bar component
```tsx
<div className="flex gap-2">
  <Button variant="secondary" onClick={onTareScale}>Tare</Button>
  <Button variant="secondary" onClick={onReconnect}>Reconnect</Button>
  <Button
    variant="primary"
    disabled={!canFetchWeight}
    onClick={onFetchWeight}
  >
    Fetch Weight
  </Button>
</div>
```

**Enable Conditions:**
- Tare: Scale connected
- Reconnect: Always enabled
- Fetch Weight: `isConnected && isStable && isWeightInRange`

#### Form Action Buttons (3 Rows)

**Row 1 (Secondary Actions):**
```tsx
<div className="flex gap-2">
  <Button variant="secondary" onClick={onAddLot}>Add Lot</Button>
  <Button variant="secondary" onClick={onViewLots}>View Lots</Button>
</div>
```

**Row 2 (Primary Actions):**
```tsx
<div className="flex gap-2">
  <Button variant="secondary" onClick={onPrint}>Print</Button>
  <Button variant="default" onClick={onSave}>Save</Button>
</div>
```

**Row 3 (Exit Action):**
```tsx
<Button variant="destructive" className="w-full" onClick={onExit}>Exit</Button>
```

### Tab Implementation

**Component:** shadcn/ui Tabs
```tsx
<Tabs defaultValue="pending">
  <TabsList>
    <TabsTrigger value="pending">Pending to Picked</TabsTrigger>
    <TabsTrigger value="picked">Picked</TabsTrigger>
  </TabsList>
  <TabsContent value="pending">
    {/* Active picking interface */}
  </TabsContent>
  <TabsContent value="picked">
    {/* Historical view */}
  </TabsContent>
</Tabs>
```

### Visual State Classes (Tailwind)

**Weight Input Color Coding:**
```tsx
<Input
  className={cn(
    weight >= weightRangeMin && weight <= weightRangeMax
      ? "border-green-500 bg-green-50"
      : "border-red-500 bg-red-50"
  )}
  readOnly
  value={weight}
/>
```

**Scale Button Active State:**
```tsx
<Button
  variant={activeScale === scaleType ? "default" : "outline"}
  className={activeScale === scaleType ? "ring-2 ring-primary" : ""}
>
  {scaleType.toUpperCase()}
</Button>
```

**Table Row Selection:**
```tsx
<TableRow
  className={cn(
    "cursor-pointer hover:bg-accent",
    isSelected && "bg-accent border-l-4 border-primary"
  )}
  onClick={() => onSelectRow(index)}
>
  ...
</TableRow>
```

### Responsive Considerations

**Target Resolution:** 1280x1024 (primary workstation displays)

**Layout Breakpoints:**
- Desktop (>= 1280px): 2-column layout (form left, table right)
- Tablet (768px - 1279px): Stacked layout (form top, table bottom)
- Mobile (< 768px): Single column with collapsible sections

**Component Sizing:**
- Form column: `md:w-1/3` (33% on desktop)
- Table column: `md:w-2/3` (67% on desktop)
- Progress bar: Sticky top, full width
- Action buttons: Minimum touch target 44px height

### shadcn/ui Component Mapping

| UI Element | shadcn/ui Component | Variant/Props |
|------------|-------------------|---------------|
| Text inputs | `<Input />` | Default |
| Readonly displays | `<Input readonly />` | + `className="bg-gray-50"` |
| Lookup buttons | `<Button />` | `variant="ghost" size="sm"` |
| Scale switcher | `<Button />` | `variant="outline"` / `variant="default"` |
| Action buttons | `<Button />` | `variant="secondary"` / `variant="default"` / `variant="destructive"` |
| Fetch weight button | `<Button />` | `variant="default" disabled={condition}` |
| Tabs | `<Tabs />` `<TabsList />` `<TabsTrigger />` | Default |
| Table | `<Table />` `<TableHeader />` `<TableBody />` `<TableRow />` `<TableCell />` | Default |
| Progress bar | Custom component | Uses `<Card />` wrapper |

### Reference Files (DO NOT Copy Implementation)

**Layout Structure Reference:**
- `docs/PK/apps/frontend/src/app/features/picking/partial-picking/partial-picking.component.html`

**Field Names Reference:**
- Lines 20-21: Run No input
- Lines 28-31: FG ItemKey display
- Lines 59-61: Batch No input
- Lines 67-72: Batches + Production Date
- Lines 76-81: Tab structure
- Lines 90-183: Form fields table
- Lines 186-197: Action buttons
- Lines 205-243: Batch table

**Logic Reference (Adapt to React):**
- `docs/PK/apps/frontend/src/app/features/picking/partial-picking/partial-picking.component.ts`

**DO NOT Copy:**
- Angular template syntax (`[formGroup]`, `formControlName`, `@if`, `@for`)
- Angular CSS classes or custom theme variables
- Component file structure or naming conventions

**Adapt to:**
- React controlled components with `useState` hooks
- Tailwind utility classes for all styling
- shadcn/ui components for UI primitives
- React Hook Form or similar for form management

---

**API Request Flow (Picking Operation):**

```
User Action: Click "Save" button
    ↓
React Component (PickingForm.tsx)
    - Validate form (Zod schema)
    - Call API client (services/picking.ts)
    ↓
Axios POST /api/picking/save
    - Headers: Content-Type: application/json
    - Body: {runNo, rowNum, lineId, lotNo, binNo, weight, userId}
    ↓
Rust Axum Handler (handlers/picking.rs)
    - Extract JSON (Serde deserialize)
    - Validate request (Validator crate)
    - Call service layer
    ↓
PickingService (services/picking_service.rs)
    - Begin DB transaction
    - Execute 4-phase workflow:
      1. INSERT Cust_PartialLotPicked
      2. UPDATE cust_PartialPicked
      3. INSERT LotTransaction
      4. UPDATE LotMaster.QtyCommitSales
    - Commit transaction
    ↓
Database (TFCPILOT3)
    - Execute parameterized queries
    - Return affected rows
    ↓
Rust Handler (handlers/picking.rs)
    - Serialize response (Serde)
    - Return JSON: {success: true, pickId: 12345}
    ↓
React Component (PickingForm.tsx)
    - React Query cache update
    - Trigger label print (printIndividualLabel)
    - Show success toast
    - Refresh item grid
```

---

#### **Integration Requirements**

**1. WebSocket Proxy (Rust ↔ .NET Bridge)**

**Rust Implementation (websocket/bridge_proxy.rs):**
```rust
use axum::{
    extract::{ws::WebSocket, State, WebSocketUpgrade},
    response::IntoResponse,
};
use tokio_tungstenite::connect_async;

// Connect to .NET bridge as client
async fn connect_to_bridge(scale_type: &str) -> Result<WebSocketStream, Error> {
    let bridge_url = format!("ws://localhost:5000/ws/scale/{}", scale_type);
    let (ws_stream, _) = connect_async(bridge_url).await?;
    Ok(ws_stream)
}

// Relay messages: .NET bridge → Frontend clients
pub async fn websocket_proxy(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(scale_type): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, scale_type, state))
}

async fn handle_socket(
    mut frontend_socket: WebSocket,
    scale_type: String,
    state: AppState,
) {
    // Connect to .NET bridge
    let mut bridge_stream = connect_to_bridge(&scale_type).await.unwrap();

    loop {
        tokio::select! {
            // Receive from .NET bridge
            Some(Ok(msg)) = bridge_stream.next() => {
                // Relay to frontend
                if let Message::Text(text) = msg {
                    frontend_socket.send(Message::Text(text)).await.ok();
                }
            }

            // Receive from frontend (currently no client→bridge messages)
            Some(Ok(_)) = frontend_socket.recv() => {
                // Future: Handle client commands here
            }

            else => break,
        }
    }
}
```

**Why Proxy?**
- **CORS Handling:** .NET bridge doesn't have CORS headers, Rust adds them
- **Load Balancing:** Future: Route to multiple bridge instances
- **Monitoring:** Rust logs all WebSocket traffic for debugging
- **Security:** Rust validates client tokens before relaying to bridge

---

**2. Label Printing via Windows Print System**

**Frontend Print Workflow:**

```typescript
// services/printing.ts
interface LabelData {
  itemKey: string;
  pickedQty: number;
  batchNo: string;
  lotNo: string;
  user: string;
  date: string;
  time: string;
}

export async function printIndividualLabel(data: LabelData): Promise<void> {
  // 1. Generate HTML from template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: 4in 4in; margin: 0.1in; }
        body { font-family: Arial; }
        .item { font-size: 36pt; font-weight: bold; }
        .qty { font-size: 28pt; }
        .batch { font-size: 18pt; color: #1E40AF; }
        .barcode {
          font-family: 'Libre Barcode 128';
          font-size: 48pt;
          text-align: center;
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="item">${data.itemKey}</div>
      <div class="qty">${data.pickedQty.toFixed(2)} KG</div>
      <div class="batch">${data.batchNo}</div>
      <div class="lot">${data.lotNo}</div>
      <div class="meta">${data.user} ${data.date} ${data.time}</div>
      <div class="barcode">*${data.itemKey}--${data.pickedQty.toFixed(2)}*</div>
    </body>
    </html>
  `;

  // 2. Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  // 3. Load HTML into iframe
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();

  // 4. Trigger print (auto-print if browser configured, else show dialog)
  iframe.contentWindow!.print();

  // 5. Cleanup after print
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

// Auto-print configuration (browser-level)
// Chrome: chrome://settings/printing → "Print using system dialog"
// Edge: edge://settings/printing → Same setting
```

**Batch Summary Label (Similar Pattern):**
```typescript
export async function printBatchSummary(
  runData: RunData,
  items: PickedItem[]
): Promise<void> {
  const html = `
    <table>
      <thead>
        <tr>
          <th>Item No.</th>
          <th>BIN</th>
          <th>Lot-No</th>
          <th>QTY</th>
          <th>UM</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.itemKey}</td>
            <td>${item.binNo}</td>
            <td>${item.lotNo}</td>
            <td>${item.pickedQty.toFixed(2)}</td>
            <td>KG</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  // ... same iframe print logic
}
```

**Printer Configuration (Windows):**
- Set default printer to Zebra label printer (4x4" labels)
- Configure print preferences: Paper size = 4x4 inches, orientation = portrait
- Enable auto-print in Chrome: "Print using system dialog" disabled (uses default printer)

**Fallback Options:**
- If print fails → Offer "Download PDF" button (browser PDF generator)
- If wrong printer selected → Show print preview dialog (Ctrl+P)
- If no printer available → Save label HTML to file for later print

---

**3. Barcode Font Integration**

**Web Font (Recommended):**
```html
<!-- Load Libre Barcode 128 from Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
```

**Barcode Format:**
- **Pattern:** `*{ItemKey}--{PickedQty}*` (e.g., `*INSALT02--20.00*`)
- **Font:** Libre Barcode 128 (free, open-source, Code 128 standard)
- **Size:** 48pt font size for 4x4" label (scannable at 6 inch distance)

**Validation:**
- Test scan with handheld scanner (Honeywell, Datalogic)
- Verify reads as: `INSALT02--20.00` (without asterisks)
- Adjust font size if scan fails (increase to 52pt if needed)

**Alternative (Local Font):**
- Download Libre Barcode 128 TTF
- Install on Windows (C:\Windows\Fonts)
- Update CSS: `font-family: 'Libre Barcode 128', monospace;`

---

#### **Security/Compliance**

**Authentication & Authorization:**

**Database Credentials:**
- **Storage:** Backend `.env` file (NEVER in frontend code or Git)
- **Access:** Rust backend connects to SQL Server with `NSW/B3sp0k3`
- **Rotation:** Change password quarterly (update .env, restart backend)

**User Authentication:**
```rust
// Backend endpoint: POST /api/auth/login
#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

async fn login(Json(req): Json<LoginRequest>) -> Result<Json<LoginResponse>, AppError> {
    // Query tbl_user for authentication
    let user = query!(
        "SELECT userid, uname, Fname, Lname, auth_source, ldap_username
         FROM tbl_user
         WHERE uname = @p1 OR ldap_username = @p1",
        req.username
    ).fetch_optional(&pool).await?;

    match user.auth_source {
        "LOCAL" => {
            // SQL authentication: verify password hash
            verify_password_hash(&req.password, &user.pword)?;
        },
        "LDAP" => {
            // LDAP authentication: call AD (future Phase 2)
            authenticate_ldap(&req.username, &req.password)?;
        },
        _ => return Err(AppError::Unauthorized),
    }

    // Generate session token (JWT)
    let token = generate_jwt(user.userid, user.uname)?;

    Ok(Json(LoginResponse { token, user }))
}
```

**Session Management:**
- **Token Type:** JWT (JSON Web Token) with 8-hour expiration
- **Storage:** `sessionStorage` (cleared on browser close, more secure than `localStorage`)
- **Transmission:** Authorization header: `Bearer <token>`
- **Validation:** Rust middleware verifies JWT signature on every API request

**Workstation-Based Access Control:**
```rust
// Middleware: Extract workstation ID from request
async fn workstation_auth(
    headers: HeaderMap,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let workstation_id = headers
        .get("X-Workstation-ID")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    // Validate workstation (WS1-WS4 allowed)
    if !["WS1", "WS2", "WS3", "WS4"].contains(&workstation_id) {
        return Err(AppError::Forbidden);
    }

    // Attach to request context
    req.extensions_mut().insert(WorkstationId(workstation_id.to_string()));

    Ok(next.run(req).await)
}
```

**HTTPS/TLS:**
- **Production:** Enforce HTTPS (HTTP redirects to HTTPS)
- **Certificate:** Self-signed for internal network (or company CA cert)
- **Service Worker:** Requires HTTPS (or localhost exception)
- **Nginx Config:**
  ```nginx
  server {
      listen 80;
      return 301 https://$host$request_uri;
  }

  server {
      listen 443 ssl;
      ssl_certificate /etc/nginx/ssl/server.crt;
      ssl_certificate_key /etc/nginx/ssl/server.key;
      ssl_protocols TLSv1.2 TLSv1.3;
      # ... rest of config
  }
  ```

**Audit Trail:**
- **Picking Operations:** `ModifiedBy`, `ModifiedDate`, `RecUserid`, `RecDate` fields populated
- **Unpick Operations:** Preserve original pick audit fields (ItemBatchStatus, PickingDate stay set)
- **Database Logging:** SQL Server audit logs (if enabled) capture all DML operations
- **Application Logging:** Rust `tracing` crate logs all API requests with user context

**Data Validation:**
- **Frontend:** Zod schemas validate form inputs (prevent bad data entry)
- **Backend:** Validator crate validates API payloads (prevent injection attacks)
- **SQL:** Parameterized queries only (Tiberius `@p1`, `@p2` placeholders)
- **Weight Range:** Server-side check (don't trust client-side validation alone)

**Compliance (Food Safety):**
- **FEFO Enforcement:** System automatically selects earliest expiry (audit trail in BinNo selection)
- **Lot Traceability:** Full genealogy: LotNo → BinNo → PickingDate → ModifiedBy
- **Allergen Tracking:** Display prominently in UI, stored in cust_PartialPicked.Allergen
- **Expiry Alerts:** Red highlight if DateExpiry < 30 days (prevent expired material usage)

---

## Constraints & Assumptions

### Constraints

**Budget:**
- **Development:** Internal resources only (no contractor costs)
- **Infrastructure:**
  - Domain/TLS cert: ~$100/year (optional, can use self-signed)
  - Server hardware: Use existing Windows Server (no new purchase)
  - Cloud costs: $0 (on-premise deployment)
- **Total:** <$500 first year (domain + minor tooling)

**Timeline:**
- **MVP Development:** 6-8 weeks
  - Week 1-2: Project setup, database integration, UI prototype
  - Week 3-5: Core features (picking workflow, FEFO, weight integration)
  - Week 6: Label printing, unpick functionality
  - Week 7: Testing, bug fixes, performance optimization
  - Week 8: Deployment, user training, documentation
- **Phase 2:** Months 3-4 (mobile dashboard, barcode scanner)
- **Phase 3:** Months 6-12 (multi-warehouse, AI features)

**Resources:**
- **Team:** 1 full-stack developer (Rust + React experience)
- **Hardware:**
  - 4 test workstations (WS1-WS4) @ 1280x1024 resolution
  - 2 weight scales (SMALL/BIG) with .NET bridge service installed
  - 2 label printers (4x4" Zebra or compatible)
- **Access:**
  - Production database (TFCPILOT3) read-write permissions
  - Windows Server for Docker deployment
  - Network access to 192.168.0.x subnet

**Technical:**

1. **Existing .NET Bridge Service (Cannot Modify):**
   - Must use Weight-scale/bridge-service as-is (no code changes)
   - WebSocket endpoints fixed: `/ws/scale/small`, `/ws/scale/big`
   - Message format fixed: JSON `{type:"weight", data:{...}}`
   - Installed via existing installer-package (Windows Service)

2. **SQL Server Schema (Read-Only for Structure):**
   - Cannot change table names (case-sensitive: `cust_PartialPicked`)
   - Cannot add new columns (use User1-User12 if needed)
   - Cannot modify composite primary keys
   - Can read/write data within existing schema

3. **Network Constraints:**
   - Internal 192.168.0.x network only (no internet access required)
   - Database server: 192.168.0.86:49381 (fixed IP)
   - Workstation IPs: 192.168.0.10-13 (WS1-WS4)
   - Bridge service port: 5000 (fixed, cannot change)

4. **Label Printing:**
   - 4x4" label stock only (no other sizes available)
   - Windows print system (no direct ZPL generation)
   - Any Windows-compatible printer (not limited to specific brand)

5. **Browser Compatibility:**
   - No IE 11 support (workstations use Chrome/Edge 90+)
   - PWA requires HTTPS (except localhost dev environment)
   - Service worker requires secure context (HTTPS or localhost)

### Key Assumptions

**Infrastructure & Operations:**

1. **.NET Bridge Service Reliability:**
   - Assumption: `pk-bridge-service.exe` runs reliably as Windows Service on each workstation
   - Risk: Service crashes require manual restart (no auto-recovery in MVP)
   - Mitigation: Monitor service status, add health check endpoint

2. **Serial Scale Configuration:**
   - Assumption: COM ports configured correctly in `appsettings.json` or env vars (`SCALE_MANUAL_PORT`)
   - Assumption: Scales output weight in format bridge service expects (parseable string)
   - Risk: New scale models may have different output format
   - Mitigation: Document supported scale models, provide configuration wizard

3. **Database Credentials & Permissions:**
   - Assumption: `NSW/B3sp0k3` credentials remain valid and have necessary permissions
   - Assumption: Can read from INMAST, BINMaster, LotMaster
   - Assumption: Can write to cust_PartialPicked, Cust_PartialLotPicked, LotTransaction, LotMaster
   - Risk: Password expiration or permission changes
   - Mitigation: Document required permissions, error handling for auth failures

4. **Network Stability:**
   - Assumption: 192.168.0.x network has <50ms latency to database server
   - Assumption: Minimal packet loss (<1%)
   - Risk: Network outages break WebSocket connections
   - Mitigation: Auto-reconnect logic, offline mode (read-only cached data)

**Business Rules & Data:**

5. **TFC1 Warehouse Scope:**
   - Assumption: All picking operations use TFC1 warehouse exclusively
   - Assumption: PARTIAL bins filter remains: `Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'`
   - Assumption: 511 PARTIAL bins at TFC1 (current count, may grow slowly)
   - Risk: Expansion to other warehouses requires multi-warehouse logic
   - Mitigation: Hardcode TFC1 filter in MVP, plan for config-driven Phase 2

6. **INMAST.User9 Tolerance Values:**
   - Assumption: `User9 = 0.025 KG` is correct absolute tolerance (not percentage)
   - Assumption: Tolerance values change infrequently (stable for 6+ months)
   - Risk: Incorrect tolerance causes false rejections or over-tolerance picks
   - Mitigation: Validate with production data (Run 213972), supervisor override option

7. **Picking Workflow Stability:**
   - Assumption: Existing picking patterns (Run 213972, 213989) remain standard operating procedure
   - Assumption: 4-phase transaction workflow (Lot Allocation → Weight → Transaction → Commit) is complete
   - Risk: Business process changes require code updates
   - Mitigation: Document workflow in PickingFlow.md, involve operations team in UAT

8. **Operator Technical Proficiency:**
   - Assumption: Operators comfortable with web-based applications (basic browser navigation)
   - Assumption: Can use keyboard/mouse (no touchscreen in MVP)
   - Assumption: Familiar with current desktop app workflow (minimal training needed)
   - Risk: Resistance to change or learning curve
   - Mitigation: Side-by-side training, keep desktop app as fallback for 1 month

**Printing & Hardware:**

9. **Label Printer Configuration:**
   - Assumption: Windows default printer is label printer (4x4" configured)
   - Assumption: Printers support 4x4" paper size (configured in Windows print settings)
   - Assumption: Any Windows-compatible printer works (not brand-specific)
   - Risk: Print dialog shows wrong printer, labels print on wrong paper size
   - Mitigation: IT pre-configures printers, training on printer selection

10. **Barcode Scannability:**
    - Assumption: Libre Barcode 128 font (48pt) produces scannable barcodes on 4x4" labels
    - Assumption: Code 128 format `*ITEMKEY--QTY*` is correct (asterisks removed on scan)
    - Risk: Barcodes not readable by handheld scanners
    - Mitigation: Test with actual scanners (Honeywell, Datalogic), adjust font size if needed

**Deployment & Maintenance:**

11. **Docker Environment:**
    - Assumption: Windows Server supports Docker Desktop or Docker Engine
    - Assumption: IT team familiar with Docker Compose commands
    - Risk: Docker not installed or permission issues
    - Mitigation: Provide installation guide, fallback to direct executable deployment

12. **HTTPS Certificate:**
    - Assumption: Can generate self-signed certificate for internal network (or use company CA)
    - Assumption: Workstation browsers trust self-signed cert (added to Windows cert store)
    - Risk: Browser warnings block PWA installation
    - Mitigation: Document cert installation steps, use company CA if available

13. **PWA Update Mechanism:**
    - Assumption: Service worker detects new version on refresh (checks `version` in manifest)
    - Assumption: Operators refresh browser daily (or IT can force refresh via Group Policy)
    - Risk: Old version cached indefinitely if browser never refreshes
    - Mitigation: Show "Update available" banner, auto-refresh on idle (1 hour)

---

## Risks & Open Questions

### Key Risks

**1. WebSocket Connection Reliability**
- **Risk:** Bridge service WebSocket drops during peak operations, freezing weight updates
- **Impact:** High - Operators cannot see live weight, must manually check scale display
- **Probability:** Medium - Network hiccups or service restarts cause disconnections
- **Mitigation Strategy:**
  - Implement exponential backoff auto-reconnect (1s, 2s, 4s, 8s intervals)
  - Show clear "Scale Disconnected" red banner in UI
  - Log all disconnection events for IT troubleshooting
  - Add health check endpoint to bridge service (monitor uptime)
  - Fallback: Manual weight entry field if scale offline >30 seconds

**2. Database Connection Pool Exhaustion**
- **Risk:** 4-8 concurrent workstations × 3-5 queries each = pool saturation
- **Impact:** Critical - API requests timeout, operators see "Save failed" errors
- **Probability:** Low-Medium - Depends on query execution time and concurrency
- **Mitigation Strategy:**
  - Set max pool size to 10 (4 workstations × 2.5 avg concurrent queries)
  - Add connection timeout: 5 seconds (fail fast, don't queue indefinitely)
  - Optimize queries: Use indexes on RunNo+RowNum+LineId composite keys
  - Monitor pool metrics: Alert if >80% utilization sustained for >10 seconds
  - Implement query caching for read-heavy operations (INMAST tolerance lookup)

**3. Label Print Failures**
- **Risk:** Network printer offline, paper jam, or wrong printer selected
- **Impact:** Medium - Material cannot move without label (blocks entire batch)
- **Probability:** Medium - Printers are frequent failure point in warehouse
- **Mitigation Strategy:**
  - Queue failed prints in IndexedDB (retry when printer back online)
  - Show visual alert: "Printer Error: Check paper/connection"
  - Add "Reprint Last Label" button for manual retry
  - Fallback: "Download PDF" option (print on different printer)
  - IT monitoring: Windows print queue status, send alerts to support

**4. Offline Data Staleness**
- **Risk:** Cached run data becomes outdated when workstation offline >5 minutes
- **Impact:** Medium - Operator picks from stale data (wrong target qty or lot availability)
- **Probability:** Low - Internal network usually stable, but WiFi dead zones exist
- **Mitigation Strategy:**
  - Clear visual indicator: "Last synced: 3 minutes ago" (yellow if >2 min, red if >5 min)
  - Force refresh on reconnect (fetch latest run data from API)
  - Disable picking operations when offline >5 minutes (read-only mode)
  - Service worker cache: 5 minute TTL for run data (auto-expire)
  - Offline detection: Ping API every 30 seconds, update status indicator

**5. Scale Calibration Drift**
- **Risk:** Weight readings become inaccurate over time (scale needs recalibration)
- **Impact:** High - Incorrect picks violate tolerance, potential food safety issue
- **Probability:** Low - Scales typically stable for months, but drift possible
- **Mitigation Strategy:**
  - Display last calibration date from database (tbl_scale_calibration, Phase 2)
  - Alert if DateCalibrated >30 days: "Scale due for calibration"
  - Provide calibration workflow in UI (supervisor-only, Phase 2)
  - Manual check: IT team verifies scale accuracy monthly (test weight)
  - Audit trail: Log all weight readings for forensic analysis if issues arise

**6. Browser Compatibility Issues**
- **Risk:** Legacy IE 11 users (if any) cannot use PWA (no service worker support)
- **Impact:** Low - Most workstations use Chrome/Edge 90+, but outliers possible
- **Probability:** Very Low - IT policy enforces modern browsers
- **Mitigation Strategy:**
  - Detect browser version on load: `if (isIE11()) showUpgradeNotice()`
  - Show friendly message: "This app requires Chrome 90+ or Edge 90+"
  - Provide upgrade guide (IT can update via Group Policy)
  - Fallback: Keep desktop app available for 1 month (emergency backup)
  - Track browser usage: Analytics to identify outdated browsers

### Open Questions

**Operational Workflow:**

1. **Printer Fallback Behavior:**
   - Q: Should the app auto-print silently or show Windows print dialog for user confirmation?
   - Options:
     - A) Auto-print (faster, but no printer selection)
     - B) Show dialog (slower, but user can choose printer/preview)
   - Decision needed: Operations team preference (speed vs control)

2. **Concurrent Lot Picking:**
   - Q: How to handle 2 operators picking same lot/bin simultaneously? (e.g., both select PWBB-12 for lot 2510403-1)
   - Options:
     - A) Database-level locks (SERIALIZABLE isolation, blocks second operator)
     - B) Optimistic locking (check QtyCommitSales on save, retry if changed)
     - C) Allow concurrent (warn if AvailableQty goes negative, manual resolve)
   - Decision needed: Business rule for conflict resolution

3. **Partial Batch Completion:**
   - Q: If operator picks 6/8 items in batch, can they save progress? Or must complete all items before saving?
   - Options:
     - A) Allow partial save (ItemBatchStatus='Allocated' per item)
     - B) All-or-nothing (must complete all items in batch before save)
   - Decision needed: Current workflow observation (PickingFlow.md shows per-item saves, so A is likely correct)

4. **Unpick Rollback Strategy:**
   - Q: If PWA deploy breaks production, how quickly can we rollback?
   - Options:
     - A) Keep desktop app installed for 1 month (manual switch)
     - B) Docker rollback (redeploy previous image, 5 min downtime)
     - C) Service worker version pin (frontend rollback without backend deploy)
   - Decision needed: IT disaster recovery plan

**User Experience:**

5. **Supervisor Mobile Access:**
   - Q: Do supervisors need read-only mobile view in MVP, or defer to Phase 2?
   - Context: Supervisors walk the floor, may want real-time status on tablet
   - Decision needed: Prioritize MVP scope (desktop-only) vs early mobile access

6. **Weight Tolerance Editability:**
   - Q: Should INMAST.User9 tolerance be editable via UI, or strictly database-managed?
   - Options:
     - A) Read-only in UI (IT/admin updates via SQL query)
     - B) Editable by supervisors (add settings page, Phase 2)
   - Decision needed: Frequency of tolerance changes (if rare, A is sufficient)

7. **Audit Log Retention:**
   - Q: Do we need separate audit log table, or is ModifiedBy/ModifiedDate in existing tables sufficient?
   - Context: Compliance may require immutable audit trail (cannot update ModifiedBy)
   - Decision needed: Regulatory requirements (food safety audit trail)

**Technical Implementation:**

8. **FEFO Tiebreaker Logic:**
   - Q: If 2 bins have same expiry date, prefer highest available qty or closest bin location?
   - Current assumption: Highest available qty (from SQL ORDER BY)
   - Options:
     - A) Highest qty (current)
     - B) Closest bin (minimize operator walking, requires bin coordinates in BINMaster)
   - Decision needed: Operations team preference (inventory rotation vs efficiency)

9. **WebSocket Reconnection Timeout:**
   - Q: After how many failed reconnect attempts should we give up and show permanent error?
   - Options:
     - A) Infinite retries with exponential backoff (max 60s interval)
     - B) Stop after 10 attempts (~5 minutes), require manual refresh
   - Decision needed: Balance between auto-recovery and forcing user action

10. **Offline Storage Limits:**
    - Q: How much run data should we cache for offline mode? (1 run, 10 runs, all runs?)
    - Context: IndexedDB storage limits vary by browser (Chrome: 60% of disk, min 50MB)
    - Options:
      - A) Cache current run only (minimal storage, limited offline capability)
      - B) Cache last 10 runs (balance storage vs offline utility)
    - Decision needed: Offline usage patterns (how often network goes down?)

### Areas Needing Further Research

**1. Optimal WebSocket Reconnection Strategy**
- **Topic:** Industrial WiFi reliability patterns in warehouse environment
- **Research Needed:**
  - Survey existing dead zones (walk warehouse with WiFi analyzer)
  - Measure typical outage duration (30s? 5min? 1hr?)
  - Test reconnection strategies: Immediate vs exponential backoff vs manual
- **Deliverable:** Recommended reconnection parameters (initial delay, max attempts, backoff multiplier)
- **Timeline:** Week 1 of development (inform WebSocket hook implementation)

**2. ZPL vs HTML Label Template Validation**
- **Topic:** Barcode scannability with browser print vs native ZPL
- **Research Needed:**
  - Print test labels using browser print (HTML + Libre Barcode 128 font)
  - Scan with actual warehouse scanners (Honeywell, Datalogic models)
  - Compare with legacy desktop app ZPL labels (quality, scan distance)
  - Measure failure rate (100 scans, count misreads)
- **Deliverable:** Font size recommendation (48pt baseline, adjust if <95% success rate)
- **Timeline:** Week 2 of development (before label print implementation)

**3. SQL Server Connection Pooling Best Practices**
- **Topic:** Tiberius crate performance under high concurrency
- **Research Needed:**
  - Load test: 8 concurrent clients × 5 queries/sec (simulate peak workload)
  - Monitor: Connection wait time, query execution time (p95, p99)
  - Test pool sizes: 5, 10, 15 connections (find sweet spot)
  - Benchmark: tiberius vs alternative SQL Server client (e.g., sqlx with ODBC)
- **Deliverable:** Pool configuration (min_idle, max_size, timeout) for production
- **Timeline:** Week 3 of development (before backend stress testing)

**4. PWA Offline Storage Limits & Eviction**
- **Topic:** IndexedDB capacity and browser eviction policies for cached run data
- **Research Needed:**
  - Test Chrome/Edge storage limits on Windows 10/11 (min 50MB guaranteed?)
  - Measure average run data size (JSON for 1 run with 10 items × 4 batches)
  - Calculate: How many runs fit in 50MB? (10? 100? 1000?)
  - Test eviction: What happens when quota exceeded? (FIFO? Error?)
- **Deliverable:** Cache strategy (LRU eviction, max runs to store, TTL)
- **Timeline:** Week 4 of development (before offline mode implementation)

**5. Database Failover & Graceful Degradation**
- **Topic:** Handling SQL Server unreachable scenarios (network or DB down)
- **Research Needed:**
  - Simulate network partition (disconnect workstation from 192.168.0.x subnet)
  - Simulate DB crash (stop SQL Server service)
  - Test: API error handling (timeout, retry, fallback)
  - Design: Read-only mode (serve cached data, disable saves)
- **Deliverable:** Failover strategy (connection retries, user messaging, graceful degradation)
- **Timeline:** Week 5 of development (before production deployment)

**6. Rust Tiberius vs SQLx Performance**
- **Topic:** Comparison of SQL Server client libraries for Rust
- **Research Needed:**
  - Benchmark query execution: `SELECT` (simple, complex joins), `INSERT`, `UPDATE`, `TRANSACTION`
  - Compare latency: tiberius (native) vs sqlx (ODBC wrapper)
  - Test: Prepared statement caching, connection reuse
  - Evaluate: Developer experience (query macros, type safety)
- **Deliverable:** Library recommendation (tiberius likely winner for native performance)
- **Timeline:** Week 1 of development (inform backend stack decision)

**7. FEFO Algorithm Validation with Production Data**
- **Topic:** Verify FEFO bin selection matches operational expectations
- **Research Needed:**
  - Export real lot/bin data from LotMaster (anonymized if needed)
  - Run FEFO SQL query against actual data (ORDER BY DateExpiry ASC)
  - Interview operators: Does selected bin match their manual choice?
  - Edge cases: Multiple bins same expiry, zero available qty, lot on hold
- **Deliverable:** Validated SQL query, business rule documentation
- **Timeline:** Week 2 of development (before FEFO implementation)

---

## Next Steps

### Immediate Actions (Week 1)

1. **Development Environment Setup**
   - [ ] Install Rust toolchain (1.75+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
   - [ ] Install Node.js 20+: `nvm install 20 && nvm use 20`
   - [ ] Configure SQL Server connection: Test connection to `192.168.0.86:49381` with NSW credentials
   - [ ] Clone project repository (or initialize new monorepo)

2. **Project Repository Initialization**
   - [ ] Create monorepo structure: `/frontend`, `/backend`, `/shared`, `/docs`
   - [ ] Initialize frontend: `npm create vite@latest frontend -- --template react-ts`
   - [ ] Initialize backend: `cargo init --bin backend`
   - [ ] Configure Tailwind CSS: `npm install -D tailwindcss postcss autoprefixer`
   - [ ] Set up Git: `.gitignore` (exclude .env, node_modules, target/), initial commit

3. **Weight Scale Bridge Service Verification**
   - [ ] Test .NET bridge WebSocket: `wscat -c ws://localhost:5000/ws/scale/small`
   - [ ] Verify JSON message format: `{type:"weight", data:{scaleId, weight, unit, stable}}`
   - [ ] Test dual-scale support: Connect to `/ws/scale/small` and `/ws/scale/big` simultaneously
   - [ ] Document bridge service status: Running as Windows Service? COM ports configured?

4. **Database Access Validation**
   - [ ] Connect to TFCPILOT3: `sqlcmd -S 192.168.0.86,49381 -U NSW -P B3sp0k3 -d TFCPILOT3`
   - [ ] Test critical table access: `SELECT TOP 1 * FROM cust_PartialPicked` (verify lowercase 'c')
   - [ ] Validate composite keys: `SELECT * FROM cust_PartialPicked WHERE RunNo=213972 AND RowNum=1 AND LineId=4`
   - [ ] Check permissions: Can read INMAST, BINMaster, LotMaster? Can write to Cust_Partial* tables?

5. **UI Prototype (1280x1024 Layout)**
   - [ ] Create Tailwind theme: Brown/orange colors (#D97706, #92400E) from NewApp-UI.png
   - [ ] Build layout components: TopBar, HeaderRow, LeftPanel, CenterPanel, RightPanel, BottomBar
   - [ ] Test responsive: Verify exact fit at 1280x1024 (no scrolling for main operations)
   - [ ] Implement progress bar component: Visual weight indicator with color zones (green/yellow/red)

6. **API Contract Definition**
   - [ ] Document REST endpoints in OpenAPI spec: `docs/api-spec.yaml`
   - [ ] Define request/response schemas: PickingRequest, LotSearchRequest, LabelPrintRequest
   - [ ] Define WebSocket message formats: WeightUpdate, StatusUpdate, ConnectionError
   - [ ] Share with team: Review API design for feedback

7. **Label Printer Test**
   - [ ] Generate sample HTML label: Item INSAPP01, 7.01 KG, Batch 843856, Barcode *INSAPP01--7.01*
   - [ ] Print test via browser: `window.print()` from HTML template
   - [ ] Verify output: 4x4" size, barcode scannable (test with handheld scanner)
   - [ ] Document printer setup: Windows default printer config, paper size settings

---

### PM Handoff

This **Project Brief** provides the full context for the **Partial Picking System PWA**.

**Key Highlights for PRD Development:**
- **Optimized for 1280x1024 resolution** (17-inch workstation monitors, 5:4 aspect ratio)
- **FEFO automation** via lot search/scan → system auto-selects earliest expiry bin
- **Fetch Weight button** captures scale reading from real-time WebSocket (dual SMALL/BIG scale support)
- **Windows native printing** (HTML + CSS @media print, no ZPL generation needed)
- **Rust + React stack** with existing .NET bridge service (no modifications required)

**Critical Workflow Correction:**
The picking process is: **Scan/Search Lot → Auto-Select Bin (FEFO) → Fetch Weight → Add Lot → Save → Auto-Print Label**

**Next Step: PRD Creation**

The Product Requirements Document (PRD) should expand on this brief with:

1. **Detailed User Stories:**
   - As an operator, I want to scan a lot number so the system auto-selects the best bin (FEFO)
   - As an operator, I want to see real-time weight updates so I know when to click "Fetch Weight"
   - As an operator, I want to unpick an item so I can correct mistakes without supervisor intervention

2. **API Endpoint Specifications:**
   - `POST /api/picking/save` - Save pick transaction (4-phase DB workflow)
   - `POST /api/lots/search` - FEFO bin selection query
   - `GET /api/weight-range/:runNo/:rowNum/:lineId` - Tolerance calculation (INMAST.User9)

3. **Database Query Patterns:**
   - FEFO SQL with TFC1 PARTIAL bin filter
   - Composite key queries (RunNo+RowNum+LineId)
   - Transaction boundaries for atomic saves

4. **WebSocket Integration:**
   - Rust proxy architecture (Axum → .NET bridge)
   - Message format examples (weight, status, error)
   - Reconnection logic (exponential backoff)

5. **UI Component Hierarchy:**
   - 1280x1024 layout grid (top bar, header, 3-panel main, bottom bar)
   - Progress bar with tolerance zones (green/yellow/red)
   - Item grid with trash/search action icons

6. **Error Handling & Edge Cases:**
   - Scale disconnected during picking
   - Weight out of tolerance range
   - Lot has zero available qty (all committed)
   - Concurrent lot picking conflict

7. **Testing Strategy:**
   - Unit tests: FEFO algorithm, weight validation, label generation
   - Integration tests: 4-phase pick transaction, unpick rollback
   - E2E tests: Complete picking workflow (Playwright)

8. **Deployment Plan:**
   - Docker Compose setup (frontend Nginx + backend Rust)
   - .NET bridge service installation (existing installer-package)
   - PWA manifest & service worker config

**Please review this brief thoroughly and proceed with PRD creation, asking for any necessary clarifications or suggesting improvements based on modern PWA and Rust/React best practices.**

---

**Document Version:** 1.0 (Draft)
**Last Updated:** 2025-10-06
**Next Review:** After PRD completion
**Owner:** Development Team
**Stakeholders:** Operations Team, IT Infrastructure, Quality Assurance
