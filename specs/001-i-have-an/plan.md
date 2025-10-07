# Implementation Plan: Production-Ready Partial Picking System PWA

**Branch**: `001-i-have-an` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/deachawat/dev/projects/BPP/Partial-Picking/specs/001-i-have-an/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✅
   → Detect Project Type: web (frontend+backend)
   → Set Structure Decision: Web application
3. Fill the Constitution Check section ✅
4. Evaluate Constitution Check section ✅
   → No violations detected
   → Update Progress Tracking: Initial Constitution Check ✅
5. Execute Phase 0 → research.md ✅
   → All NEEDS CLARIFICATION resolved
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✅
7. Re-evaluate Constitution Check section ✅
   → Update Progress Tracking: Post-Design Constitution Check ✅
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md) ✅
9. STOP - Ready for /tasks command ✅
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**Primary Requirement**: Build production-ready Partial Picking System PWA with dual authentication (LDAP/SQL), real-time weight scale integration, FEFO compliance, and offline capability.

**Technical Approach** (from research.md):
- **Frontend**: React 19 + TypeScript + Tailwind CSS with Vite build system
- **Backend**: Rust with Axum framework + tiberius for SQL Server
- **Real-Time**: **Reuse existing** WebSocket bridge service from `Weight-scale/bridge-service/` (no implementation needed)
- **Authentication**: Dual LDAP/SQL with JWT tokens (168-hour expiration)
- **PWA**: Workbox service worker with offline caching for last 5 runs
- **Database**: Direct SQL queries to TFCPILOT3 (no ORM)

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.3 + React 19
- Backend: Rust 1.75 + Axum 0.7
- Bridge: C# .NET 8

**Primary Dependencies**:
- Frontend: react@19, tailwindcss@3, @radix-ui/react-*, vite@5, vite-plugin-pwa
- Backend: axum@0.7, tiberius@0.12, bb8-tiberius, jsonwebtoken, bcrypt, ldap3, tokio
- Bridge: **Existing service** at `Weight-scale/bridge-service/` (System.IO.Ports, System.Net.WebSockets already implemented)

**Storage**: SQL Server 2019+ (TFCPILOT3 database at 192.168.0.86:49381)

**Testing**:
- Frontend: Vitest + React Testing Library + Playwright (E2E)
- Backend: cargo test + integration tests against test database
- Bridge: **No new tests needed** (existing service already tested and working)

