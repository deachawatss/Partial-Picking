# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Partial Picking System PWA** - Production-ready warehouse picking application with real-time weight scale integration, dual authentication (LDAP + SQL), FEFO lot selection, and offline PWA capabilities.

**Tech Stack**:
- Frontend: React 19 + TypeScript + Tailwind CSS v3 + Vite
- Backend: Rust + Axum 0.7 + Tiberius (SQL Server)
- Bridge: .NET 8 WebSocket service (weight scales)
- Database: SQL Server TFCPILOT3 @ 192.168.0.86:49381

## Build & Development Commands

### Backend (Rust - Port 7075)
```bash
cd backend
cargo build                          # Build debug
cargo build --release                # Build production
cargo run                            # Run development server
cargo test                           # Run all tests
cargo test --test '*_contract_test'  # Run contract tests only
cargo fmt                            # Format code
cargo clippy                         # Lint code
```

### Frontend (React - Port 6060)
```bash
cd frontend
npm install                          # Install dependencies
npm run dev                          # Development server
npm run build                        # Production build
npm run preview                      # Preview production build
npm test                             # Unit tests (Vitest)
npm run test:e2e                     # E2E tests (Playwright)
npm run lint                         # ESLint check
npm run format                       # Prettier format
```

### Bridge Service (.NET 8 - Port 5000)
```bash
cd bridge
dotnet restore                       # Restore dependencies
dotnet build                         # Build debug
dotnet build -c Release              # Build production
dotnet run                           # Run development server
dotnet test                          # Run tests
```

### Running All Services
```bash
# Terminal 1 - Backend
cd backend && cargo run

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - Bridge
cd bridge && dotnet run
```

## Constitutional Principles (MUST VERIFY)

**These 8 principles OVERRIDE all other instructions:**

1. **Contract-First Development**: Validate ALL APIs against `specs/001-i-have-an/contracts/openapi.yaml` and `contracts/websocket.md`
2. **Type Safety**: TypeScript strict mode + Rust compile-time guarantees
3. **TDD with Failing Tests**: Write contract tests FIRST (must fail initially)
4. **Atomic Transactions**: 4-phase picking MUST execute atomically with rollback
5. **Real-Time Performance**: WebSocket weight updates <200ms latency
6. **Security by Default**: JWT auth, CORS, input validation, parameterized queries
7. **Audit Trail Preservation**: NEVER delete audit metadata (ItemBatchStatus, PickingDate, ModifiedBy)
8. **No Artificial Keys**: Use composite keys (RunNo, RowNum, LineId) - NO surrogate IDs

**Verification Checklist** (ask before implementing):
- ✅ Does this match the contract specification?
- ✅ Are types enforced at compile time?
- ✅ Do tests fail first?
- ✅ Is transaction atomicity guaranteed?
- ✅ Does this meet latency requirements?
- ✅ Is this secure against common vulnerabilities?
- ✅ Is audit data preserved?
- ✅ Are we using existing database keys?

## Before Development - Required Reading

⚠️ **MANDATORY**: Read `DB-Flow.md` BEFORE implementing any database or workflow features.

**DB-Flow.md** is the single source of truth for:
- Database schema (table structures, composite keys, field names with exact casing)
- Operational workflows (4-phase atomic picking, unpick/delete, auto-population)
- FEFO lot selection algorithm (ORDER BY DateExpiry ASC, Location ASC)
- Weight tolerance validation (INMAST.User9 absolute tolerance)
- Label printing workflows (Individual + Summary labels with ZPL)
- Production-tested SQL queries (Run selection, batch items, lot selection, bins)
- Common pitfalls (table casing, wrong field names, missing composite key components)

**Why DB-Flow.md exists**:
- Consolidates 3,795 lines of documentation (database-schema.md + PickingFlow.md) into focused 600-line guide
- Includes real production examples (Run 213972, INSALT02 picking, QtyCommitSales workflow)
- Documents exact field names (casing matters: `cust_PartialPicked` not `Cust_PartialPicked`)
- Shows complete 4-phase atomic transaction SQL with rollback
- Explains audit trail preservation (ItemBatchStatus, PickingDate, ModifiedBy NEVER deleted)

**When to reference DB-Flow.md**:
- ✅ Before writing ANY SQL query
- ✅ Before implementing picking/unpick workflows
- ✅ Before creating database models or DTOs
- ✅ Before debugging weight field issues
- ✅ Before implementing FEFO lot selection
- ✅ Before working with composite keys (RunNo+RowNum+LineId)

## Critical Architecture Patterns

