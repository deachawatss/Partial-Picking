# Product Requirements Document: Partial Picking System PWA

**Version:** 1.0
**Date:** 2025-10-06
**Status:** MVP Specification
**Product Owner:** [To be assigned]
**Technical Lead:** [To be assigned]

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Strategy](#3-product-vision--strategy)
4. [Target Users & Personas](#4-target-users--personas)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [Technical Architecture](#6-technical-architecture)
7. [Functional Requirements - MVP](#7-functional-requirements---mvp)
8. [User Interface Specifications](#8-user-interface-specifications)
9. [Database Schema & API Design](#9-database-schema--api-design)
10. [Business Rules & Validation](#10-business-rules--validation)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Out of Scope (Phase 2+)](#12-out-of-scope-phase-2)
13. [Release Plan](#13-release-plan)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

### 1.1 Product Overview

A modern **Progressive Web Application (PWA)** for warehouse partial picking operations that replaces the existing desktop application with a responsive, real-time weight scale-integrated system. The PWA will provide workstation operators with an intuitive interface for picking materials with live weight monitoring, FEFO-based lot selection, tolerance validation, automatic label printing via Windows print system, and complete inventory tracking.

**Key Innovation:** Automated FEFO (First Expired, First Out) bin selection with real-time weight integration, eliminating manual bin selection while ensuring optimal inventory rotation and regulatory compliance.

### 1.2 Business Impact

**Operational Efficiency:**
- **30-45 second time saving per pick** (automated bin selection vs manual lookup)
- **20% reduction in batch completion time** (30 min → 24 min per batch)
- **Zero-install deployment** across all workstations (instant updates, no downtime)

**Compliance & Quality:**
- **100% FEFO compliance** with automated earliest-expiry-first selection
- **99%+ weight accuracy** with real-time tolerance validation (±0.025 KG)
- **Complete audit trail** preservation for regulatory requirements

**System Availability:**
- **99.5% uptime** via PWA offline capability (vs 97% current)
- **Update deployment: 4 hours → 30 seconds** (no manual installation)

### 1.3 Target Deployment

- **Location:** TFC1 Warehouse (WHTFC1)
- **Workstations:** WS1, WS2, WS3, WS4 (expandable to 8+ stations)
- **Display:** 17-inch monitors @ 1280x1024 resolution (5:4 aspect ratio)
- **Database:** SQL Server TFCPILOT3 @ 192.168.0.86:49381

---

## 2. Problem Statement

### 2.1 Current State Challenges

**Technical Constraints:**
- Desktop-only deployment requiring individual installations across 4 workstations
- Manual update deployment causing downtime and version inconsistencies
- Limited real-time weight scale integration capabilities
- Older UI/UX patterns requiring modernization

**Operational Inefficiencies:**
- **Manual bin selection:** 30-45 seconds per pick, 2-3% error rate
- **No automated FEFO enforcement:** Operators must manually check expiry dates across multiple bins
- **Complex label printing:** ZPL programming limits printer compatibility
- **Scaling challenges:** Difficult to add new picking stations

### 2.2 Business Impact

- **Time Loss:** 30-45 seconds per pick × ~100 picks/shift = 50-75 minutes wasted daily
- **Compliance Risk:** Manual FEFO process leads to potential expired material usage
- **Operational Overhead:** IT team spends ~4 hours/month on desktop app updates
- **Error Rate:** 2-3% incorrect bin selection causes downstream rework

### 2.3 Why Existing Solutions Fall Short

- Current desktop app lacks automated lot rotation logic
- No intelligent bin selection based on expiry dates and available quantities
- Complex printer configuration limits hardware flexibility
- Manual processes prone to human error in high-volume picking scenarios

### 2.4 Urgency & Importance

- **Database & workflows fully documented:** Schema v2.5, PickingFlow v1.7 provide complete blueprint
- **Infrastructure ready:** .NET 8 WebSocket bridge service production-tested, dual-scale support configured
- **Compliance pressure:** Food safety regulations require strict FEFO adherence with audit trails
- **Scalability needs:** Plans to expand from 4 to 8+ workstations within 6 months

---

## 3. Product Vision & Strategy

### 3.1 Product Vision

**"Empower warehouse operators with intelligent, automated picking that eliminates manual decisions while ensuring 100% compliance and accuracy."**

### 3.2 Core Differentiators

#### 1. Automated FEFO Bin Selection
- User scans/searches lot number → System automatically selects optimal bin
- Prioritizes earliest expiry date (DateExpiry ASC)
- Filters out bins with zero available quantity (`QtyOnHand - QtyCommitSales <= 0`)
- Excludes non-PARTIAL bins (enforces TFC1, WHTFC1, PARTIAL filter)
- **Result:** 30-45 second time saving per pick, zero expiry date lookup errors

#### 2. Zero-Install Progressive Deployment
- Instant updates across all workstations (no manual deployment)
- Offline capability with service worker caching
- Native app-like experience via PWA manifest
- **Result:** Update deployment from 4 hours → 30 seconds

#### 3. Simplified Print Integration
- Windows native print system (no ZPL programming required)
- HTML/CSS print templates with `@media print` optimization
- 4×4" label format using browser print API
- **Result:** Compatible with any Windows-supported printer

#### 4. Dual-Scale Real-Time Monitoring
- Concurrent SMALL/BIG scale WebSocket streams
- Sub-400ms weight updates with visual progress bar
- Color-coded tolerance validation (Green: valid, Red: out of range, Yellow: unstable)
- **Result:** Immediate visual feedback, reduced picking errors

### 3.3 Why This Solution Will Succeed

**Technical Foundation:**
- Proven database schema (v2.5) with real production data patterns (Run 213972, 213989, 6000037)
- Existing .NET bridge service handles hardware complexity (serial ports, scale communication)
- Rust backend provides performance + safety for high-concurrency workload (4-8 workstations)

**Operational Alignment:**
- Exact replication of validated picking workflows from PickingFlow.md
- FEFO automation matches food safety compliance requirements
- 1280×1024 optimization fits existing workstation hardware

**User Experience:**
- Simplified workflow: Scan → Auto-select bin → Fetch weight → Save → Print
- Visual tolerance indicators reduce cognitive load
- Progressive enhancement supports offline operation during network issues

---

## 4. Target Users & Personas

### 4.1 Primary User: Warehouse Picking Operators

**Demographic Profile:**
- Factory floor workers at TFC1 warehouse (WHTFC1)
- Operating fixed workstations: WS1, WS2, WS3, WS4
- Age range: 25-55 years old
- Technical proficiency: Basic computer skills (familiar with desktop picking app)
- Shift pattern: 8-hour shifts, 2-3 operators per shift

**Current Workflow (Manual Process):**
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

**Pain Points:**
- **Time Pressure:** Need to complete batches quickly to meet production schedules
- **Manual Errors:** Selecting wrong bin or recording incorrect weight causes downstream issues
- **Expiry Date Confusion:** Multiple lots with similar expiry dates lead to FEFO mistakes
- **Weight Tolerance Stress:** Uncertainty about acceptable weight range (±0.025 KG) causes hesitation
- **Print Reliability:** Label printer failures create bottlenecks (material can't move without label)
- **System Downtime:** Desktop app updates require shutdown during peak hours

**Goals:**
- Complete assigned batches accurately and efficiently (target: <30 min per batch)
- Maintain zero expiry date compliance violations (FEFO adherence)
- Minimize picking errors that require rework (weight tolerance violations)
- Reduce waiting time for system responses and label printing
- Work confidently with clear visual feedback on weight and tolerance status

### 4.2 Secondary User: Warehouse Supervisors

**Profile:**
- Oversee 2-4 picking operators per shift
- Monitor picking progress and inventory levels
- Troubleshoot issues (scale problems, printer failures, lot shortages)
- Generate shift reports and performance metrics

**Needs (Phase 2 Consideration):**
- Real-time dashboard view of all workstation statuses
- Mobile/tablet access for floor monitoring
- Alerts for stuck batches or repeated errors
- Performance analytics (picks per hour, accuracy rates)

---

## 5. Goals & Success Metrics

### 5.1 Business Objectives

#### 1. Operational Efficiency
- **Goal:** Reduce average batch completion time by 20%
- **Current:** 30 minutes per batch
- **Target:** 24 minutes per batch
- **Metric:** Track completion timestamps (PickingDate) across 100 batches pre/post deployment
- **Timeline:** Achieve by Week 4 post-MVP launch

#### 2. Compliance Adherence
- **Goal:** 100% FEFO compliance with automated bin selection
- **Metric:** Zero expiry date violations in audit logs (LotMaster.DateExpiry vs pick date)
- **Target:** Maintain through first 90 days of operation

#### 3. System Availability
- **Goal:** Increase uptime from 97% to 99.5% via PWA offline capability
- **Metric:** Track workstation availability (operational hours / scheduled hours)
- **Target:** 99.5% uptime within 8 weeks post-deployment

#### 4. Deployment Agility
- **Goal:** Reduce update deployment time from 4 hours to <5 minutes
- **Metric:** Time from code merge to all workstations running new version
- **Target:** Immediate (PWA instant refresh)

### 5.2 User Success Metrics

#### 1. Pick Accuracy
- **Metric:** Weight tolerance compliance rate (picks within INMAST.User9 ±0.025 KG range)
- **Current:** 97%
- **Target:** 99%+
- **Measurement:** Compare PickedPartialQty against calculated weight range

#### 2. Task Completion Rate
- **Metric:** Percentage of batches completed without errors/rework
- **Target:** 98%+ first-pass success rate
- **Measurement:** Track unpick/delete operations (Cust_PartialLotPicked deletions)

#### 3. User Adoption
- **Metric:** Operator preference survey (PWA vs old desktop app)
- **Target:** 90% preference for PWA within 2 weeks
- **Measurement:** Weekly satisfaction survey (1-5 scale, target avg 4.2+)

#### 4. Cognitive Load Reduction
- **Metric:** Time spent on bin selection (scan lot → save)
- **Current:** 30-45 seconds manual lookup
- **Target:** <10 seconds
- **Measurement:** Frontend timer tracking (lot scan timestamp → save timestamp)

### 5.3 Key Performance Indicators (KPIs)

| KPI | Definition | Target | Measurement Method |
|-----|------------|--------|-------------------|
| **Weight Update Latency** | Time from scale reading to UI display | <500ms (p95) | WebSocket message timestamp delta |
| **API Response Time** | Backend query execution (picking operations) | <200ms (p95) | Rust Axum middleware metrics |
| **Label Print Success Rate** | Successful prints / total print attempts | 99.9% | Windows print queue success logs |
| **PWA Install Rate** | Workstations with PWA installed | 100% (4/4) | Service worker registration logs |
| **FEFO Auto-Selection Accuracy** | Correct bin selected (earliest expiry) | 100% | Audit LotMaster.DateExpiry ordering |
| **Offline Capability** | Operations completed while network down | 95%+ (read-only) | Service worker cache hit rate |
| **Concurrent User Support** | Simultaneous workstations without degradation | 4 (MVP), 8 (Phase 2) | Load testing, DB connection pool |

---

## 6. Technical Architecture

### 6.1 Technology Stack

**Frontend:**
- **Framework:** React 19 with TypeScript
- **Styling:** Tailwind CSS (custom theme: brown/orange primary colors)
- **PWA Features:** Service Worker, Web App Manifest, offline caching
- **State Management:** React Context API + hooks
- **Real-time:** WebSocket client for scale integration

**Backend:**
- **Language/Framework:** Rust with Axum web framework
- **Database:** SQL Server (via sqlx or tiberius driver)
- **WebSocket Proxy:** Rust Axum WS endpoint → .NET 8 bridge service
- **Authentication:** Session-based with LDAP/SQL dual support

**Infrastructure:**
- **Database:** SQL Server TFCPILOT3 @ 192.168.0.86:49381
- **Scale Integration:** .NET 8 WebSocket bridge service (COM port serial communication)
- **Deployment:** Static hosting (Nginx/Caddy) for PWA, Rust backend as systemd service
- **Print System:** Windows native print API (browser `window.print()`)

### 6.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Workstations (WS1-WS4)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │         React PWA (Browser - 1280x1024)          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │  │
│  │  │ Picking UI │  │ WS Client  │  │  Print    │  │  │
│  │  │  (React)   │  │ (Scale)    │  │  (Native) │  │  │
│  │  └──────┬─────┘  └─────┬──────┘  └─────┬─────┘  │  │
│  └─────────┼──────────────┼─────────────────┼────────┘  │
│            │              │                 │           │
│            │ HTTP/REST    │ WebSocket       │ Windows   │
│            │              │                 │ Print API │
└────────────┼──────────────┼─────────────────┼───────────┘
             ▼              ▼                 ▼
    ┌────────────────┐ ┌─────────────────────────────┐
    │  Rust Backend  │ │  .NET 8 Bridge Service      │
    │  (Axum)        │ │  (Scale COM Port Reader)    │
    │                │ │                             │
    │ • REST API     │ │ • Serial Port (SMALL/BIG)   │
    │ • WS Proxy     │ │ • Weight broadcast          │
    │ • Auth         │ │ • TFC_Weightscale2 config   │
    └────────┬───────┘ └─────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  SQL Server TFCPILOT3           │
    │  • 13 Core Tables               │
    │  • FEFO Query Logic             │
    │  • Inventory Commitment         │
    └─────────────────────────────────┘
```

### 6.3 Database Connection

```env
# Environment Configuration
DATABASE_SERVER=192.168.0.86
DATABASE_PORT=49381
DATABASE_NAME=TFCPILOT3
DATABASE_USERNAME=NSW
DATABASE_PASSWORD=B3sp0k3

# Connection String (SQL Server)
Server=192.168.0.86,49381;Database=TFCPILOT3;User Id=NSW;Password=B3sp0k3;TrustServerCertificate=True;
```

### 6.4 Scale Integration Architecture

**Dual-Scale Configuration:**

| Workstation | SMALL Scale | BIG Scale |
|-------------|-------------|-----------|
| WS1 | TFC_Weightscale2.ScaleId → COM port | TFC_Weightscale2.ScaleId → COM port |
| WS2 | TFC_Weightscale2.ScaleId → COM port | TFC_Weightscale2.ScaleId → COM port |
| WS3 | TFC_Weightscale2.ScaleId → COM port | TFC_Weightscale2.ScaleId → COM port |
| WS4 | TFC_Weightscale2.ScaleId → COM port | TFC_Weightscale2.ScaleId → COM port |

**Scale Configuration Tables:**
- `TFC_Weightscale2`: Hardware registry (ScaleId, ScaleType, ComPort, BaudRate, Status)
- `TFC_workstation2`: Workstation mapping (WorkstationId, SmallScaleId, BigScaleId)

**WebSocket Protocol:**
```typescript
// Frontend connects to Rust proxy
const ws = new WebSocket('ws://localhost:5000/ws/scale/SMALL');

// Weight message format
{
  type: 'weight',
  data: {
    weight: 20.0025,
    unit: 'KG',
    stable: true,
    timestamp: '2025-10-06T10:04:15.000Z'
  }
}

// Status message format
{
  type: 'status',
  data: {
    connected: true,
    port: 'COM3',
    error: null
  }
}
```

---

## 7. Functional Requirements - MVP

### 7.1 Feature Overview

| # | Feature | Priority | Complexity | Status |
|---|---------|----------|------------|--------|
| F1 | Run No Search & Auto-Population | P0 | Medium | MVP |
| F2 | Automated FEFO Bin Selection | P0 | High | MVP |
| F3 | Dual-Scale Weight Integration | P0 | High | MVP |
| F4 | Manual Weight Entry (Keyboard) | P1 | Low | MVP |
| F5 | Save & Transaction Workflow | P0 | High | MVP |
| F6 | Windows Native Label Printing | P0 | Medium | MVP |
| F7 | View Lots Modal | P1 | Medium | MVP |
| F8 | Unpick/Delete Functionality | P1 | Medium | MVP |
| F9 | Run Completion & Print Button | P0 | Medium | MVP |
| F10 | Search Modals (4 types) | P1 | Medium | MVP |

---

### 7.2 F1: Run No Search & Auto-Population

**Purpose:** When user searches for a Run No, the system automatically populates all header fields and loads batch/item data.

#### Data Flow

**Step 1: Search Run No → Auto-Populate Header**

```sql
SELECT
    RunNo,
    RowNum,
    BatchNo,
    FormulaId AS FGItemKey,        -- FG = Finished Goods
    FormulaDesc AS FGDescription,
    NoOfBatches AS Batches,
    Status
FROM Cust_PartialRun
WHERE RunNo = @RunNo
ORDER BY RowNum;
```

**Step 2: Load ALL Items from ALL Batches**

```sql
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
```

#### Field Mappings

| UI Display | Database Source | Calculation/Notes |
|------------|----------------|-------------------|
| Run No | `Cust_PartialRun.RunNo` | Direct value |
| FG Item Key | `Cust_PartialRun.FormulaId` | Finished Goods item code |
| FG Description | `Cust_PartialRun.FormulaDesc` | Product name/description |
| Batch No | `Cust_PartialRun.BatchNo` | Varies per RowNum (batch) |
| Batches | `Cust_PartialRun.NoOfBatches` | Total number of batches |
| **Production Date** | **Client-side: Today's date** | **Bangkok timezone (Asia/Bangkok), Format: DD/MM/YY** |
| Item Key | `cust_PartialPicked.ItemKey` | Raw material/ingredient code |
| Description | `INMAST.Desc1` | Item description from master |
| Weight Range Low | Calculated | `ToPickedPartialQty - INMAST.User9` |
| Weight Range High | Calculated | `ToPickedPartialQty + INMAST.User9` |
| Total Needed | `cust_PartialPicked.ToPickedPartialQty` | Target weight to pick |
| Remaining Qty | Calculated | `ToPickedPartialQty - PickedPartialQty` |

#### Real Example - Run 6000037

**Auto-Populated Header:**
- Run No: `6000037`
- FG Item Key: `TSM2285A` (from FormulaId)
- FG Description: `Marinade, Savory` (from FormulaDesc)
- Batch No: `850417` (RowNum 1) or `850416` (RowNum 2)
- Batches: `2` (from NoOfBatches)
- **Production Date: `06/10/25`** (today's date in Bangkok timezone, DD/MM/YY format)

**Auto-Populated Item (INRICF05):**
- Item Key: `INRICF05`
- Description: `Rice Flour (RF-0010)` (from INMAST.Desc1)
- Weight Range: `14.215 - 14.265 KG` (14.24 ± 0.025)
- Total Needed: `14.24 KG`
- Remaining Qty: `14.24 KG`

#### UI Workflow

1. User enters Run No → Press Enter/Search
2. System queries `Cust_PartialRun` → Auto-fills FG Item Key, FG Description, Batches, **Production Date (today)**
3. User selects Batch → Dropdown shows batches (RowNum 1, 2, ...)
4. System queries `cust_PartialPicked` + `INMAST` → Auto-fills ItemKey, Description, Weight Range, Total Needed
5. **Right-side grid displays ALL items from ALL batches**, ordered by ItemKey alphabetically
6. Ready for picking

#### Validation Rules

- Run No must exist in `Cust_PartialRun`
- Status must be 'NEW' or 'PRINT' (not archived/cancelled)
- Weight range calculation requires `INMAST.User9` non-null
- Remaining Qty cannot be negative

#### API Endpoints

```typescript
GET    /api/runs/:runNo                   // Get run header with auto-population data
GET    /api/runs/:runNo/items              // Get ALL items from ALL batches for run
GET    /api/runs/:runNo/batches/:rowNum    // Get specific batch details
```

---

### 7.3 F2: Automated FEFO Bin Selection with Lot Search

**Purpose:** Eliminate manual bin selection by automatically choosing the optimal bin based on FEFO (First Expired, First Out) algorithm.

#### Stock on Hand (SOH) Calculation

**Formula:**
```
AvailableQty = QtyOnHand - QtyCommitSales
```

**Components:**
- **QtyOnHand:** Total physical quantity in the BIN/Lot (actual inventory)
- **QtyCommitSales:** Quantity already committed/reserved for sales orders
- **AvailableQty:** Actual usable quantity available for picking

**Key Principle:** SOH is NOT just `QtyOnHand` - it's the Available Quantity after subtracting commitments.

#### FEFO Algorithm

```sql
-- Auto-select best bin when user searches/scans lot number
SELECT TOP 1
    lm.LotNo,
    lm.BinNo,
    lm.QtyOnHand,                                            -- Physical stock
    lm.QtyCommitSales,                                       -- Reserved stock
    (lm.QtyOnHand - lm.QtyCommitSales) AS AvailableQty,     -- Usable stock
    lm.DateExpiry,
    lm.LotStatus,
    bm.Description AS BinDescription
FROM LotMaster lm
INNER JOIN BINMaster bm
    ON lm.BinNo = bm.BinNo
    AND lm.LocationKey = bm.Location
WHERE lm.LotNo = @lotNo
    AND lm.ItemKey = @itemKey
    -- BIN Location Filters (PARTIAL bins only at TFC1)
    AND bm.Location = 'TFC1'
    AND bm.User1 = 'WHTFC1'
    AND bm.User4 = 'PARTIAL'
    -- Stock Validation (multi-layer checks)
    AND lm.QtyOnHand > 0                                    -- RULE 1: Physical stock exists
    AND (lm.QtyOnHand - lm.QtyCommitSales) > 0             -- RULE 2: Available stock exists
    -- Lot Status Validation
    AND (lm.LotStatus IN ('P', 'C', '') OR lm.LotStatus IS NULL)  -- RULE 3: Pick-enabled
    AND lm.LotStatus NOT IN ('B', 'D', 'E', 'F', 'H', 'L', 'T', 'W')  -- RULE 4: Exclude blocked
ORDER BY
    lm.DateExpiry ASC,                                      -- FEFO PRIMARY: Earliest expiry first
    (lm.QtyOnHand - lm.QtyCommitSales) DESC                -- FEFO TIEBREAKER: Highest available qty
```

#### Lot Status Codes

**Include (Pick-Enabled):**
- `P` - Pick/Pass (available for use)
- `C` - Cycle Count
- `''` - Empty string (default)
- `NULL` - Not set

**Exclude (Blocked):**
- `B` - Blocked
- `D` - Damaged
- `E` - Expired
- `F` - Failed QC
- `H` - Hold
- `L` - Locked
- `T` - In Transit
- `W` - Withdrawn

#### User Workflow

1. **Scan or Search Lot Number**
   - Barcode scanner input (primary)
   - Manual text search with autocomplete

2. **System Auto-Selects Best Bin (FEFO)**
   - Executes FEFO query
   - Selects bin with earliest expiry + sufficient stock
   - Filters TFC1 PARTIAL bins only

3. **Display Auto-Selected Bin**
   - Bin No: `PWBB-12` (large, bold)
   - Expiry Date: `2028-04-23` (color-coded: Red <30 days, Yellow 30-90 days, Green >90 days)
   - **Stock Breakdown:**
     - Physical Stock (QtyOnHand): `588.927 KG`
     - Committed (QtyCommitSales): `20.000 KG` (reserved)
     - **Available: `568.927 KG`** (bold, highlighted)
   - Lot Status: `P` (Pick-enabled)
   - Selection Reason: "Selected: Earliest expiry with sufficient stock"

4. **Manual Override (Optional)**
   - "Change Bin" link allows supervisor override
   - Logs override reason in audit trail

#### Validation Rules

- **FEFO Compliance:** Earliest expiry takes precedence over bin location proximity
- **Tiebreaker:** If same expiry date, prefer highest available quantity
- **Validation Failure:** Show error if no valid bins available ("No available bins for this lot")
- **Real-Time Calculation:** Available quantity calculated dynamically (no cached values)

#### API Endpoints

```typescript
GET    /api/lots/:lotNo/fefo-bin?itemKey=&runNo=&rowNum=&lineId=
       // Get FEFO-selected bin for lot
GET    /api/lots/:lotNo/bins?itemKey=
       // Get all bins for lot (manual override)
```

---

### 7.4 F3: Dual-Scale Weight Integration

**Purpose:** Real-time weight monitoring from SMALL or BIG scales via WebSocket with visual progress indicators.

#### Scale Configuration

**Hardware Setup:**
- Each workstation (WS1-WS4) has 2 scales: SMALL and BIG
- Configuration stored in `TFC_Weightscale2` (ScaleId, ScaleType, ComPort, BaudRate)
- Workstation mapping in `TFC_workstation2` (SmallScaleId, BigScaleId)

**WebSocket Endpoints:**
```typescript
ws://localhost:5000/ws/scale/SMALL    // Connect to SMALL scale
ws://localhost:5000/ws/scale/BIG      // Connect to BIG scale
```

#### Frontend Integration

```typescript
// Connection setup
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

#### Real-Time Weight Display

**Progressive Bar Visualization:**
- Min: `TargetQty - INMAST.User9` (e.g., 19.975 KG)
- Max: `TargetQty + INMAST.User9` (e.g., 20.025 KG)
- Current: Live scale reading (e.g., 20.002 KG)

**Color Coding:**
- **Green:** Weight within tolerance range AND stable
- **Yellow:** Weight within range but UNSTABLE (fluctuating)
- **Red:** Weight outside tolerance range
- **Gray:** Scale disconnected or no reading

#### Fetch Weight Button Logic

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
  setWeightSource('automatic');

  // Enable "Add Lot" button
  setAddLotEnabled(true);
}
```

#### Weight Tolerance Validation

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

#### Edge Cases & Fallback

**Scale-Related:**
- **Scale disconnected:** Gray status, disable "Fetch Weight", enable manual entry
- **Weight unstable:** Yellow indicator, show "Stabilizing...", manual entry available
- **Weight out of range:** Red indicator, disable "Add Lot", show exact deficit/excess

---

### 7.5 F4: Manual Weight Entry with On-Screen Keyboard

**Purpose:** Provide fallback weight input when scale malfunctions or for manual override scenarios.

#### Trigger Methods

1. **Click weight display field** → Opens numeric keyboard
2. **Click "Enter Weight Manually" button** → Opens numeric keyboard

#### Keyboard Layout (1280x1024 Optimized)

```
┌─────┬─────┬─────┬─────────┐
│  7  │  8  │  9  │  CLEAR  │
├─────┼─────┼─────┼─────────┤
│  4  │  5  │  6  │    ←    │
├─────┼─────┼─────┼─────────┤
│  1  │  2  │  3  │  ENTER  │
├─────┼─────┼─────┤  (OK)   │
│  0  │  .  │ DEL ├─────────┤
└─────┴─────┴─────┤ CANCEL  │
                   └─────────┘
```

#### Validation Rules

- **Decimal limit:** Maximum 4 decimal places (e.g., 20.0025)
- **Single decimal:** Only one decimal point allowed
- **Range validation:** Weight must be within tolerance (WeightRangeLow to WeightRangeHigh)
- **Invalid input:** Show error in keyboard modal, keep open for correction

#### Implementation

```typescript
interface NumericKeyboardProps {
  onConfirm: (weight: number) => void;
  onCancel: () => void;
  currentValue?: number;
  minValue: number;  // WeightRangeLow
  maxValue: number;  // WeightRangeHigh
}

function handleConfirm() {
  const weight = parseFloat(inputValue);

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

  onConfirm(weight);
}
```

#### Audit Trail

- Track weight source: `WeightSource` field ('automatic' | 'manual')
- Log manual entries with user ID and timestamp
- Include weight source in labels (small indicator: "A" auto, "M" manual)

---

### 7.6 F5: Save & Transaction Workflow

**Purpose:** Complete pick transaction using the verified 4-phase pattern from production data.

#### 4-Phase Transaction Pattern

**Phase 1: Lot Allocation**
```sql
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
-- ✅ VERIFIED: This executes during picking
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @fetchedWeight
WHERE LotNo = @lotNo
  AND ItemKey = @itemKey
  AND LocationKey = 'TFC1'
  AND BinNo = @binNo;
```

#### Transaction Atomicity

All 4 phases must execute within a single database transaction:

```rust
// Rust implementation
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

#### Error Handling

- Database transaction rollback on any failure
- Show specific error to user: "Save failed: [reason]"
- Log full error to backend for debugging
- Retry mechanism (max 3 attempts) for transient network errors

---

### 7.7 F6: Windows Native Label Printing

**Purpose:** Auto-print individual item labels (4×4") on save, and batch summary labels on completion.

#### Individual Item Label (4×4" - Auto-Print on Save)

**Label Content:**
```
┌─────────────────────────────┐
│      INSAPP01               │  ← ItemKey (Large, Bold)
│      7.01        KG         │  ← PickedPartialQty + UOM
│      843856                 │  ← BatchNo (Blue color)
│   2510591                   │  ← LotNo
│   DECHAWAT 06/10/2025       │  ← User + Date (PickingDate)
│   10:04:18AM                │  ← Time
│                             │
│  *INSAPP01--7.01*           │  ← Barcode Text
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │  ← Code 128 Barcode
└─────────────────────────────┘
```

**Data Source SQL:**
```sql
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
WHERE cp.RunNo = @RunNo
    AND cp.RowNum = @RowNum
    AND cp.LineId = @LineId
    AND cp.PickedPartialQty > 0;
```

**Print Function:**
```typescript
async function printIndividualLabel(pickData: PickedItem) {
  // Generate HTML from template
  const labelHtml = generateLabelHtml({
    ItemKey: pickData.itemKey,
    PickedQty: pickData.pickedQty.toFixed(2),
    BatchNo: pickData.batchNo,
    LotNo: pickData.lotNo,
    User: pickData.modifiedBy,
    Date: formatDate(pickData.pickingDate),
    Time: formatTime(pickData.pickingDate)
  });

  // Print via hidden iframe
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  frameDoc?.open();
  frameDoc?.write(labelHtml);
  frameDoc?.close();

  // Trigger Windows print
  printFrame.contentWindow?.print();

  // Cleanup
  setTimeout(() => document.body.removeChild(printFrame), 1000);
}
```

#### Batch Summary Label (4×4" - Print on Completion)

**Label Content:**
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
│  ...                                         │
└─────────────────────────────────────────────┘
```

**Trigger:** When `Status = 'PRINT'` (all items in all batches picked)

**Print Function:**
```typescript
async function printBatchSummaryLabels(runNo: number) {
  const batches = await db.query(`
    SELECT RunNo, RowNum, BatchNo, NoOfBatches, FormulaId, FormulaDesc
    FROM Cust_PartialRun
    WHERE RunNo = @runNo AND Status = 'PRINT'
    ORDER BY RowNum
  `, { runNo });

  for (const batch of batches) {
    const items = await getPickedItemsForBatch(batch.RunNo, batch.RowNum);

    const label = {
      printDateTime: formatDateTime(new Date()),
      productCode: batch.FormulaId,
      productName: batch.FormulaDesc,
      runNo: batch.RunNo,
      batchNo: batch.BatchNo,
      productionDate: formatDate(new Date()),
      pageNum: batch.RowNum,
      totalPages: batch.NoOfBatches,
      items: items
    };

    const html = generateBatchSummaryHTML(label);
    await printDocument(html);
  }
}
```

#### Print Configuration

- **Auto-Print (Individual):** Print immediately on each save (no dialog)
- **Manual Print (Summary):** Print button enabled when all items picked, shows Windows print dialog
- **Printer Selection:** Use Windows default printer or allow user selection
- **Fallback:** If print fails, offer "Download PDF" option

---

### 7.8 F7: View Lots Modal

**Purpose:** Display all picked lots for current run with options to re-print labels or delete (unpick) individual items.

#### Modal Layout (Two-Panel Split View)

**Left Panel - "Picked Lot Details":**
- Displays all PICKED items (`ItemBatchStatus = 'Allocated'`)
- Columns: Batch No, Lot No, Item Key, Location Key, Expiry Date, Qty Received, Bin No, Pack Size
- Row selection: Click to select (highlighted in blue)
- Multi-select: Ctrl+Click or Shift+Click

**Right Panel - "Pending To Picked":**
- Displays all PENDING items (`ItemBatchStatus = NULL`)
- Same column structure
- Read-only view (no actions)

#### Data Retrieval

```sql
-- Picked items (left panel)
SELECT
    pl.RunNo, pl.RowNum, pl.BatchNo, pl.LineId,
    pl.LotNo, pl.ItemKey, pl.LocationKey, pl.BinNo,
    pl.DateExpiry, pl.QtyReceived, pl.AllocLotQty,
    pl.RecDate AS PickingDate,
    cp.PackSize
FROM Cust_PartialLotPicked pl
INNER JOIN cust_PartialPicked cp
    ON pl.RunNo = cp.RunNo
    AND pl.RowNum = cp.RowNum
    AND pl.LineId = cp.LineId
WHERE pl.RunNo = @RunNo
ORDER BY pl.BatchNo, pl.ItemKey, pl.LineId;

-- Pending items (right panel)
SELECT
    cp.RunNo, cp.RowNum, cp.BatchNo, cp.LineId,
    cp.ItemKey, cp.LocationKey,
    cp.ToPickedPartialQty, cp.PackSize
FROM cust_PartialPicked cp
WHERE cp.RunNo = @RunNo
    AND (cp.ItemBatchStatus IS NULL OR cp.ItemBatchStatus != 'Allocated')
ORDER BY cp.BatchNo, cp.ItemKey, cp.LineId;
```

#### Bottom Action Buttons

**1. Re-Print Button (Orange checkmark):**
- Enabled when: One or more picked items selected
- Action: Re-prints individual label(s) for selected item(s)
- Uses same 4×4" template as auto-print

**2. Delete Button (Red X):**
- Enabled when: One or more picked items selected
- Action: Unpicks selected item(s) - reverses picking transaction
- Confirmation dialog: "Delete {{count}} picked item(s)? This will restore inventory."
- Executes unpick transaction for each selected item

**3. Ok Button (Green checkmark):**
- Always enabled
- Action: Closes modal
- Returns to main picking screen

#### Modal Behavior

- Size: 900px wide × 600px high
- Backdrop: Semi-transparent dark overlay
- Close triggers: Ok button, Escape key, click outside
- Auto-refresh: Panels update after delete operation

---

### 7.9 F8: Unpick/Delete Functionality

**Purpose:** Reverse picking transaction while preserving audit trail.

#### Backend DELETE Operation

```typescript
async function unpickSingleLine(runNo: number, rowNum: number, lineId: number) {
  await db.transaction(async (tx) => {

    // Step 1: Get lot allocation details BEFORE deleting
    const lotAlloc = await tx.query(`
      SELECT LotNo, ItemKey, LocationKey, BinNo, AllocLotQty
      FROM Cust_PartialLotPicked
      WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId
    `, { runNo, rowNum, lineId });

    // Step 2: Reset PickedPartialQty to 0 ONLY
    await tx.execute(`
      UPDATE cust_PartialPicked
      SET PickedPartialQty = 0
      WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId
    `, { runNo, rowNum, lineId });
    // NOTE: ItemBatchStatus, PickingDate, ModifiedBy remain UNCHANGED

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
    }

    // Step 4: Delete lot allocation record
    await tx.execute(`
      DELETE FROM Cust_PartialLotPicked
      WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId
    `, { runNo, rowNum, lineId });

    // Step 5: Delete lot transaction record
    const batchNo = await getBatchNo(runNo, rowNum);
    await tx.execute(`
      DELETE FROM LotTransaction
      WHERE IssueDocNo = @batchNo AND IssueDocLineNo = @lineId
    `, { batchNo, lineId });
  });
}
```

#### What Changes (Verified from Real Data)

**cust_PartialPicked:**
- ✅ `PickedPartialQty` → 0 (weight cleared)
- ⚠️ `ItemBatchStatus` → Remains "Allocated" (NOT reset)
- ⚠️ `PickingDate` → Preserved (audit trail)
- ⚠️ `ModifiedBy`, `ModifiedDate` → Preserved (audit trail)

**Cust_PartialLotPicked:**
- ✅ Record deleted completely

**LotTransaction:**
- ✅ Record deleted completely

**LotMaster:**
- ✅ `QtyCommitSales` → Decremented by AllocLotQty
- ✅ Available qty restored: `QtyOnHand - QtyCommitSales`

#### UI Display Logic

```typescript
const isUnpicked = pickedQty === 0 && batchStatus === 'Allocated';
const isPicked = pickedQty > 0 && batchStatus === 'Allocated';
const isNotStarted = pickedQty === 0 && batchStatus === null;

if (isPicked) return "✅ Picked";
else if (isUnpicked) return "⚠️ Unpicked (reset)";
else return "⏳ Pending";
```

---

### 7.10 F9: Run Completion & Print Button

**Purpose:** Finalize picking run when all items are picked, assign pallet, change status to PRINT.

#### Print Button Behavior

- **Disabled State:** Grayed out until all items picked
- **Enable Condition:** When ALL items have `ItemBatchStatus = 'Allocated'`
- **Action:** Prints batch summary labels (1 label per batch)

#### Trigger Condition

```sql
-- Check if run is ready for completion
SELECT
    COUNT(*) as TotalItems,
    COUNT(CASE WHEN ItemBatchStatus = 'Allocated' THEN 1 END) as PickedItems
FROM cust_PartialPicked
WHERE RunNo = @RunNo;

-- Run is complete when TotalItems = PickedItems
```

#### Completion Process

**Step 1: Get Next PalletID**
```sql
UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = 'PT';
SELECT SeqNum FROM Seqnum WHERE SeqName = 'PT';
```

**Step 2: Update Status (NEW → PRINT)**
```sql
UPDATE Cust_PartialRun
SET Status = 'PRINT', ModifiedDate = GETDATE()
WHERE RunNo = @RunNo;
```

**Step 3: Create Pallet Records**
```sql
INSERT INTO Cust_PartialPalletLotPicked (
    RunNo, RowNum, BatchNo, LineId, PalletID,
    RecUserid, RecDate
) VALUES (
    @RunNo, @RowNum, @BatchNo, 1, @PalletID,
    @UserId, GETDATE()
);
```

**Step 4: Print Batch Summary Labels**
- Automatically triggered when Status = 'PRINT'
- One 4×4" label per batch

#### UI Workflow

1. **During Picking:** Status = "NEW", Print button DISABLED
2. **Last Item Picked:** System detects all items allocated, Print button ENABLED
3. **User Clicks Print:** Backend assigns PalletID, Status → PRINT, labels print
4. **Completion Message:** "Run completed. Pallet ID: 623957"

---

### 7.11 F10: Search Modals (4 Types)

**Purpose:** Provide search/browse functionality for Run, Item, Lot, and Bin selection.

#### A. Run No Search Modal

**Columns:**
- Run No (primary key)
- FG Item Key (FormulaId)
- FG Item Description (FormulaDesc)
- Status ('NEW', 'PRINT')
- Batch Count (COUNT)

**SQL:**
```sql
SELECT DISTINCT
    RunNo,
    FormulaId,
    FormulaDesc,
    Status,
    COUNT(*) as BatchCount
FROM Cust_PartialRun
WHERE Status IN ('NEW', 'PRINT')
GROUP BY RunNo, FormulaId, FormulaDesc, Status
ORDER BY RunNo DESC
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
```

#### B. Item Key Search Modal

**Columns:**
- Item Key (ItemKey)
- Description (INMAST.Desc1)
- Line ID
- Location

**SQL:**
```sql
SELECT
    bp.ItemKey,
    bp.LineId,
    im.Desc1 as Description,
    bp.LocationKey as Location
FROM cust_PartialPicked bp
INNER JOIN INMAST im ON bp.ItemKey = im.ItemKey
WHERE bp.RunNo = @runNo
ORDER BY bp.LineId ASC
```

#### C. Lot No Search Modal (FEFO-Enabled)

**Columns:**
- Lot No
- Bin No (auto-selected by FEFO)
- Date Expiry (color-coded)
- QtyOnHand (Physical stock)
- CommittedQty (QtyCommitSales)
- **Qty Available** (bold - QtyOnHand - QtyCommitSales)

**SQL:** (See F2 FEFO Algorithm)

**Visual Indicators:**
- Red: <30 days until expiry
- Yellow: 30-90 days
- Green: >90 days or no expiry

#### D. Bin No Search Modal

**Columns:**
- Bin No
- Date Expiry
- QtyOnHand
- CommittedQty
- Qty Available

**Note:** Rarely used (FEFO auto-selects optimal bin)

#### Modal Interaction Patterns

1. **Open:** Click 🔍 icon or click read-only field
2. **Selection:** Click row → Auto-close → Populate field
3. **Search:** Live filter at top (client-side <100 records, server-side >100)
4. **Close:** ✕ button, backdrop click, Escape key, or select item

---

## 8. User Interface Specifications

### 8.1 Display Target

**Primary Display:**
- **Screen Size:** 17-inch monitors
- **Resolution:** 1280×1024 (5:4 aspect ratio)
- **Optimization:** Tailwind CSS custom breakpoint for exact 1280×1024

**Responsive Breakpoints (Phase 2):**
- 1920×1080 (expand grid, larger text)
- 1366×768 (compact mode, smaller padding)
- Mobile/Tablet (Phase 2 - supervisor view)

### 8.2 Main Layout (1280×1024)

#### Top Bar (Height: 80px)
- **Weight Display:** `0.0000 KG` (large, centered)
- **Scale Indicator:** SMALL / BIG toggle buttons (orange active state)
- **Status:** "Place item on scale" prompt

#### Header Row (Height: 60px)
- Run No, FG Item Key, Batches count, Production Date (DD/MM/YY)
- Status tabs: `PENDING TO PICKED` / `PICKED` (toggle view)

#### Main Content (Height: 780px, 3-column layout)

**Left Panel (Width: 380px) - Item Details:**
- Batch No (display only)
- Item Description (INMAST.Desc1)
- **Lot No (Input + Scan):** Text field with barcode scanner support
- **Bin No (Auto-selected, display only):** FEFO algorithm result
- **Stock on Hand (SOH) - Real-Time Breakdown:**
  - Physical Stock: `XXX.XXX KG` (QtyOnHand)
  - Committed: `XX.XXX KG` (QtyCommitSales - reserved)
  - **Available: `XXX.XXX KG`** (bold, highlighted - usable stock)
- Weight Range (Min - Max KG)
- Total Needed (ToPickedPartialQty)
- Remaining Qty (calculated)
- Allergens (W, SU, etc.)

**Center Panel (Width: 320px) - Actions:**
- `ADD LOT` button (orange, enabled when: lot scanned + weight valid)
- `VIEW LOTS` button (opens View Lots modal)
  - Re-Print: Re-print individual labels
  - Delete: Unpick selected items
- **Weight Display (Clickable):** Click to open numeric keyboard for manual entry
- `FETCH WEIGHT` button (orange, captures scale reading)
- `ENTER WEIGHT MANUALLY` button (blue, opens numeric keyboard)
- Visual progress bar: Current weight vs Target
- Color-coded zones: Green (valid), Yellow (unstable), Red (out of range)

**Right Panel (Width: 580px) - Item Grid (ALL batches):**
- **Displays ALL items from ALL batches**, ordered alphabetically by ItemKey
- Same ItemKey appears multiple times (once per batch)
- Columns: Item | Batch No | Partial | Weighted | Balance | Allergens | Actions
- Action icons: 🗑️ (delete/unpick), 🔍 (view lot details)
- Row highlighting: Completed (green tint), Pending (default)

#### Bottom Bar (Height: 64px)
- `PRINT` button (batch summary)
  - **Disabled (grayed):** Until all items picked
  - **Enabled (orange):** When all items `ItemBatchStatus = 'Allocated'`
  - **Action:** Prints batch summary (printsum.png format)
- `SAVE` button (orange, commits transaction)
- `EXIT` button (red)

### 8.3 Color Scheme

**Primary Colors:**
- Orange/Brown: `#FF8C00` (buttons, active states)
- Green: `#22C55E` (valid weight, completed items)
- Red: `#EF4444` (invalid weight, errors)
- Yellow: `#FACC15` (unstable weight, warnings)
- Gray: `#6B7280` (disabled states)

**Design System:**
- Tailwind CSS custom theme
- Monospace font for weight/numbers: `font-mono`
- Sans-serif for text: `font-sans`

---

## 9. Database Schema & API Design

### 9.1 Core Tables (13 Tables)

**Authentication:**
1. `tbl_user` - User authentication (SQL/LDAP dual support)

**Picking Transactions:**
2. `Cust_PartialRun` - Run master (FormulaId→FG Item Key)
3. `cust_PartialPicked` - Pick transactions (lowercase 'c'!)
4. `Cust_PartialPalletLotPicked` - Pallet-lot link
5. `Cust_PartialLotPicked` - Lot picking detail

**Lot Management:**
6. `LotMaster` - Lot inventory (QtyCommitSales commitment)
7. `LotTransaction` - Lot history

**Sequence & Bin:**
8. `Seqnum` - Sequence generator (PT for PalletID)
9. `BINMaster` - Bin locations (User4='PARTIAL' filter)
10. `BinTransfer` - Bin-to-bin transfers

**Item & Scale Config:**
11. `INMAST` - Item master (User9=absolute tolerance KG)
12. `TFC_Weightscale2` - Scale hardware config
13. `TFC_workstation2` - Workstation dual-scale mapping

### 9.2 Critical Field Mappings

| UI Display | Database Source | Notes |
|------------|----------------|-------|
| FG Item Key | `Cust_PartialRun.FormulaId` | Finished Goods code |
| FG Description | `Cust_PartialRun.FormulaDesc` | Product name |
| Production Date | **Client-side today's date** | Bangkok timezone DD/MM/YY |
| Weight Range | `ToPickedPartialQty ± INMAST.User9` | User9 = absolute KG, NOT % |
| Available Qty | `QtyOnHand - QtyCommitSales` | Real-time calculation |
| Picked Weight | `PickedPartialQty` | NOT PickedPartialQtyKG (always NULL) |

### 9.3 Composite Primary Keys

**Must include ALL key columns in WHERE clauses:**

```sql
-- cust_PartialPicked
WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId

-- LotMaster
WHERE LotNo = @lotNo AND ItemKey = @itemKey
  AND LocationKey = @locationKey AND BinNo = @binNo

-- Cust_PartialPalletLotPicked
WHERE RunNo = @runNo AND RowNum = @rowNum AND LineId = @lineId
```

### 9.4 REST API Endpoints

#### Authentication
```
POST   /api/auth/login          // SQL or LDAP authentication
POST   /api/auth/refresh        // Refresh token
GET    /api/auth/me             // Get current user
```

#### Run Management
```
GET    /api/runs                     // List runs
GET    /api/runs/:runNo              // Get run with auto-population
GET    /api/runs/:runNo/items        // Get ALL items from ALL batches
POST   /api/runs/:runNo/complete     // Complete run (assign pallet, status→PRINT)
```

#### Picking Operations
```
GET    /api/picks/pending?runNo=     // Get pending picks
POST   /api/picks                    // Create pick record (4-phase transaction)
DELETE /api/picks/:runNo/:rowNum/:lineId  // Unpick item
GET    /api/runs/:runNo/batches/:rowNum/picked-items  // For batch summary
```

#### Lot & Inventory
```
GET    /api/lots/:lotNo/fefo-bin?itemKey=  // Get FEFO-selected bin
GET    /api/inventory/lots?itemKey=        // Search lots (TFC1 PARTIAL bins)
GET    /api/inventory/available             // Available inventory
```

#### Print Operations
```
POST   /api/print/individual/:runNo/:rowNum/:lineId  // Get label data
POST   /api/print/batch-summary/:runNo               // Get summary labels
```

#### Weight Range
```
GET    /api/picking/weight-range/:runNo/:rowNum/:lineId  // Get tolerance validation
```

### 9.5 WebSocket Endpoints

```
WS     /ws/scale/SMALL          // SMALL scale weight stream
WS     /ws/scale/BIG            // BIG scale weight stream
```

**Message Format:**
```json
// Weight update
{
  "type": "weight",
  "data": {
    "weight": 20.0025,
    "unit": "KG",
    "stable": true,
    "timestamp": "2025-10-06T10:04:15.000Z"
  }
}

// Status update
{
  "type": "status",
  "data": {
    "connected": true,
    "port": "COM3",
    "error": null
  }
}
```

---

## 10. Business Rules & Validation

### 10.1 BIN Filtering (CRITICAL)

**ONLY use bins matching ALL criteria:**
```sql
WHERE Location = 'TFC1'
  AND User1 = 'WHTFC1'
  AND User4 = 'PARTIAL'
```

**Result:** 511 bins (all other 6,211 bins EXCLUDED)

### 10.2 FEFO Algorithm

**Primary Sort:** `DateExpiry ASC` (earliest expiry first)
**Tiebreaker:** `(QtyOnHand - QtyCommitSales) DESC` (highest available qty)

### 10.3 Lot Status Validation

**Include:**
- 'P' (Pick/Pass)
- 'C' (Cycle Count)
- '' (Empty string)
- NULL

**Exclude:**
- 'B' (Blocked), 'D' (Damaged), 'E' (Expired)
- 'F' (Failed QC), 'H' (Hold), 'L' (Locked)
- 'T' (In Transit), 'W' (Withdrawn)

### 10.4 Weight Tolerance

**Formula:** `TargetQty ± INMAST.User9`

**Example:**
- Target: 20.00 KG
- User9: 0.025 KG (absolute, NOT percentage)
- Range: 19.975 - 20.025 KG

**Validation:**
- Green: Weight within range AND stable
- Yellow: Within range but unstable
- Red: Outside range
- "Add Lot" enabled ONLY when Green

### 10.5 Inventory Commitment

**During Picking:**
```sql
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @AllocLotQty
WHERE LotNo = @lotNo AND ItemKey = @itemKey
  AND LocationKey = @locationKey AND BinNo = @binNo;
```

**During Unpick:**
```sql
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales - @AllocLotQty
WHERE LotNo = @lotNo AND ItemKey = @itemKey
  AND LocationKey = @locationKey AND BinNo = @binNo;
```

**Available Quantity:** `QtyOnHand - QtyCommitSales > 0`

### 10.6 Audit Trail Preservation

**On Unpick:**
- ✅ Reset `PickedPartialQty` = 0
- ⚠️ Preserve `ItemBatchStatus`, `PickingDate`, `ModifiedBy`
- ✅ Delete `Cust_PartialLotPicked` record
- ✅ Delete `LotTransaction` record
- ✅ Restore `LotMaster.QtyCommitSales`

**Purpose:** Track who picked, when, and if later unpicked (forensic audit)

---

## 11. Non-Functional Requirements

### 11.1 Performance

- **Weight Update Latency:** <500ms (p95) from scale to UI
- **API Response Time:** <200ms (p95) for picking operations
- **Concurrent Users:** Support 4 workstations simultaneously without degradation
- **Database Connection Pool:** 10-20 connections (Rust sqlx)

### 11.2 Reliability

- **System Uptime:** 99.5% (vs 97% current)
- **Label Print Success:** 99.9%
- **PWA Offline Capability:** 95%+ read-only operations while network down
- **Transaction Atomicity:** All 4 phases must complete or rollback

### 11.3 Security

- **Authentication:** Dual SQL/LDAP support (existing tbl_user)
- **Session Management:** Secure session tokens, 8-hour expiry
- **Database Access:** Parameterized queries only (prevent SQL injection)
- **HTTPS:** Enforce in production (TLS 1.2+)

### 11.4 Usability

- **Learning Curve:** <2 hours training for existing desktop app users
- **Error Messages:** Clear, actionable guidance (not technical jargon)
- **Keyboard Navigation:** Full keyboard support (Tab, Enter, Escape)
- **Screen Reader:** ARIA labels for accessibility (Phase 2)

### 11.5 Compatibility

- **Browsers:** Chrome 90+, Edge 90+ (primary), Firefox 88+ (secondary)
- **Operating System:** Windows 10/11 (workstation OS)
- **Printers:** Any Windows-compatible printer (not limited to Zebra)
- **Scales:** Serial port scales via .NET bridge (SMALL/BIG types)

### 11.6 Maintainability

- **Code Documentation:** Inline comments, README, API docs
- **Database Versioning:** Migration scripts (Flyway/Liquibase pattern)
- **Error Logging:** Structured logs (JSON format) to file/Sentry
- **Monitoring:** Health check endpoint `/api/health`

---

## 12. Out of Scope (Phase 2+)

### 12.1 Mobile/Tablet Responsive Layout
- **Reason:** MVP targets desktop workstations only
- **Phase 2:** Supervisor dashboard on tablets

### 12.2 Barcode Scanner Hardware Integration
- **Reason:** Manual text input sufficient for MVP
- **Phase 2:** USB/Bluetooth scanner support with HID events

### 12.3 Multi-Language Support
- **Reason:** English sufficient for initial deployment
- **Phase 2:** Thai, Chinese based on operator demographics

### 12.4 Advanced Analytics Dashboard
- **Reason:** Basic operational data sufficient for MVP
- **Phase 2:** Performance metrics, trend analysis, operator efficiency

### 12.5 Voice-Guided Picking
- **Reason:** Hardware/infrastructure not ready
- **Phase 3:** Voice commands for hands-free operation

### 12.6 Predictive Inventory
- **Reason:** Requires historical data collection first
- **Phase 3:** AI-based lot usage forecasting

---

## 13. Release Plan

### 13.1 MVP Timeline (Weeks 1-8)

**Week 1-2: Foundation**
- Rust backend API setup (Axum, sqlx)
- React PWA scaffolding (TypeScript, Tailwind)
- Database connection & authentication

**Week 3-4: Core Picking Workflow**
- Run No search & auto-population (F1)
- FEFO bin selection (F2)
- Save & transaction workflow (F5)

**Week 5-6: Weight Integration**
- Dual-scale WebSocket integration (F3)
- Manual weight entry (F4)
- Weight tolerance validation

**Week 7: Print & Completion**
- Windows native printing (F6)
- Run completion & pallet assignment (F9)

**Week 8: Final Features & Testing**
- View Lots modal (F7)
- Unpick/delete (F8)
- Search modals (F10)
- UAT with operators

### 13.2 Launch Strategy

**Pre-Launch (Week 9):**
- Operator training (2 hours per shift)
- Parallel run with old desktop app (safety net)
- Monitoring dashboard setup

**Launch (Week 10):**
- Deploy to WS1 (pilot)
- Day 1-3: Monitor closely, gather feedback
- Day 4-5: Deploy to WS2, WS3
- Day 6-7: Deploy to WS4

**Post-Launch (Weeks 11-12):**
- Daily performance monitoring
- Bug fixes (high priority)
- Operator satisfaction survey
- Decommission old desktop app

### 13.3 Success Criteria for Launch

- ✅ All 4 workstations operational
- ✅ Zero critical bugs
- ✅ Weight accuracy >99%
- ✅ Label print success >99.5%
- ✅ Operator satisfaction >4.0/5.0
- ✅ Batch completion time <25 min (target 24 min)

---

## 14. Appendix

### 14.1 Real Production Examples

**Run 6000037 (Auto-Population Example):**
- FG Item Key: TSM2285A (Marinade, Savory)
- Batches: 2 (850417, 850416)
- Production Date: 06/10/25 (today's date)
- ItemKey INRICF05: Weight Range 14.215-14.265 KG

**Run 213972 (Picking Workflow):**
- Item INSALT02: Picked 20.00 KG, Lot 2510403-1, Bin PWBB-12
- QtyCommitSales: 3,695.803 → 3,715.803 (+20 KG) ✅
- Unpick test: QtyCommitSales restored 3,715.803 → 3,675.803 (-20 KG) ✅

**Run 213989 (Batch Summary Labels):**
- 4 batches (845983-845986)
- 4 labels printed (Page 1 of 4, Page 2 of 4, etc.)
- Status: PRINT, PalletID assigned

### 14.2 Database Connection String

```
Server=192.168.0.86,49381;Database=TFCPILOT3;User Id=NSW;Password=B3sp0k3;TrustServerCertificate=True;
```

### 14.3 Key Tolerances

**All items use INMAST.User9 = 0.025 KG absolute tolerance:**

| ItemKey | Description | User9 | Example Target | Weight Range |
|---------|-------------|-------|----------------|--------------|
| INSALT02 | Salt Medium | 0.025 | 20.00 KG | 19.975-20.025 |
| INSAPP01 | SAPP 28 | 0.025 | 7.00 KG | 6.975-7.025 |
| INBC1404 | Batter Starch | 0.025 | 12.2 KG | 12.175-12.225 |
| INCORS01 | Corn Starch | 0.025 | 14.5 KG | 14.475-14.525 |

### 14.4 Table Name Casing (CRITICAL)

```sql
-- ✅ CORRECT
SELECT * FROM cust_PartialPicked      -- lowercase 'c'
SELECT * FROM Cust_PartialRun         -- uppercase 'C'
SELECT * FROM Cust_PartialLotPicked   -- uppercase 'C'

-- ❌ WRONG (will fail)
SELECT * FROM Cust_PartialPicked      -- Wrong casing!
```

### 14.5 Label Barcode Format

**Individual Item Label:**
- Pattern: `*{ItemKey}--{PickedQty}*`
- Examples:
  - `*INSAPP01--7.01*`
  - `*INSALT02--20.00*`
  - `*INCORS01--14.50*`
- Type: Code 128 (alphanumeric + special chars)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-06 | [PM Agent] | Initial PRD based on database-schema.md v2.5, project-brief.md v1.0, PickingFlow.md v1.7 |

---

## Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Technical Lead | | | |
| QA Lead | | | |
| Operations Manager | | | |

---

**End of Document**