**Target Platform**:
- Desktop browsers (Chrome/Edge) on Windows 10+ warehouse tablets
- Resolution: 1280×1024 (5:4 aspect ratio, 17" monitors)
- Touch-enabled UI with 44×44px minimum touch targets

**Project Type**: web (frontend + backend, using existing bridge service from `Weight-scale/`)

**Performance Goals**:
- Weight update latency: <200ms (WebSocket)
- API response time: <100ms p95
- Bundle size: <500KB (gzipped frontend)
- Offline support: Last 5 runs cached
- Concurrent users: 4 workstations (WS1-WS4)

**Constraints**:
- Must work offline with cached data
- FEFO compliance non-negotiable (constitutional requirement)
- 4-phase atomic transactions required
- No ORM (direct SQL for complex composite keys)
- **Prerequisite**: Existing bridge service at `Weight-scale/bridge-service/` must be running (handles COM port hardware access)

**Scale/Scope**:
- 2 main screens: Login + Partial Picking
- 6 modal dialogs (Run, Batch, Item, Lot, Bin, View Lots)
- ~30 API endpoints
- 4 workstations × 2 scales = 8 concurrent WebSocket connections
- Database: ~15 tables, composite primary keys

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Database Schema Fidelity
- [x] Using verified production schema v2.5 from database-schema.md
- [x] Composite primary keys correctly identified (RunNo, RowNum, LineId)
- [x] Field naming verified: `PickedPartialQty` (NOT PickedPartialQtyKG)
- [x] QtyCommitSales updates during picking (Phase 4 of transaction)
- [x] BIN filtering: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'
- [x] No schema assumptions - all verified against real production data

### ✅ II. FEFO Compliance
- [x] Server-side FEFO algorithm in Rust backend
- [x] Lot selection sorts by DateExpiry ASC, then Location ASC
- [x] Operators cannot override FEFO-selected bins
- [x] System presents only next FEFO-compliant bin via API
- [x] Manual bin selection removed from production version
- [x] FEFO logic tested against real production runs (213972, 213989, 6000037)

### ✅ III. 4-Phase Transaction Atomicity
- [x] All picking operations follow 4-phase pattern:
  1. Lot allocation (Cust_PartialLotPicked record creation)
  2. Weight update (cust_PartialPicked.PickedPartialQty)
  3. Transaction recording (LotTransaction with TransactionType=5)
  4. Inventory commitment (LotMaster.QtyCommitSales increment)
- [x] Phases execute atomically with proper rollback on failure
- [x] Each phase individually verifiable in audit trail

### ✅ IV. Real-Time Weight Integration
- [x] Dual scale support via TFC_workstation2 configuration (SmallScaleId, BigScaleId)
- [x] WebSocket bridge (.NET 8) for Windows hardware integration
- [x] Weight tolerance validation: INMAST.User9 (absolute KG values)
- [x] Scale readings update UI within 200ms (React 19 concurrent rendering)
- [x] Offline mode disables weight-dependent operations

### ✅ V. Audit Trail Preservation
- [x] Unpick/delete operations preserve original transaction records
- [x] Modification fields tracked: ModifiedBy, ModifiedDate, ModifiedTime
- [x] LotTransaction log is append-only (never delete)
- [x] Audit queries performant (indexed on timestamp fields)

### ✅ VI. Production-Ready Quality Standards
- [x] TypeScript strict mode enabled
- [x] Structured error handling with error codes and user-facing messages
- [x] Loading states for all async operations
- [x] Responsive design for 10-12" warehouse tablets (1280×1024)
- [x] Offline PWA capability with service worker
- [x] Print operations compatible with Windows native printers (4×4" labels)

### ✅ VII. Maintain Working User Experience
- [x] Preserved workflow: Run Selection → Batch → Item → Lot/Bin → Weight → Save
- [x] Visual feedback: Color coding (green=in-tolerance, red=out-of-tolerance)
- [x] Workstation selection persists across sessions (localStorage)
- [x] Label printing on every successful pick (individual + batch summary)
- [x] No unnecessary navigation steps added

### ✅ VIII. Environment Configuration
- [x] All environment-specific values in .env file
- [x] No hard-coded ports, database connections, or service URLs
- [x] Configuration values read from environment variables
- [x] .env is single source of truth for all deployments

**Constitution Check Result**: ✅ PASS - No violations detected

## Project Structure

### Documentation (this feature)
```
specs/001-i-have-an/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✅
├── data-model.md        # Phase 1 output (/plan command) ⏳
├── quickstart.md        # Phase 1 output (/plan command) ⏳
├── contracts/           # Phase 1 output (/plan command) ⏳
│   ├── openapi.yaml     # OpenAPI 3.0 specification
│   └── websocket.md     # WebSocket protocol specification
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Web application structure (frontend + backend + bridge)

backend/
├── src/
│   ├── main.rs                    # Axum server entry point
│   ├── config.rs                  # Environment configuration
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs          # Connection pool setup
│   │   └── migrations.rs          # Schema verification scripts
│   ├── models/
│   │   ├── mod.rs
│   │   ├── user.rs                # User, AuthRequest, AuthResponse
│   │   ├── run.rs                 # ProductionRun, Batch, RunDetails
│   │   ├── pick.rs                # PickItem, PickRequest, PickResponse
│   │   ├── lot.rs                 # Lot, FefoLot, LotAllocation
│   │   └── bin.rs                 # Bin, BinInventory
│   ├── services/
│   │   ├── mod.rs
│   │   ├── auth_service.rs        # LDAP/SQL authentication
│   │   ├── run_service.rs         # Run/batch queries
│   │   ├── picking_service.rs     # 4-phase picking transactions
│   │   ├── lot_service.rs         # FEFO algorithm, lot queries
│   │   └── pallet_service.rs      # Run completion, pallet assignment
│   ├── api/
│   │   ├── mod.rs
│   │   ├── auth.rs                # POST /api/auth/login
│   │   ├── runs.rs                # GET/POST /api/runs/*
│   │   ├── picks.rs               # GET/POST/PATCH /api/picks/*
│   │   ├── lots.rs                # GET /api/lots/*
│   │   └── middleware/
│   │       ├── auth.rs            # JWT validation middleware
│   │       └── logging.rs         # Request logging
│   └── utils/
│       ├── mod.rs
│       ├── errors.rs              # AppError, ErrorResponse
│       └── jwt.rs                 # JWT token generation/validation
├── tests/
│   ├── integration/
│   │   ├── auth_tests.rs
│   │   ├── picking_tests.rs
│   │   └── fefo_tests.rs
│   └── contract/
│       ├── api_contract_tests.rs  # Test against OpenAPI spec
│       └── test_data.sql          # Test database fixtures
├── Cargo.toml
├── Cargo.lock
└── .env.example

frontend/
├── src/
│   ├── main.tsx                   # React app entry + SW registration
│   ├── App.tsx                    # Root component with routing
│   ├── vite-env.d.ts              # Vite type definitions
│   ├── components/
│   │   ├── ui/                    # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── progress.tsx
│   │   │   └── ...
│   │   ├── picking/               # Domain-specific components
│   │   │   ├── WeightProgressBar.tsx
│   │   │   ├── NumericKeyboard.tsx
│   │   │   ├── BatchItemGrid.tsx
│   │   │   └── ...
│   │   └── shared/                # Cross-domain components
│   │       ├── ConnectionStatus.tsx
│   │       ├── SearchModal.tsx
│   │       └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── PartialPickingPage.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── PickingContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWeightScale.ts
│   │   └── usePicking.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts          # API client with error handling
│   │   │   ├── auth.ts
│   │   │   ├── runs.ts
│   │   │   ├── picks.ts
│   │   │   └── lots.ts
│   │   └── websocket.ts           # WeightScaleWebSocket class
│   ├── utils/
│   │   ├── fefo.ts                # Client-side FEFO validation
│   │   └── format.ts              # Date/number formatters
│   └── lib/
│       └── utils.ts               # cn() utility for Tailwind
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   └── assets/
│       └── images/
│           └── NWFLogo-256w.webp
├── tests/
│   ├── unit/
│   │   ├── fefo.test.ts
│   │   └── format.test.ts
│   ├── integration/
│   │   └── api-client.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       └── picking-flow.spec.ts
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vitest.config.ts
└── .env.example

shared/
├── .env                           # Environment configuration (gitignored)
├── .env.example                   # Example environment file
└── docker-compose.yml             # Optional: for development setup
```

**Structure Decision**: Web application with two new projects (reusing existing bridge service):
1. **backend/** - Rust Axum API server (port 7075)
2. **frontend/** - React 19 PWA (port 6060, built with Vite)
3. **Weight-scale/bridge-service/** - **Existing** .NET 8 WebSocket service (port 5000, no changes needed)

**Important**: The React PWA connects to the existing bridge service at `ws://localhost:5000/ws/scale/{small|big}`. The bridge service code is located at `Weight-scale/bridge-service/` and requires no modifications - it's framework-agnostic and works with any WebSocket client (Angular, React, vanilla JS, etc.).

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE

**Output**: [research.md](./research.md)

All technical unknowns resolved:
1. React 19 Concurrent Rendering for real-time weight updates
2. Rust Axum + Tiberius for SQL Server integration
3. Dual LDAP/SQL authentication with fallback
4. WebSocket protocol for real-time weight scale data
5. Tailwind CSS + shadcn/ui component library
6. Service Worker for offline PWA capability
7. FEFO algorithm implementation
8. Structured error handling strategy

## Phase 1: Design & Contracts

*Prerequisites: research.md complete ✅*

### 1.1 Extract Entities from Feature Spec → `data-model.md`

**Entity Extraction Strategy**:
- Parse "Key Entities" section from spec.md
- Map to database tables from database-schema.md
- Add validation rules from functional requirements
- Document state transitions (e.g., Run status: NEW → PRINT)

**Entities to Document**:
1. **User** (tbl_user) - Authentication, permissions
2. **ProductionRun** (Cust_PartialRun) - Run/batch master records
3. **PickItem** (cust_PartialPicked) - Items to pick with weights
4. **Lot** (LotMaster, LotTransaction) - Inventory lots with FEFO
5. **Bin** (BinMaster) - Physical warehouse locations
6. **WeightScale** (TFC_Weightscale2) - Hardware configuration
7. **Workstation** (TFC_workstation2) - WS1-WS4 scale assignments
8. **Pallet** (Cust_PartialPalletLotPicked) - Completed batch pallets
9. **Transaction** (LotTransaction, Cust_PartialLotPicked) - Audit trail

**Output Format**:
```markdown
# Entity: User
**Purpose**: Warehouse operator authentication and authorization
**Source Tables**: tbl_user
**Primary Key**: userid (int)

## Fields
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| userid | int | Yes | Auto-increment | Unique identifier |
| uname | string | Yes | 2-50 chars | Username for login |
| pword | string | Conditional | bcrypt hash | SQL auth only |
| ldap_username | string | Conditional | LDAP format | AD auth only |
| ... | ... | ... | ... | ... |

## State Transitions
N/A (stateless entity)

## Relationships
- One user can have many picking transactions (ModifiedBy)
- One user can authenticate via LDAP OR SQL (mutually exclusive)
```

### 1.2 Generate API Contracts from Functional Requirements

**Contract Generation Strategy**:
- Parse functional requirements (FR-001 to FR-073)
- Group by domain: Auth, Runs, Picks, Lots, Inventory
- Generate OpenAPI 3.0 specification
- Document WebSocket protocol separately

**API Endpoints to Define**:

**Authentication** (FR-001 to FR-008):
- `POST /api/auth/login` - Dual LDAP/SQL authentication
- `POST /api/auth/refresh` - JWT token refresh
- `POST /api/auth/logout` - Invalidate token

**Runs & Batches** (FR-009 to FR-016):
- `GET /api/runs` - Search runs by RunNo, status
- `GET /api/runs/:runNo` - Get run details with auto-population data
- `GET /api/runs/:runNo/batches` - Get batches for run
- `GET /api/runs/:runNo/batches/:batchNo/items` - Get items for batch

**Picking Operations** (FR-031 to FR-038, FR-051 to FR-056):
- `POST /api/picks` - Execute 4-phase picking transaction
- `DELETE /api/picks/:runNo/:rowNum/:lineId` - Unpick/delete item
- `GET /api/picks/pending` - Get pending picks
- `GET /api/picks/completed` - Get completed picks

**Lot & Inventory** (FR-017 to FR-023):
- `GET /api/lots/:itemKey/fefo` - Get FEFO-compliant lot for item
- `GET /api/lots/:lotNo/bins` - Get bins for lot
- `GET /api/inventory/bins/:binNo` - Get bin inventory

**Run Completion** (FR-046 to FR-050):
- `POST /api/runs/:runNo/complete` - Complete run, assign pallet

**WebSocket**:
- `ws://localhost:5000/ws/scale/:scaleId` - Real-time weight data stream

**Output**: `contracts/openapi.yaml`, `contracts/websocket.md`

### 1.3 Generate Contract Tests from Contracts

**Test Generation Strategy**:
- One test file per API domain
- Assert request/response schemas match OpenAPI spec
- Tests must fail (no implementation yet)

**Contract Test Example** (backend/tests/contract/auth_contract_tests.rs):
```rust
#[tokio::test]
async fn test_login_endpoint_schema() {
    // Arrange: Load OpenAPI spec
    let spec = load_openapi_spec("../../contracts/openapi.yaml");
    let login_schema = spec.paths["/api/auth/login"].post.requestBody;

    // Act: Create test request
    let request = json!({
        "username": "testuser",
        "password": "testpass"
    });

    // Assert: Request matches schema (this will fail - no implementation yet)
    assert_matches_schema(&request, &login_schema);
}
```

### 1.4 Extract Test Scenarios from User Stories

**Quickstart Test Extraction**:
- Parse "Acceptance Scenarios" from spec.md (10 scenarios)
- Convert to integration test steps
- Document in quickstart.md as validation checklist

**Quickstart.md Format**:
```markdown
# Quickstart Guide: Partial Picking System PWA

## Prerequisites
- Rust 1.75+ installed
- Node.js 20+ installed
- .NET 8 SDK installed
- Access to TFCPILOT3 database (192.168.0.86:49381)
- LDAP server reachable (192.168.0.1)

## Setup Instructions
1. Clone repository
2. Copy .env.example to .env
3. Update database credentials
4. Install dependencies
5. Run all services

## Validation Tests
### ✅ Scenario 1: LDAP Authentication
**Given**: Valid AD credentials
**When**: User logs in
**Then**: JWT token issued, redirect to picking page
**Test Command**: `npm run test:e2e -- login.spec.ts`

### ✅ Scenario 2: SQL Fallback Authentication
**Given**: LDAP unreachable, valid SQL credentials
**When**: User logs in
**Then**: JWT token issued via SQL auth
**Test Command**: `cargo test auth_sql_fallback`
...
```

### 1.5 Update Agent Context File (CLAUDE.md)

**Agent Context Update Strategy**:
- Run `.specify/scripts/bash/update-agent-context.sh claude`
- Add only NEW tech from current plan
- Preserve manual additions between markers
- Update recent changes (keep last 3)
- Keep under 150 lines for token efficiency

**Output**: `/home/deachawat/dev/projects/BPP/Partial-Picking/CLAUDE.md`

**Phase 1 Output**: ✅ COMPLETE (2025-10-06)
- ✅ data-model.md (9 entities documented with 110 validations)
- ✅ contracts/openapi.yaml (OpenAPI 3.0 spec with 30 endpoints)
- ✅ contracts/websocket.md (WebSocket protocol specification)
- ✅ Failing contract tests (42 backend + 18 frontend tests)
- ✅ quickstart.md (10 validation scenarios with SQL verification)
- ✅ CLAUDE.md (updated agent context with constitutional principles)

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base template
2. Generate tasks from Phase 1 design documents (contracts, data model, quickstart)
3. Apply ordering rules: Tests before implementation, models before services
4. Mark [P] for parallel execution (independent files)

**Task Categories**:

**Foundation Tasks** (1-4):
1. [P] Setup backend project structure (Cargo.toml, src/main.rs, .env.example)
2. [P] Setup frontend project structure (package.json, vite.config.ts, tailwind.config.js)
3. Database connection verification (backend/src/db/connection.rs)
4. Environment configuration loading (backend/src/config.rs, frontend/.env)
5. **REMOVED**: Bridge project setup (using existing `Weight-scale/bridge-service/`)

**Contract Test Tasks** (5-9):
5. [P] Auth API contract tests (backend/tests/contract/auth_contract_tests.rs)
6. [P] Runs API contract tests (backend/tests/contract/runs_contract_tests.rs)
7. [P] Picks API contract tests (backend/tests/contract/picks_contract_tests.rs)
8. [P] Lots API contract tests (backend/tests/contract/lots_contract_tests.rs)
9. [P] Frontend API client contract tests (frontend/tests/integration/api-client.test.ts)
10. **REMOVED**: WebSocket protocol contract tests (bridge already tested and working)

**Model Tasks** (10-18):
10. [P] User model (backend/src/models/user.rs)
11. [P] Run model (backend/src/models/run.rs)
12. [P] Pick model (backend/src/models/pick.rs)
13. [P] Lot model (backend/src/models/lot.rs)
14. [P] Bin model (backend/src/models/bin.rs)
15. [P] Frontend type definitions (frontend/src/types/*)
16. FEFO algorithm unit tests (backend/tests/unit/fefo_tests.rs)
17. Weight tolerance validation tests (backend/tests/unit/validation_tests.rs)
18. 4-phase transaction tests (backend/tests/integration/picking_tests.rs)

**Service/API Tasks** (19-33):
19. Auth service LDAP integration (backend/src/services/auth_service.rs)
20. Auth service SQL fallback (backend/src/services/auth_service.rs)
21. JWT middleware (backend/src/api/middleware/auth.rs)
22. Auth API endpoints (backend/src/api/auth.rs)
23. Run service queries (backend/src/services/run_service.rs)
24. Run API endpoints (backend/src/api/runs.rs)
25. FEFO lot service (backend/src/services/lot_service.rs)
26. Lot API endpoints (backend/src/api/lots.rs)
27. 4-phase picking transaction service (backend/src/services/picking_service.rs)
28. Picking API endpoints (backend/src/api/picks.rs)
29. Unpick/delete service (backend/src/services/picking_service.rs)
30. Run completion service (backend/src/services/pallet_service.rs)
31. Error handling utilities (backend/src/utils/errors.rs)
32. Logging middleware (backend/src/api/middleware/logging.rs)
33. API client with error handling (frontend/src/services/api/client.ts)

**Frontend Component Tasks** (34-48):
34. [P] shadcn/ui base components setup (frontend/src/components/ui/*)
35. [P] Tailwind theme configuration (frontend/tailwind.config.js)
36. Auth context provider (frontend/src/contexts/AuthContext.tsx)
37. Picking context provider (frontend/src/contexts/PickingContext.tsx)
38. useWeightScale hook - connects to existing bridge at ws://localhost:5000/ws/scale/{small|big} (frontend/src/hooks/useWeightScale.ts)
39. WeightScaleWebSocket service (frontend/src/services/websocket.ts)
40. Login page UI (frontend/src/pages/LoginPage.tsx)
41. WeightProgressBar component (frontend/src/components/picking/WeightProgressBar.tsx)
42. NumericKeyboard component (frontend/src/components/picking/NumericKeyboard.tsx)
43. SearchModal component (frontend/src/components/shared/SearchModal.tsx)
44. BatchItemGrid component (frontend/src/components/picking/BatchItemGrid.tsx)
45. Partial Picking main screen (frontend/src/pages/PartialPickingPage.tsx)
46. Connection status indicator (frontend/src/components/shared/ConnectionStatus.tsx)
47. Error boundary wrapper (frontend/src/components/shared/ErrorBoundary.tsx)
48. Client-side FEFO validation (frontend/src/utils/fefo.ts)

**Bridge Service Tasks**: **REMOVED** (49-53)
- **All bridge service tasks removed** - using existing `Weight-scale/bridge-service/`
- React frontend will connect to WebSocket endpoints: `/ws/scale/small` and `/ws/scale/big`
- No implementation, testing, or deployment work needed for bridge service

**PWA & Offline Tasks** (49-53):
49. Service worker configuration (frontend/vite.config.ts - VitePWA plugin)
50. PWA manifest (frontend/public/manifest.json)
51. Offline caching strategy (frontend/src/main.tsx - SW registration)
52. Network-first API caching (Workbox configuration)
53. Offline mode detection (frontend/src/hooks/useOnlineStatus.ts)

**E2E Integration Tasks** (54-58):
54. Login flow E2E test (frontend/tests/e2e/login.spec.ts)
55. Complete picking flow E2E test (frontend/tests/e2e/picking-flow.spec.ts)
56. FEFO compliance E2E test (frontend/tests/e2e/fefo-compliance.spec.ts)
57. Offline mode E2E test (frontend/tests/e2e/offline-mode.spec.ts)
58. Multi-scale switching E2E test (frontend/tests/e2e/scale-switching.spec.ts)
59. **NEW**: Document bridge service startup in README (prerequisite for development)

**Ordering Strategy**:
- **Parallel Execution** [P]: Tasks 1-2 (project setup), 5-9 (contract tests), 10-15 (models)
- **Sequential**: Services depend on models, APIs depend on services, UI depends on APIs
- **Test-First**: Contract tests (5-9) before services (19-33), E2E tests (54-58) last
- **Prerequisite**: Bridge service must be running from `Weight-scale/bridge-service/` before frontend development

**Estimated Output**: ~60 numbered, ordered tasks in tasks.md (reduced from 65 due to removed bridge tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. Table not populated.

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command) ⏳ READY
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none required) ✅

**Phase 1 Completion Summary** (2025-10-06):
- ✅ data-model.md: 9 entities, 110 validations, complete field documentation
- ✅ contracts/openapi.yaml: 30 REST endpoints with schemas
- ✅ contracts/websocket.md: Real-time weight protocol specification
- ✅ Contract tests generated: 42 backend + 18 frontend (all failing as expected)
- ✅ quickstart.md: 10 validation scenarios with SQL verification
- ✅ CLAUDE.md: Agent context file with constitutional principles

---

*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