### 4-Phase Atomic Picking Transaction
```rust
// backend/src/services/picking_service.rs
async fn save_pick(request: SavePickRequest) -> Result<PickResponse> {
    let mut tx = pool.begin().await?;

    // Phase 1: Insert Cust_PartialLotPicked (lot allocation)
    sqlx::query!("INSERT INTO Cust_PartialLotPicked ...")
        .execute(&mut tx).await?;

    // Phase 2: Update cust_PartialPicked (weight update)
    sqlx::query!("UPDATE cust_PartialPicked SET PickedPartialQty = ...")
        .execute(&mut tx).await?;

    // Phase 3: Insert LotTransaction (transaction recording)
    let lot_tran_no = get_next_sequence("PT").await?;
    sqlx::query!("INSERT INTO LotTransaction ...")
        .execute(&mut tx).await?;

    // Phase 4: Update LotMaster (inventory commitment)
    sqlx::query!("UPDATE LotMaster SET QtyCommitSales += ...")
        .execute(&mut tx).await?;

    tx.commit().await?; // All or nothing
    Ok(response)
}
```

### FEFO Lot Selection Algorithm
```sql
-- CRITICAL: This exact query MUST be used for FEFO compliance
SELECT TOP 1 LotNo, BinNo, DateExpiry, QtyOnHand, QtyCommitSales,
       (QtyOnHand - QtyCommitSales) AS AvailableQty
FROM LotMaster
WHERE ItemKey = @itemKey
  AND Location = 'TFC1'
  AND (QtyOnHand - QtyCommitSales) >= @targetQty
  AND LotStatus IN ('P', 'C', '', NULL)
ORDER BY DateExpiry ASC, Location ASC
```

### React 19 Concurrent Weight Updates
```typescript
// frontend/src/hooks/useWeightScale.ts
export function useWeightScale(workstationId: string, scaleType: 'small' | 'big') {
  const [weight, setWeight] = useState(0);
  const [stable, setStable] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/ws/scale/${workstationId}/${scaleType}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'weightUpdate') {
        // React 19: Non-blocking concurrent update
        startTransition(() => {
          setWeight(data.weight);
          setStable(data.stable);
        });
      }
    };

    return () => ws.close();
  }, [workstationId, scaleType]);

  return { weight, stable, isPending };
}
```

## Sub-Agent Orchestration Architecture

**Use Sub-Agents for**: Complex, multi-step tasks requiring specialized tools and constitutional compliance.

**Full Agent Prompts**: See `agents.md` for complete prompt templates

### 6-Agent Workflow

```
1. Contract Guardian 🛡️ → Validates against openapi.yaml/websocket.md (GATEKEEPER)
2. Database Specialist 🗄️ → Provides FEFO SQL, composite keys, 4-phase transactions
3. Backend Engineer 🦀 → Implements Rust/Axum endpoints using validated SQL
4. Frontend Builder ⚛️ → React 19 UI + WebSocket + PWA (complete frontend)
5. QA Engineer 🧪 → Contract tests (TDD), E2E tests, performance validation
6. DevOps Manager 🚀 → Deployment, monitoring, docs, CLAUDE.md updates
```

### Quick Agent Selection

| Task | Agent | Key Tool |
|------|-------|----------|
| Validate API contract compliance | **Contract Guardian** | Read + openapi.yaml |
| Write FEFO query with composite keys | **Database Specialist** | SQL Server MCP |
| Implement Rust endpoint | **Backend Engineer** | Context7 + Tiberius |
| Build React component with WebSocket | **Frontend Builder** | ShadCN + chrome-devtools |
| E2E test at 1280x1024 | **QA Engineer** | Playwright + chrome-devtools |
| Deploy to production | **DevOps Manager** | Bash + deployment scripts |

### Orchestration Example

**User Request**: "Implement complete picking workflow with weight validation"

**Agent Sequence**:
1. **Contract Guardian** ✅ Validates POST /api/picks against openapi.yaml
2. **Database Specialist** → Provides 4-phase SQL (INSERT Cust_PartialLotPicked + UPDATE cust_PartialPicked + INSERT LotTransaction + UPDATE LotMaster)
3. **Backend Engineer** → Implements save_pick() using validated SQL in picking_service.rs
4. **Frontend Builder** → Creates PickingPage + WeightProgressBar (React 19 useTransition for <200ms WebSocket)
5. **QA Engineer** → Writes picking-flow.spec.ts E2E test, verifies FEFO compliance
6. **DevOps Manager** → Deploys, updates quickstart.md validation scenario

