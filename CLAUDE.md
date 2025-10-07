# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Partial Picking System PWA** - Production-ready warehouse picking application with real-time weight scale integration, dual authentication (LDAP + SQL), FEFO lot selection, and offline PWA capabilities.

**Tech Stack**:
- Frontend: React 19 + TypeScript + Tailwind4 CSS + Vite
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

## Common Workflows

**Add API Endpoint**: Contract → Failing test → Implement → Test passes → Frontend client
**Add React Component**: Check reference UI → ShadCN search → Create → Test → Integrate
**Debug SQL**: MCP query → Check data-model.md → Verify composite keys → Test production runs
**Fix E2E Test**: Reproduce → chrome-devtools debug → Verify against OpenAPI → Fix

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

## Documentation

**Specs**: `specs/001-i-have-an/{research.md, plan.md, tasks.md}` | **Constitution**: `.specify/memory/constitution.md` | **Agents**: `agents.md`