**Coordination Rules**:
- Contract Guardian approves BEFORE implementation begins
- Database Specialist provides SQL TO Backend Engineer (no SQL rewriting)
- Backend/Frontend can run in parallel AFTER validation
- QA Engineer tests AFTER implementation complete
- DevOps Manager deploys AFTER QA approval

## Tool Usage Quick Reference

**Context7**: `"Axum 0.7 middleware"`, `"React 19 useTransition"`, `"TanStack Query mutations"`
**ShadCN**: `get_project_registries → search_items → view_items → get_item_examples`
**chrome-devtools**: `navigate_page → take_snapshot → click uid="..." → wait_for text="..."`
**SQL Server MCP**: `read_query "SELECT..."`, `describe_table "cust_PartialPicked"`

## Critical Tool Usage Guidelines

### Sequential Thinking MCP (MANDATORY for Complex Tasks)

**ALWAYS use `sequentialthinking` MCP for**:
- Multi-step problem solving (>3 steps)
- Architecture decisions requiring trade-off analysis
- Debugging complex issues with multiple potential causes
- Planning implementations with dependencies
- Analyzing code patterns before modifications
- Any task requiring hypothesis generation and verification

**How to use**:
```typescript
// Use sequential thinking to break down complex problems
sequentialthinking({
  thought: "Analyzing the 4-phase transaction failure...",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
})
```

**Why this matters**:
- Prevents hasty implementations without proper analysis
- Ensures all edge cases are considered
- Creates verifiable solution hypotheses
- Documents decision-making process
- Reduces need for rework

**Examples requiring sequential thinking**:
- "Why is the weight scale WebSocket disconnecting?" → Use sequential thinking to analyze connection lifecycle
- "Should we use Zustand or TanStack Query for state?" → Use sequential thinking to compare trade-offs
- "FEFO query returning wrong lot" → Use sequential thinking to trace through ORDER BY logic

### Context7 Dependency Alignment (MANDATORY Before Implementation)

**ALWAYS query Context7 BEFORE implementing**:
- New React hooks or components
- Rust async patterns or middleware
- Database connection pooling
- WebSocket implementations
- Authentication flows

**Critical: Verify Current Versions**:
```bash
# Check project dependencies FIRST
cat backend/Cargo.toml | grep "axum\|tokio\|tiberius"
cat frontend/package.json | grep "react\|vite\|tailwindcss"

# Then query Context7 with exact versions
Context7: "Axum 0.7 middleware best practices"
Context7: "React 19 useTransition with WebSocket"
Context7: "Tiberius SQL Server connection pooling"
```

**Why this matters**:
- Axum 0.7 has breaking changes from 0.6 (Service trait removal)
- React 19 concurrent rendering differs from React 18
- Tiberius async patterns require specific Tokio runtime setup
- Outdated examples can break production code

**Common Version-Specific Patterns**:

**Axum 0.7** (NOT 0.6):
```rust
// ✅ Correct (Axum 0.7)
use axum::extract::State;
async fn handler(State(pool): State<DbPool>) -> Result<Json<Response>> { }

// ❌ Wrong (Axum 0.6 pattern)
async fn handler(Extension(pool): Extension<DbPool>) -> Result<Json<Response>> { }
```

**React 19** (NOT 18):
```typescript
// ✅ Correct (React 19 concurrent)
import { useTransition } from 'react';
const [isPending, startTransition] = useTransition();
startTransition(() => setWeight(data.weight));

// ❌ Wrong (React 18 pattern)
import { unstable_useTransition } from 'react'; // Removed in React 19
```

**Tiberius + Tokio**:
```rust
// ✅ Correct (Current Tiberius)
use tiberius::{Client, Config};
use tokio_util::compat::TokioAsyncWriteCompatExt;

let config = Config::new();
config.host("192.168.0.86");
let tcp = TcpStream::connect(config.get_addr()).await?;
let client = Client::connect(config, tcp.compat_write()).await?;

// ❌ Wrong (Outdated pattern without compat)
let client = Client::connect(config, tcp).await?; // Won't compile
```

**Verification Checklist**:
- ✅ Checked `Cargo.toml` and `package.json` for exact versions
- ✅ Queried Context7 with version-specific search (e.g., "Axum 0.7", "React 19")
- ✅ Verified pattern matches current dependency versions
- ✅ Tested example compiles/runs with project dependencies
- ✅ No deprecated APIs or removed features used

## Common Workflows

**Add API Endpoint**: Contract → Failing test → Implement → Test passes → Frontend client
**Add React Component**: Check reference UI → ShadCN search → Create → Test → Integrate
**Debug SQL**: MCP query → Check data-model.md → Verify composite keys → Test production runs
**Fix E2E Test**: Reproduce → chrome-devtools debug → Verify against OpenAPI → Fix

## Git Commit Guidelines

**IMPORTANT**: Always write commit messages as a professional engineer, NOT as an AI assistant.

❌ **Wrong** (AI-style):
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

✅ **Correct** (Professional engineer):
```
Improve picking form layout with consistent label alignment

- Align all form labels vertically with 130px fixed width
- Balance LOT NO and BIN NO input widths
- Reduce form-to-table gap for tighter layout
- Redesign selection modals with custom headers
```

**Commit Message Format**:
- Use imperative mood: "Add feature" not "Added feature"
- Keep first line under 72 characters
- Use bullet points for details
- Focus on WHAT and WHY, not HOW

## Key Files

**Specs**: `specs/001-i-have-an/{contracts/openapi.yaml, contracts/websocket.md, data-model.md, quickstart.md}`
**Config**: `.env` (copy from `.env.example`), `backend/Cargo.toml`, `frontend/package.json`, `frontend/vite.config.ts`
**Reference**: `docs/frontend-ref-DontEdit/` (Angular UI - use as pattern, DO NOT MODIFY)

## Environment (.env)

**Database**: `DATABASE_SERVER=192.168.0.86`, `DATABASE_PORT=49381`, `DATABASE_NAME=TFCPILOT3`
**Services**: `BACKEND_PORT=7075`, `FRONTEND_PORT=6060`, `BRIDGE_PORT=5000`
**Auth**: `LDAP_URL=ldap://192.168.0.1`, `JWT_SECRET=change-in-production`, `JWT_DURATION_HOURS=168`

## Common Pitfalls

❌ **Table casing**: `Cust_PartialPicked` → ✅ `cust_PartialPicked` (lowercase c)
❌ **Wrong field**: `picked_partial_qty_kg` (NULL) → ✅ `picked_partial_qty` (actual KG)
❌ **Missing key**: `WHERE RunNo AND LineId` → ✅ `WHERE RunNo AND RowNum AND LineId` (all 3!)
❌ **Audit trail**: Don't set `ItemBatchStatus=NULL` on unpick → ✅ Only update `PickedPartialQty=0`

### ⚠️ CRITICAL: "Picked" vs "Pending" Business Logic

**IMPORTANT**: This system uses a specific definition for "Picked" and "Pending" status that differs from traditional partial picking systems.

**Business Logic Rule:**
```
✅ "Picked" = ANY weight entered within valid range → Item is COMPLETELY DONE
✅ "Pending" = NO weight entered yet (PickedPartialQty = 0) → Item needs picking

❌ WRONG: "Picked" means pickedQty >= targetQty
❌ WRONG: "Pending" means pickedQty < targetQty (includes partially picked items)
```

**Why This Logic:**
- If the user picks ANY valid weight within the weight range, the item is considered complete
- Target weight (`ToPickedPartialQty`) is a guideline, NOT a requirement
- Example: Target = 12.000 KG, User picks 19.990 KG → If within valid range, it's DONE
- The weight tolerance range (from `INMAST.User9`) is the actual validation criteria

**Implementation Locations:**

1. **Frontend Table (PartialPickingPage.tsx line 838):**
```typescript
status: item.pickedQty > 0 ? ('picked' as const) : ('unpicked' as const)
```

2. **Backend Modal "Pending to Picked" Tab (picking_service.rs line 818):**
```sql
WHERE RunNo = @P1 AND PickedPartialQty = 0  -- Only show unpicked items
```

3. **Backend Modal "Picked Lot Details" Tab (picking_service.rs line 707):**
```sql
SELECT ... FROM Cust_PartialLotPicked  -- Shows lot allocation records for all picks
```

**Count Consistency:**
- ✅ Batch Table "Pending (3)" = Modal "Pending to Picked (3)" (both show items with pickedQty = 0)
- ✅ Batch Table "Picked (11)" = Items with ANY weight entered (pickedQty > 0)
- ⚠️ Modal "Picked Lot Details" may show different count (e.g., 10) because it shows LOT RECORDS, not unique items
  - One item can have multiple lot records if picked from multiple lots
  - One item can have pickedQty > 0 but no lot record = data corruption issue

**Common Mistake:**
```sql
❌ WRONG - Shows partially picked items in "Pending":
WHERE PickedPartialQty < ToPickedPartialQty

✅ CORRECT - Only shows completely unpicked items:
WHERE PickedPartialQty = 0
```

### ⚠️ Date Format Standard

**ALL dates MUST use DD/MM/YYYY format** (e.g., "10/10/2025"):

```rust
// ✅ CORRECT - All date formatting
expiry_date.format("%d/%m/%Y").to_string()  // "10/10/2025"

// ❌ WRONG - ISO format
date.format("%Y-%m-%d").to_string()  // "2025-10-10"

// ❌ WRONG - 2-digit year
date.format("%d/%m/%y").to_string()  // "10/10/25"
```

**Examples in codebase:**
- `backend/src/services/run_service.rs:183` - Production dates
- `backend/src/services/lot_service.rs:197` - Expiry dates
- `backend/src/services/bin_service.rs:250` - Bin lot expiry dates

**Why DD/MM/YYYY:**
- Consistent with existing lot and bin expiry dates
- Matches regional standard (Thailand/Bangkok timezone)
- Full 4-digit year prevents Y2K-style ambiguity
- Frontend displays dates as-is from backend (no transformation)

### ⚠️ CRITICAL: Tiberius Transaction Control (Error 266 Fix)

**Problem**: SQL Server Error 266 - "Transaction count after EXECUTE indicates a mismatching number of BEGIN and COMMIT statements"

**Root Cause**: Using `.execute()` or `.query()` + `.into_results()` for transaction control statements causes Error 266 with Tiberius TDS protocol.

**Solution**: Use `simple_query()` for ALL transaction control statements:
```rust
// ✅ CORRECT - Official Tiberius pattern
conn.simple_query("BEGIN TRAN").await?;
// ... execute queries with .execute() ...
conn.simple_query("COMMIT").await?;

// For rollback
let _ = conn.simple_query("ROLLBACK").await;

// ❌ WRONG - Causes Error 266
conn.query("BEGIN TRANSACTION").execute().await?;  // DON'T DO THIS
```

**Additional Requirements for Tiberius**:
1. **IDENTITY Columns**: NEVER insert explicit values into IDENTITY columns (e.g., LotTranNo in Cust_PartialLotPicked and LotTransaction)
2. **Parameter Numbering**: Must be SEQUENTIAL (@P1, @P2, @P3, ...) - NO GAPS (e.g., @P1, @P2, @P4 causes errors)
3. **Type Matching**: Use `u8` for SQL Server `bit` type (not `i8` or string)
4. **DateTime Handling**: Use `try_get().ok().flatten()` for nullable DateTime columns

**Reference**: `backend/src/services/picking_service.rs:302-304` (save_pick function)

### ⚠️ CRITICAL: Tiberius Type Conversion and SOH Calculation

**Problem #1: Tiberius Type Mismatch Returns 0.0**

SQL Server FLOAT(53) columns are **8-byte doubles**. Using `try_get::<f32>` (4-byte float) causes silent type mismatch:
```rust
❌ WRONG - Returns 0.0 for all FLOAT(53) columns:
let qty: f64 = row.try_get::<f32, _>("ToPickedPartialQty")
    .ok().flatten().unwrap_or(0.0) as f64;

✅ CORRECT - Use f64 for SQL Server FLOAT(53):
let qty: f64 = row.try_get::<f64, _>("ToPickedPartialQty")
    .ok().flatten().unwrap_or(0.0);
```

**Symptoms**: All numeric fields display 0.000 in UI despite correct database values.

**Root Cause**: `try_get::<f32>` fails on FLOAT(53) → returns `None` → `unwrap_or(0.0)` → displays 0.0

**Problem #2: INLOC vs LotMaster for SOH**

Use **INLOC** for Stock on Hand (SOH), NOT LotMaster:
```sql
❌ WRONG - Incomplete inventory (only lot-tracked items):
SELECT SUM(QtyOnHand - QtyCommitSales) FROM LotMaster
WHERE ItemKey = @itemKey AND LocationKey = 'TFC1'

✅ CORRECT - Complete aggregated inventory:
SELECT Qtyonhand FROM INLOC
WHERE Itemkey = @itemKey AND Location = 'TFC1'
```

**Example**: INRICF05 shows 22,043 KG in INLOC but only 1,130 KG in LotMaster.

**Why**: INLOC has complete location-level totals; LotMaster only tracks lot-allocated items.

**Reference**: Angular reference app at `docs/frontend-ref-DontEdit/` uses INLOC for SOH.

## Documentation

**Primary Docs**:
- **`DB-Flow.md`** - Database schema + workflows (MANDATORY before DB/workflow development)
- **`API.md`** -API (MANDATORY before API development)
- `specs/001-i-have-an/{research.md, plan.md, tasks.md}` - Project specs and planning
- `.specify/memory/constitution.md` - Constitutional principles