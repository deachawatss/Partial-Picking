# Tasks: Production-Ready Partial Picking System PWA

**Input**: Design documents from `/home/deachawat/dev/projects/BPP/Partial-Picking/specs/001-i-have-an/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Priorities

**User-Specified Priorities**:
1. **FIRST PRIORITY**: Implement frontend UI/UX matching reference implementation at `docs/frontend-ref-DontEdit/`
2. Backend infrastructure and data persistence
3. Authentication and security features
4. Add new features from PRD gradually
5. Each task completable in 1-2 hours max
6. Deploy incremental updates (not big-bang release)

**Implementation Strategy**:
- Start with familiar UI components (LoginPage, PartialPickingPage)
- Build backend API endpoints to support UI
- Add real-time WebSocket weight integration
- Gradually enhance with PWA offline capabilities
- Maintain working deployable state after each phase

## Task Execution Flow

```
1. Phase 3.1: Setup (T001-T010) → Project structure + dependencies
2. Phase 3.2: Contract Tests (T011-T028) → Failing tests FIRST (TDD)
3. Phase 3.3: Frontend UI (T029-T050) → Match reference implementation
4. Phase 3.4: Backend Foundation (T051-T065) → Support frontend APIs
5. Phase 3.5: Authentication (T066-T073) → LDAP + SQL dual auth
6. Phase 3.6: Core Picking (T074-T088) → 4-phase atomic transactions
7. Phase 3.7: Real-Time Features (T089-T095) → WebSocket weight integration
8. Phase 3.8: PWA & Offline (T096-T102) → Service worker, caching
9. Phase 3.9: Polish & Deploy (T103-T110) → Performance, E2E tests, docs
```

## Path Conventions

**Web application structure** (2 new projects + existing bridge):
- `backend/` - Rust Axum API (port 7075)
- `frontend/` - React 19 PWA (port 6060)
- `Weight-scale/bridge-service/` - **Existing** .NET 8 WebSocket service (port 5000) - reused as-is

All paths shown relative to repository root `/home/deachawat/dev/projects/BPP/Partial-Picking/`

---

## Phase 3.1: Setup & Project Initialization

**Goal**: Create project structure, initialize dependencies, configure tooling

- [X] **T001** [P] Initialize backend Rust project structure
  - Create `backend/` directory
  - Initialize `Cargo.toml` with dependencies: axum@0.7, tiberius@0.12, bb8-tiberius, jsonwebtoken, bcrypt, ldap3, tokio, serde, serde_json
  - Create `backend/src/main.rs` with basic Axum server
  - Create `backend/.env.example` from template
  - Create `backend/src/config.rs` for environment variable loading
  - **Deliverable**: `cargo build` succeeds ✅
  - **Time**: 1-1.5 hours

- [X] **T002** [P] Initialize frontend React 19 project structure
  - Create `frontend/` directory
  - Initialize with Vite: `npm create vite@latest frontend -- --template react-ts`
  - Update `package.json` dependencies: react@19, tailwindcss@3, @radix-ui/react-*, @tanstack/react-query@5, zustand
  - Create `frontend/.env.example` from template
  - Create `frontend/vite.config.ts` with PWA plugin configuration
  - Create `frontend/tailwind.config.js` matching reference theme
  - **Deliverable**: `npm run dev` starts development server ✅
  - **Time**: 1-1.5 hours

- [ ] ~~**T003**~~ **REMOVED**: Bridge project setup
  - **Reusing existing** bridge service from `Weight-scale/bridge-service/`
  - The .NET 8 WebSocket service is already implemented and working
  - Frontend will connect to existing endpoints: ws://localhost:5000/ws/scale/{small|big}
  - **Time saved**: 1 hour

- [X] **T004** [P] Configure linting and formatting for both projects
  - Backend: Create `backend/.rustfmt.toml`, `backend/.clippy.toml`
  - Frontend: Create `frontend/.eslintrc.json`, `frontend/.prettierrc`
  - Frontend: Install ESLint + Prettier: `npm install -D eslint prettier eslint-config-prettier`
  - **Deliverable**: `cargo fmt` and `npm run lint` both work ✅
  - **Time**: 25 minutes

- [X] **T005** Database connection verification (backend)
  - Create `backend/src/db/connection.rs` with Tiberius connection pool setup
  - Read connection string from `.env` (DATABASE_SERVER, DATABASE_NAME, etc.)
  - Implement `create_pool()` function returning `bb8::Pool<TiberiusConnectionManager>`
  - Create test query: `SELECT @@VERSION` to verify connection
  - **Dependency**: T001 complete
  - **Deliverable**: Backend can connect to SQL Server TFCPILOT3 ✅
  - **Time**: 1 hour

- [X] **T006** Environment configuration loading (backend + frontend)
  - Backend: Implement `backend/src/config.rs` reading all environment variables
  - Frontend: Create `frontend/src/config.ts` with runtime environment variables
  - **Note**: Bridge service at `Weight-scale/bridge-service/` already has environment config
  - Validate required variables on startup
  - **Dependency**: T001, T002 complete
  - **Deliverable**: All services fail fast if environment variables missing ✅
  - **Time**: 1 hour

- [X] **T007** [P] Create shared TypeScript types from OpenAPI spec (frontend)
  - Create `frontend/src/types/api.ts` with types matching `contracts/openapi.yaml`
  - Define: `LoginResponse`, `UserDTO`, `RunDetailsDTO`, `PickItemDTO`, `LotDTO`, `ErrorResponse`
  - Define: `SavePickRequest`, `UnpickRequest`, `CompleteRunRequest`
  - Use exact field names from OpenAPI (camelCase)
  - **Dependency**: T002 complete
  - **Deliverable**: TypeScript types match API contracts ✅
  - **Time**: 1 hour

- [X] **T008** [P] Create Rust models from data-model.md (backend)
  - Create `backend/src/models/user.rs` with User struct
  - Create `backend/src/models/production_run.rs` with ProductionRun struct
  - Create `backend/src/models/pick_item.rs` with PickItem struct
  - Create `backend/src/models/lot.rs` with Lot struct
  - Create `backend/src/models/bin.rs` with Bin struct
  - Create `backend/src/models/weight_scale.rs`, `workstation.rs`, `pallet.rs`, `transaction.rs`
  - Add serde derives for JSON serialization
  - **Dependency**: T001 complete
  - **Deliverable**: All entity models defined ✅
  - **Time**: 1.5 hours

- [X] **T009** Create error handling utilities (backend)
  - Create `backend/src/error.rs` with `AppError` enum
  - Implement error codes: `AUTH_*`, `DB_*`, `VALIDATION_*`, `BUSINESS_*`, `HARDWARE_*`
  - Implement `IntoResponse` for `AppError` → JSON error response
  - Create `ErrorResponse` struct matching OpenAPI schema
  - **Dependency**: T001 complete
  - **Deliverable**: Structured error handling ✅
  - **Time**: 1 hour

- [X] **T010** Setup CORS and logging middleware (backend)
  - Configure CORS with CorsLayer (allow_origin, allow_methods, allow_headers)
  - Add TraceLayer middleware for HTTP request/response logging
  - Add middleware layers to Axum router
  - Log all requests with tracing
  - **Dependency**: T001, T006 complete
  - **Deliverable**: Backend logs all API requests ✅
  - **Time**: 1 hour

---

## Phase 3.2: Contract Tests (TDD - Tests MUST Fail First)

**CRITICAL**: All tests in this phase MUST be written and MUST FAIL before ANY implementation in Phase 3.4+

- [X] **T011** [P] Backend auth contract tests
  - Create `backend/tests/contract/auth_contract_test.rs`
  - Test: `test_login_ldap_success` - POST /api/auth/login with LDAP credentials
  - Test: `test_login_sql_fallback` - POST /api/auth/login when LDAP unreachable
  - Test: `test_login_invalid_credentials` - Returns 401 with error code
  - Test: `test_token_refresh_success` - POST /api/auth/refresh with valid token
  - Test: `test_get_current_user` - GET /api/auth/me with JWT
  - Assert request/response schemas match `contracts/openapi.yaml`
  - **Dependency**: T008 complete (models exist)
  - **Expected**: ALL TESTS FAIL (no implementation yet)
  - **Time**: 1.5 hours

- [X] **T012** [P] Backend runs contract tests
  - Create `backend/tests/contract/runs_contract_test.rs`
  - Test: `test_get_run_details` - GET /api/runs/{runNo} returns RunDetailsDTO
  - Test: `test_get_batch_items` - GET /api/runs/{runNo}/batches/{rowNum}/items
  - Test: `test_run_not_found` - Returns 404 with error code
  - Verify auto-population: `fgItemKey` = `FormulaId`, `fgDescription` = `FormulaDesc`
  - **Dependency**: T008 complete
  - **Expected**: ALL TESTS FAIL
  - **Time**: 1 hour

- [X] **T013** [P] Backend picking contract tests (4-phase atomic)
  - Create `backend/tests/contract/picking_contract_test.rs`
  - Test: `test_save_pick_success_4_phase_atomic` - Verify all 4 phases execute with correct table/field names
    - Phase 1: INSERT Cust_PartialLotPicked
    - Phase 2: UPDATE cust_PartialPicked SET PickedPartialQty, ItemBatchStatus='Allocated', PickingDate, ModifiedBy
    - Phase 3: INSERT LotTransaction with TransactionType=5
    - Phase 4: UPDATE LotMaster SET QtyCommitSales += weight
  - Test: `test_save_pick_weight_out_of_tolerance` - Returns error code `VALIDATION_WEIGHT_OUT_OF_TOLERANCE`
  - Test: `test_save_pick_item_already_picked` - Returns error code `BUSINESS_ITEM_ALREADY_PICKED`
  - Test: `test_save_pick_transaction_rollback_on_phase_failure` - Verify rollback
  - Test: `test_unpick_item_success_audit_trail_preserved` - DELETE resets PickedPartialQty to 0, PRESERVES ItemBatchStatus, PickingDate, ModifiedBy
  - Test: `test_unpick_item_uses_composite_key` - Verify WHERE RunNo AND RowNum AND LineId (all 3 keys)
  - Test: `test_unpick_item_not_picked` - Returns error
  - **Dependency**: T008 complete
  - **Expected**: ALL TESTS FAIL
  - **Time**: 2 hours (split into 2 sessions)

- [X] **T014** [P] Backend lots contract tests (FEFO)
  - Create `backend/tests/contract/lots_contract_test.rs`
  - Test: `test_get_available_lots_fefo_sorted` - Verify ORDER BY DateExpiry ASC, Location ASC
  - Test: `test_get_available_lots_insufficient_qty` - Returns empty list
  - Test: `test_get_lots_bin_filtering` - Only TFC1 PARTIAL bins
  - **Dependency**: T008 complete
  - **Expected**: ALL TESTS FAIL
  - **Time**: 1 hour

- [X] **T015** [P] Frontend API client contract tests
  - Create `frontend/tests/contract/api/auth.contract.test.ts`
  - Setup MSW (Mock Service Worker) handlers
  - Test: Login LDAP success returns `LoginResponse` schema
  - Test: Login SQL fallback returns `LoginResponse` schema
  - Test: Invalid credentials returns `ErrorResponse` schema
  - Test: Token refresh returns new JWT
  - Test: Get current user returns `UserDTO`
  - **Dependency**: T007 complete (types exist)
  - **Expected**: Tests fail with "apiClient not implemented"
  - **Time**: 1.5 hours

- [X] **T016** [P] Frontend runs API contract tests
  - Create `frontend/tests/contract/api/runs.contract.test.ts`
  - Test: GET /api/runs/{runNo} returns correct schema
  - Test: GET batch items returns array of `PickItemDTO`
  - Test: Weight ranges calculated correctly (targetQty ± tolerance)
  - **Dependency**: T007 complete
  - **Expected**: Tests fail
  - **Time**: 1 hour

- [X] **T017** [P] Frontend picking API contract tests
  - Create `frontend/tests/contract/api/picking.contract.test.ts`
  - Test: POST /api/picks returns `PickResponse` schema
  - Test: Weight validation error returns structured error
  - Test: DELETE /api/picks unpicks item
  - **Dependency**: T007 complete
  - **Expected**: Tests fail
  - **Time**: 1 hour

- [X] **T018** [P] Frontend WebSocket contract tests
  - Create `frontend/tests/contract/websocket/weight-scale.contract.test.ts`
  - Use `vitest-websocket-mock` (WS mock server)
  - Test: Connection endpoint format `ws://localhost:5000/ws/scale/{small|big}` (workstation ID implicit)
  - Test: Connection lifecycle (connect → startContinuous → continuousStarted)
  - Test: `weightUpdate` message schema (type, weight, unit="KG", stable, scaleId, scaleType, timestamp)
  - Test: `scaleOffline` / `scaleOnline` handling
  - Test: Dual scale support (small + big scales independent state)
  - Test: Performance (<200ms latency for 10 rapid updates)
  - **Dependency**: T007 complete
  - **Expected**: Tests fail with "useWeightScale hook not implemented"
  - **Time**: 1.5 hours

- [ ] ~~**T019**~~ **REMOVED**: Bridge WebSocket protocol tests
  - **No tests needed** - existing bridge service already tested and working
  - Frontend can validate WebSocket communication via E2E tests (T089-T091)
  - **Time saved**: 1 hour

---

## Phase 3.3: Frontend UI (Match Reference Implementation)

**Priority 1**: Replicate familiar UI/UX from `docs/frontend-ref-DontEdit/`

- [X] **T020** [P] Setup shadcn/ui base components
  - Install: `npx shadcn-ui@latest init`
  - Add components: `button`, `input`, `dialog`, `progress`, `card`, `label`, `form`
  - Create `frontend/src/components/ui/` with all base components
  - Configure theme in `tailwind.config.js` (match reference colors)
  - **Dependency**: T002 complete ✅
  - **Deliverable**: shadcn/ui components available ✅
  - **Time**: 1 hour

- [X] **T021** Create AuthContext provider (frontend)
  - Create `frontend/src/contexts/AuthContext.tsx`
  - State: `user`, `token`, `isAuthenticated`, `isLoading`
  - Methods: `login()`, `logout()`, `refreshToken()`
  - Store JWT in localStorage with 168-hour expiration
  - **Dependency**: T007 complete ✅
  - **Deliverable**: Context for authentication state ✅
  - **Time**: 1 hour

- [X] **T022** Create LoginPage UI component (frontend)
  - Create `frontend/src/pages/LoginPage.tsx` matching `docs/frontend-ref-DontEdit/src/app/features/auth/login/`
  - UI: Username input, password input, login button, error message display
  - Reactive state with signals (use `useState` + `useTransition`)
  - Connection status indicator (offline/online)
  - Disable submit when form invalid or loading
  - **Reference**: Angular component structure in `login.component.ts`
  - **Dependency**: T020, T021 complete ✅
  - **Deliverable**: Login page matches reference UI ✅
  - **Time**: 2 hours

- [X] **T023** Create PartialPickingPage layout (frontend)
  - Create `frontend/src/pages/PartialPickingPage.tsx` matching `docs/frontend-ref-DontEdit/src/app/features/picking/partial-picking/`
  - Layout: Top section (run/batch/item details), middle section (lot/bin/weight), bottom section (batch ticket grid)
  - State management with signals
  - Modals: RunSelectionModal, BatchSelectionModal, ItemSelectionModal, LotSelectionModal, BinSelectionModal
  - **Reference**: `partial-picking.component.ts` structure
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Page layout matches reference ✅
  - **Time**: 2 hours

- [X] **T024** [P] Create WeightProgressBar component (frontend)
  - Create `frontend/src/components/picking/WeightProgressBar.tsx` matching reference
  - Display: Current weight, target weight, progress bar, tolerance range indicators
  - Color coding: Red (out of range), Yellow (in range, not stable), Green (stable + in range)
  - Real-time updates from WebSocket weight stream
  - **Reference**: `weight-progress-bar.component.ts`, `weight-progress-bar.component.html`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Weight progress bar matches reference ✅
  - **Time**: 1.5 hours

- [X] **T025** [P] Create RunSelectionModal component (frontend)
  - Create `frontend/src/components/picking/RunSelectionModal.tsx`
  - Search input with debounce (300ms)
  - Display: RunNo, FG Item, Description, Production Date, Status
  - Click to select run → Load batch items
  - **Reference**: `run-selection-modal.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Run selection modal functional ✅
  - **Time**: 1 hour

- [X] **T026** [P] Create BatchSelectionModal component (frontend)
  - Create `frontend/src/components/picking/BatchSelectionModal.tsx`
  - Display list of batches for selected run
  - Show batch number, completion status
  - Click to select batch → Load batch items
  - **Reference**: `batch-selection-modal.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Batch selection modal functional ✅
  - **Time**: 45 minutes

- [X] **T027** [P] Create ItemSelectionModal component (frontend)
  - Create `frontend/src/components/picking/ItemSelectionModal.tsx`
  - Display batch items grid: ItemKey, Description, TargetQty, PickedPartialQty, Status
  - Color coding: Gray (not picked), Green (picked), Red (error)
  - Click to select item → Load FEFO lot
  - **Reference**: `item-selection-modal.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Item selection modal functional ✅
  - **Time**: 1 hour

- [X] **T028** [P] Create LotSelectionModal component (frontend)
  - Create `frontend/src/components/picking/LotSelectionModal.tsx`
  - Display FEFO lots: LotNo, DateExpiry, QtyOnHand, Available Qty
  - FEFO lot highlighted (sorted by DateExpiry ASC)
  - Click to select lot → Load bin
  - **Reference**: `lot-selection-modal.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Lot selection modal functional ✅
  - **Time**: 1 hour

- [X] **T029** [P] Create BinSelectionModal component (frontend)
  - Create `frontend/src/components/picking/BinSelectionModal.tsx`
  - Display bins for selected lot
  - Filter: Only TFC1 PARTIAL bins (Location='TFC1', User1='WHTFC1', User4='PARTIAL')
  - Click to select bin → Populate form
  - **Reference**: `bin-selection-modal.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Bin selection modal functional ✅
  - **Time**: 45 minutes

- [X] **T030** Create BatchTicketGrid component (frontend)
  - Create `frontend/src/components/picking/BatchTicketGrid.tsx`
  - Display all items in current batch
  - Columns: Item, Batch No, Partial (target), Weighted (actual), Balance, Allergens
  - Real-time updates when items picked
  - **Reference**: `BatchTicketPartial` interface in `partial-picking.component.ts`
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Batch ticket grid displays items ✅
  - **Time**: 1 hour

- [X] **T031** Create ConnectionStatus component (frontend)
  - Create `frontend/src/components/shared/ConnectionStatus.tsx`
  - Display: Backend API status, WebSocket status, Offline mode indicator
  - Icons: Green dot (online), Red dot (offline), Yellow dot (reconnecting)
  - **Dependency**: T020 complete ✅
  - **Deliverable**: Connection status indicator ✅
  - **Time**: 30 minutes

- [X] **T032** Create ErrorBoundary component (frontend)
  - Create `frontend/src/components/shared/ErrorBoundary.tsx`
  - Catch React errors, display user-friendly error message
  - Log error to console with stack trace
  - Provide "Reload" button
  - **Dependency**: T002 complete ✅
  - **Deliverable**: Error boundary wraps app ✅
  - **Time**: 30 minutes

- [X] **T033** Implement routing (frontend)
  - Create `frontend/src/App.tsx` with React Router
  - Routes: `/` → LoginPage, `/picking` → PartialPickingPage
  - Protected route: `/picking` requires authentication
  - Redirect to `/` if not authenticated
  - **Dependency**: T022, T023 complete ✅
  - **Deliverable**: Routing between pages works ✅
  - **Time**: 45 minutes

- [X] **T034** Create PickingContext provider (frontend)
  - Create `frontend/src/contexts/PickingContext.tsx`
  - State: `currentRun`, `currentBatch`, `currentItem`, `selectedLot`, `selectedBin`
  - State: `batchItems`, `isLoading`, `errorMessage`
  - Methods: `selectRun()`, `selectBatch()`, `selectItem()`, `selectLot()`, `selectBin()`
  - **Dependency**: T007 complete ✅
  - **Deliverable**: Context for picking workflow state ✅
  - **Time**: 1 hour

- [X] **T035** Integrate modals with PartialPickingPage (frontend)
  - Wire up modal open/close handlers
  - Pass data from context to modals
  - Handle modal selections → Update context state
  - **Dependency**: T023, T025-T029, T034 complete ✅
  - **Deliverable**: Modal workflow functional ✅
  - **Time**: 1 hour

---

## Phase 3.4: Backend Foundation (Support Frontend APIs)

- [X] **T036** Implement JWT token generation/validation utilities (backend)
  - Create `backend/src/utils/jwt.rs`
  - Function: `generate_token(user: &User) -> Result<String>`
  - Function: `validate_token(token: &str) -> Result<Claims>`
  - Read JWT_SECRET and JWT_DURATION_HOURS from config
  - Use `jsonwebtoken` crate with HS256 algorithm
  - **Dependency**: T006, T008 complete
  - **Deliverable**: JWT utilities functional ✅
  - **Time**: 1 hour

- [X] **T037** Create JWT authentication middleware (backend)
  - Create `backend/src/middleware/auth.rs`
  - Extract `Authorization: Bearer <token>` header
  - Validate token using `jwt::validate_token()`
  - Attach `User` to request extensions (via AuthUser extractor)
  - Return 401 if token invalid/missing
  - **Dependency**: T036 complete
  - **Deliverable**: Protected routes require valid JWT ✅
  - **Time**: 1 hour

- [X] **T038** Implement run queries service (backend)
  - Create `backend/src/services/run_service.rs`
  - Function: `get_run_details(run_no: i32) -> Result<RunDetailsDTO>`
  - Query: Uses validated SQL from `backend/src/db/queries/run_details.sql`
  - Auto-populate: `fgItemKey = FormulaId`, `fgDescription = FormulaDesc`
  - Function: `get_batch_items(run_no: i32, row_num: i32) -> Result<Vec<PickItemDTO>>`
  - Query: Uses validated SQL from `backend/src/db/queries/batch_items.sql`
  - Calculate weight ranges: `WeightRangeLow = TargetQty - WeightTolerance`, `WeightRangeHigh = TargetQty + WeightTolerance`
  - **Dependency**: T005, T008 complete, Database Specialist SQL
  - **Deliverable**: Run service queries database ✅
  - **Time**: 1.5 hours

- [X] **T039** Implement runs API endpoints (backend)
  - Create `backend/src/api/runs.rs`
  - `GET /api/runs/:runNo` → Call `run_service::get_run_details()`
  - `GET /api/runs/:runNo/batches/:rowNum/items` → Call `run_service::get_batch_items()`
  - Handle errors: Run not found (404), database errors (500)
  - Add JWT middleware protection
  - **Dependency**: T037, T038 complete
  - **Deliverable**: Runs API endpoints functional ✅
  - **Validates**: T012 contract tests pass
  - **Time**: 1 hour

- [X] **T040** Implement FEFO lot selection service (backend)
  - Create `backend/src/services/lot_service.rs`
  - Function: `get_available_lots(item_key: &str, min_qty: f64) -> Result<Vec<LotDTO>>`
  - Query: Uses validated SQL from `backend/src/db/queries/fefo_lot_selection.sql`
  - **CRITICAL**: ORDER BY DateExpiry ASC, LocationKey ASC (FEFO constitutional requirement)
  - Calculate `availableQty = QtyOnHand - QtyCommitSales`
  - Return FEFO-sorted lots
  - **Dependency**: T005, T008 complete, Database Specialist SQL
  - **Deliverable**: FEFO lot service functional ✅
  - **Time**: 1 hour

- [X] **T041** Implement lots API endpoints (backend)
  - Create `backend/src/api/lots.rs`
  - `GET /api/lots/available?itemKey=X&minQty=Y` → Call `lot_service::get_available_lots()`
  - Add JWT middleware protection
  - **Dependency**: T037, T040 complete
  - **Deliverable**: Lots API endpoint functional ✅
  - **Validates**: T014 contract tests pass
  - **Time**: 45 minutes

- [X] **T042** Implement bin filtering service (backend)
  - Create `backend/src/services/bin_service.rs`
  - Function: `get_bins() -> Result<Vec<BinDTO>>`
  - Query: Uses validated SQL from `backend/src/db/queries/bin_filtering.sql`
  - Filter: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'
  - Return 511 bins
  - **Dependency**: T005, T008 complete, Database Specialist SQL
  - **Deliverable**: Bin filtering service functional ✅
  - **Time**: 30 minutes

- [X] **T043** Implement bins API endpoint (backend)
  - Create `backend/src/api/bins.rs`
  - `GET /api/bins` → Call `bin_service::get_bins()`
  - Add JWT middleware protection
  - **Dependency**: T037, T042 complete
  - **Deliverable**: Bins API endpoint functional ✅
  - **Time**: 30 minutes

- [X] **T044** Implement workstation configuration service (backend)
  - Create `backend/src/services/workstation_service.rs`
  - Function: `get_workstations() -> Result<Vec<WorkstationDTO>>`
  - Query: Uses validated SQL from `backend/src/db/queries/workstation_config.sql`
  - **Dependency**: T005, T008 complete, Database Specialist SQL
  - **Deliverable**: Workstation service functional ✅
  - **Time**: 30 minutes

- [X] **T045** Implement workstations API endpoint (backend)
  - Create `backend/src/api/workstations.rs`
  - `GET /api/workstations` → Call `workstation_service::get_workstations()`
  - Add JWT middleware protection
  - **Dependency**: T037, T044 complete
  - **Deliverable**: Workstations API endpoint functional ✅
  - **Time**: 30 minutes

- [X] **T046** Wire up all API routes in main (backend)
  - Update `backend/src/main.rs`
  - Create router with all routes: `/api/runs/*`, `/api/lots/*`, `/api/bins`, `/api/workstations`
  - Add CORS middleware
  - Add logging middleware (TraceLayer)
  - Add error handling
  - Add config injection middleware
  - **Dependency**: T039, T041, T043, T045 complete
  - **Deliverable**: All API routes accessible ✅
  - **Time**: 1 hour

**Phase 3.4 Status**: ✅ **COMPLETE** (2025-10-07)
- Database Specialist provided validated SQL queries (5 files)
- Backend Engineer implemented all services and endpoints (14 files)
- JWT authentication middleware applied to all protected routes
- Constitutional compliance verified (FEFO, composite keys, correct field names)
- Build status: SUCCESS (0 errors, 25 warnings - unused imports expected until Phase 4)

---

## Phase 3.5: Authentication (LDAP + SQL Dual Auth)

- [X] **T047** Implement LDAP authentication service (backend)
  - Create `backend/src/services/auth_service.rs`
  - Function: `authenticate_ldap(username: &str, password: &str) -> Result<User>`
  - LDAP bind: `ldap://192.168.0.1` with `username@NWFTH.com`
  - On success: Query LDAP attributes (sAMAccountName, givenName, sn, department, employeeID)
  - Return `User` with `authSource = "LDAP"`
  - On LDAP bind failure: Return `Err(AuthError::InvalidCredentials)`
  - On LDAP unreachable: Return `Err(AuthError::LdapUnavailable)`
  - **Dependency**: T008 complete
  - **Deliverable**: LDAP authentication functional ✅
  - **Time**: 1.5 hours

- [X] **T048** Implement SQL fallback authentication service (backend)
  - Update `backend/src/services/auth_service.rs`
  - Function: `authenticate_sql(username: &str, password: &str) -> Result<User>`
  - Query: `SELECT userid, username, password_hash FROM dbo.Users WHERE username = @P1`
  - Verify password with bcrypt: `bcrypt::verify(password, password_hash)?`
  - On success: Return `User` with `authSource = "LOCAL"`
  - On failure: Return `Err(AuthError::InvalidCredentials)`
  - **Dependency**: T005, T008 complete
  - **Deliverable**: SQL authentication functional ✅
  - **Time**: 1 hour

- [X] **T049** Implement dual authentication strategy (backend)
  - Update `backend/src/services/auth_service.rs`
  - Function: `authenticate(username: &str, password: &str) -> Result<User>`
  - Step 1: Try `authenticate_ldap(username, password)`
  - If LDAP bind succeeds: Return LDAP user
  - If LDAP bind fails: Try `authenticate_sql(username, password)` (SQL fallback)
  - If LDAP unreachable: Return error (no fallback)
  - **Dependency**: T047, T048 complete
  - **Deliverable**: Dual authentication strategy functional ✅
  - **Time**: 45 minutes

- [X] **T050** Implement auth API endpoints (backend)
  - Create `backend/src/api/auth.rs`
  - `POST /api/auth/login` → Call `auth_service::authenticate()`, generate JWT, return `LoginResponse`
  - `POST /api/auth/refresh` → Validate old token, generate new token
  - `GET /api/auth/me` → Extract user from JWT, return `UserDTO`
  - Handle errors: Invalid credentials (401), LDAP unreachable (503), token expired (401)
  - **Dependency**: T036, T049 complete
  - **Deliverable**: Auth API endpoints functional ✅
  - **Validates**: T011 contract tests pass
  - **Time**: 1.5 hours

- [X] **T051** Create API client with authentication (frontend)
  - Create `frontend/src/services/api/client.ts`
  - Axios instance with base URL from config
  - Interceptor: Add `Authorization: Bearer <token>` header from localStorage
  - Interceptor: Handle 401 errors → Refresh token or redirect to login
  - Interceptor: Handle network errors → Display error toast
  - **Dependency**: T007 complete
  - **Deliverable**: API client with auth interceptor ✅
  - **Time**: 1 hour

- [X] **T052** Implement auth API service methods (frontend)
  - Create `frontend/src/services/api/auth.ts`
  - Function: `login(username: string, password: string) -> Promise<LoginResponse>`
  - Function: `refreshToken(token: string) -> Promise<{ token: string }>`
  - Function: `getCurrentUser(token: string) -> Promise<UserDTO>`
  - Use API client from T051
  - **Dependency**: T051 complete
  - **Deliverable**: Auth API methods functional ✅
  - **Validates**: T015 contract tests pass
  - **Time**: 45 minutes

- [X] **T053** Integrate AuthContext with auth API (frontend)
  - Update `frontend/src/contexts/AuthContext.tsx`
  - Implement `login()` → Call `authApi.login()`, store token in localStorage
  - Implement `logout()` → Clear localStorage, redirect to login
  - Implement `refreshToken()` → Call `authApi.refreshToken()`, update token
  - Auto-refresh token on startup if not expired
  - **Dependency**: T021, T052 complete
  - **Deliverable**: AuthContext integrated with backend ✅
  - **Time**: 1 hour

- [X] **T054** Wire LoginPage with AuthContext (frontend)
  - Update `frontend/src/pages/LoginPage.tsx`
  - On form submit → Call `authContext.login(username, password)`
  - On success → Redirect to `/picking`
  - On error → Display error message
  - Show loading state during login
  - **Dependency**: T022, T053 complete
  - **Deliverable**: Login page functional end-to-end ✅
  - **Time**: 45 minutes

**Phase 3.5 Status**: ✅ **COMPLETE** (2025-10-07)
- Backend: LDAP + SQL dual auth implemented with JWT tokens
- Frontend: API client, auth service, AuthContext integration complete
- Build status: Backend SUCCESS (0 errors), Frontend SUCCESS (0 auth-related errors)
- Constitutional compliance verified (security by default, JWT validation, bcrypt hashing)

---

## Phase 3.6: Core Picking Functionality (4-Phase Atomic Transactions)

- [X] **T055** Implement 4-phase picking transaction service (backend)
  - Create `backend/src/services/picking_service.rs`
  - Function: `save_pick(request: SavePickRequest) -> Result<PickResponse>`
  - BEGIN TRANSACTION
  - Phase 1: INSERT Cust_PartialLotPicked (lot allocation)
  - Phase 2: UPDATE cust_PartialPicked SET PickedPartialQty (weight update)
  - Phase 3: INSERT LotTransaction with TransactionType=5 (transaction recording)
  - Phase 4: UPDATE LotMaster SET QtyCommitSales += weight (inventory commitment)
  - COMMIT if all phases succeed, ROLLBACK if any phase fails
  - **Dependency**: T005, T008 complete
  - **Deliverable**: 4-phase picking transaction functional
  - **Time**: 2 hours (split into 2 sessions)

- [X] **T056** Implement weight tolerance validation (backend)
  - Update `backend/src/services/picking_service.rs`
  - Before Phase 1: Validate weight within tolerance range
  - Query: `SELECT WeightRangeLow, WeightRangeHigh FROM cust_PartialPicked WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3`
  - If `weight < WeightRangeLow OR weight > WeightRangeHigh`: Return `Err(ValidationError::WeightOutOfTolerance)`
  - Include weight range in error details
  - **Dependency**: T055 complete
  - **Deliverable**: Weight validation enforced
  - **Time**: 45 minutes

- [X] **T057** Implement item already picked validation (backend)
  - Update `backend/src/services/picking_service.rs`
  - Before Phase 1: Check if item already picked
  - Query: `SELECT PickedPartialQty FROM cust_PartialPicked WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3`
  - If `PickedPartialQty > 0`: Return `Err(BusinessError::ItemAlreadyPicked)`
  - **Dependency**: T055 complete
  - **Deliverable**: Duplicate pick prevented
  - **Time**: 30 minutes

- [X] **T058** Implement sequence generation for LotTranNo (backend)
  - Create `backend/src/services/sequence_service.rs`
  - Function: `get_next_value(seq_name: &str) -> Result<i32>`
  - Execute: `EXEC dbo.usp_GetNextValue @P1, @P2 OUTPUT`
  - Return next sequence value for 'PT' sequence
  - **Dependency**: T005 complete
  - **Deliverable**: Sequence generation functional
  - **Time**: 30 minutes

- [X] **T059** Integrate sequence generation in picking service (backend)
  - Update Phase 3 in `backend/src/services/picking_service.rs`
  - Call `sequence_service::get_next_value("PT")` to get LotTranNo
  - Use LotTranNo in INSERT LotTransaction query
  - **Dependency**: T055, T058 complete
  - **Deliverable**: LotTranNo auto-generated
  - **Time**: 30 minutes

- [X] **T060** Implement picking API endpoints (backend)
  - Create `backend/src/api/picks.rs`
  - `POST /api/picks` → Call `picking_service::save_pick()`, return `PickResponse`
  - Handle errors: Weight out of tolerance (400), item already picked (400), database errors (500)
  - Add JWT middleware protection
  - **Dependency**: T037, T055-T059 complete
  - **Deliverable**: Picking API endpoint functional
  - **Validates**: T013 contract tests pass (Phase 1-4 + validation)
  - **Time**: 1 hour

- [X] **T061** Implement unpick/delete service (backend)
  - Update `backend/src/services/picking_service.rs`
  - Function: `unpick_item(run_no: i32, row_num: i32, line_id: i32) -> Result<()>`
  - BEGIN TRANSACTION
  - Step 1: UPDATE cust_PartialPicked SET PickedPartialQty = 0 (preserve ItemBatchStatus, PickingDate, ModifiedBy)
  - Step 2: DELETE FROM Cust_PartialLotPicked WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
  - Step 3: DELETE FROM LotTransaction WHERE LotTranNo IN (SELECT LotTranNo WHERE ...)
  - Step 4: UPDATE LotMaster SET QtyCommitSales -= previous_weight
  - COMMIT if all steps succeed, ROLLBACK if any step fails
  - **Dependency**: T055 complete
  - **Deliverable**: Unpick service functional
  - **Time**: 1.5 hours

- [X] **T062** Implement unpick API endpoint (backend)
  - Update `backend/src/api/picks.rs`
  - `DELETE /api/picks/:runNo/:rowNum/:lineId` → Call `picking_service::unpick_item()`
  - Handle errors: Item not picked (400), database errors (500)
  - Add JWT middleware protection
  - **Dependency**: T037, T061 complete
  - **Deliverable**: Unpick API endpoint functional
  - **Validates**: T013 contract tests pass (unpick tests)
  - **Time**: 45 minutes

- [X] **T063** Implement run completion service (backend)
  - Create `backend/src/services/pallet_service.rs`
  - Function: `complete_run(run_no: i32, pallet_no: &str) -> Result<()>`
  - Validate: All items in all batches picked (PickedPartialQty > 0)
  - If not fully picked: Return `Err(BusinessError::RunNotFullyPicked)` with list of unpicked items
  - BEGIN TRANSACTION
  - Step 1: INSERT INTO dbo.Pallet (PalletNo, RunNo, AssignedDate)
  - Step 2: UPDATE dbo.Formula SET Status = 'PRINT' WHERE RunNo = @P1
  - COMMIT
  - **Dependency**: T005, T008 complete
  - **Deliverable**: Run completion service functional
  - **Time**: 1.5 hours

- [X] **T064** Implement run completion API endpoint (backend)
  - Create `backend/src/api/pallets.rs`
  - `POST /api/runs/:runNo/complete` → Call `pallet_service::complete_run()`
  - Handle errors: Run not fully picked (400), database errors (500)
  - Add JWT middleware protection
  - **Dependency**: T037, T063 complete
  - **Deliverable**: Run completion API endpoint functional
  - **Time**: 45 minutes

- [X] **T065** Implement runs API service methods (frontend)
  - Create `frontend/src/services/api/runs.ts`
  - Function: `getRunDetails(runNo: number) -> Promise<RunDetailsDTO>`
  - Function: `getBatchItems(runNo: number, rowNum: number) -> Promise<PickItemDTO[]>`
  - Function: `completeRun(runNo: number, palletNo: string) -> Promise<void>`
  - Use API client from T051
  - **Dependency**: T051 complete
  - **Deliverable**: Runs API methods functional
  - **Validates**: T016 contract tests pass
  - **Time**: 45 minutes

- [X] **T066** Implement picking API service methods (frontend)
  - Create `frontend/src/services/api/picking.ts`
  - Function: `savePick(request: SavePickRequest) -> Promise<PickResponse>`
  - Function: `unpickItem(runNo: number, rowNum: number, lineId: number) -> Promise<void>`
  - Use API client from T051
  - **Dependency**: T051 complete
  - **Deliverable**: Picking API methods functional
  - **Validates**: T017 contract tests pass
  - **Time**: 30 minutes

- [X] **T067** Implement lots API service methods (frontend)
  - Create `frontend/src/services/api/lots.ts`
  - Function: `getAvailableLots(itemKey: string, targetQty: number) -> Promise<LotDTO[]>`
  - Use API client from T051
  - **Dependency**: T051 complete
  - **Deliverable**: Lots API methods functional
  - **Time**: 30 minutes

- [X] **T068** Integrate PickingContext with picking APIs (frontend)
  - Update `frontend/src/contexts/PickingContext.tsx`
  - Implement `selectRun()` → Call `runsApi.getRunDetails()`, load batches
  - Implement `selectBatch()` → Call `runsApi.getBatchItems()`, load items
  - Implement `selectItem()` → Call `lotsApi.getAvailableLots()`, load FEFO lot
  - Implement `savePick()` → Call `pickingApi.savePick()`, refresh batch items
  - Implement `unpickItem()` → Call `pickingApi.unpickItem()`, refresh batch items
  - **Dependency**: T034, T065, T066, T067 complete
  - **Deliverable**: PickingContext integrated with backend
  - **Time**: 1.5 hours

- [X] **T069** Wire PartialPickingPage with PickingContext (frontend)
  - Update `frontend/src/pages/PartialPickingPage.tsx`
  - Display run/batch/item details from context
  - Handle "Save Pick" button → Call `context.savePick()`
  - Handle "Unpick" button → Call `context.unpickItem()`
  - Display error messages from API
  - Show loading states
  - **Dependency**: T023, T068 complete
  - **Deliverable**: PartialPickingPage functional end-to-end (without WebSocket yet)
  - **Time**: 1.5 hours

---

## Phase 3.7: Real-Time WebSocket Weight Integration

- [ ] ~~**T070**~~ **REMOVED**: Implement serial port service (bridge)
  - **Already implemented** in `Weight-scale/bridge-service/Services/SerialScaleReader.cs`
  - **Time saved**: 2 hours

- [ ] ~~**T071**~~ **REMOVED**: Implement WebSocket connection handler (bridge)
  - **Already implemented** in `Weight-scale/bridge-service/Services/ScaleBroadcastService.cs`
  - Endpoints: `/ws/scale/small` and `/ws/scale/big` already functional
  - **Time saved**: 2 hours

- [ ] ~~**T072**~~ **REMOVED**: Implement weight message protocol (bridge)
  - **Already implemented** in `Weight-scale/bridge-service/Models/ScaleWeightSnapshot.cs`
  - Message types: `weight`, `status` with proper JSON serialization
  - **Time saved**: 45 minutes

- [X] **T073** Implement useWeightScale hook connecting to existing bridge (frontend)
  - Create `frontend/src/hooks/useWeightScale.ts`
  - State: `weight`, `stable`, `online`, `isPending` (from `useTransition`)
  - On mount: Connect to **existing bridge service** at `ws://localhost:5000/ws/scale/{scaleType}` (small or big)
  - Listen for `weight` message type from existing bridge (format: `{type: "weight", data: {weight, unit, stable, scaleId, timestamp}}`)
  - Listen for `status` message type (format: `{type: "status", data: {connected, port, error}}`)
  - On `weight` message: Update state with `startTransition()` (React 19 concurrent rendering)
  - On `status` message with `connected=false`: Set `online = false`
  - On `status` message with `connected=true`: Set `online = true`
  - On unmount: Close WebSocket
  - **Dependency**: T007 complete, existing bridge service running
  - **Deliverable**: useWeightScale hook functional with existing bridge
  - **Validates**: T018 contract tests pass
  - **Time**: 1 hour (reduced from 1.5h - no protocol implementation needed)

- [X] **T074** Integrate useWeightScale with WeightProgressBar (frontend)
  - Update `frontend/src/components/picking/WeightProgressBar.tsx`
  - Use `useWeightScale(workstationId, scaleType)` hook connecting to existing bridge service
  - Display current weight from hook (receives data from `ws://localhost:5000/ws/scale/{scaleType}`)
  - Parse message format: `{type: "weight", data: {weight, unit, stable, scaleId, timestamp}}`
  - Update progress bar in real-time
  - Color coding based on weight range + stability
  - **Dependency**: T024, T073 complete
  - **Deliverable**: Weight progress bar shows real-time weight from existing bridge
  - **Time**: 1 hour

- [X] **T075** Integrate useWeightScale with PartialPickingPage (frontend)
  - Update `frontend/src/pages/PartialPickingPage.tsx`
  - Use `useWeightScale()` hook for small and big scales (connecting to existing bridge endpoints)
  - Auto-populate weight input when scale reading stable (from `data.stable` field)
  - Display scale connection status (from `{type: "status", data: {connected}}` messages)
  - **Dependency**: T069, T073 complete
  - **Deliverable**: PartialPickingPage shows real-time weight from both scales via existing bridge
  - **Time**: 1 hour

---

## Phase 3.8: PWA & Offline Capabilities

- [X] **T076** Configure service worker (frontend)
  - Update `frontend/vite.config.ts` with VitePWA plugin
  - Configure precaching: App shell, static assets
  - Configure runtime caching: API responses (network-first strategy)
  - Configure offline fallback page
  - **Dependency**: T002 complete
  - **Deliverable**: Service worker generated
  - **Time**: 1 hour

- [X] **T077** Create PWA manifest (frontend)
  - Create `frontend/public/manifest.json`
  - Define app name, icons, theme color, background color
  - Add app icons: 192x192, 512x512
  - Set `display: "standalone"`
  - Set `start_url: "/"`
  - **Dependency**: T002 complete
  - **Deliverable**: PWA manifest complete
  - **Time**: 30 minutes

- [X] **T078** Implement service worker registration (frontend)
  - Update `frontend/src/main.tsx`
  - Register service worker on app startup
  - Handle service worker updates
  - Show update notification to user
  - **Dependency**: T076 complete
  - **Deliverable**: Service worker registers on load
  - **Time**: 30 minutes

- [X] **T079** Implement offline detection hook (frontend)
  - Create `frontend/src/hooks/useOnlineStatus.ts`
  - Use `navigator.onLine` and `window` online/offline events
  - Return `isOnline` boolean
  - **Dependency**: T002 complete
  - **Deliverable**: Offline detection hook functional
  - **Time**: 30 minutes

- [X] **T080** Implement offline mode UI (frontend)
  - Update `frontend/src/components/shared/ConnectionStatus.tsx`
  - Use `useOnlineStatus()` hook
  - Display offline banner when offline
  - Disable weight-dependent operations when offline
  - **Dependency**: T031, T079 complete
  - **Deliverable**: Offline mode UI displays
  - **Time**: 45 minutes

- [X] **T081** Implement API caching strategy (frontend)
  - Update `frontend/src/services/api/client.ts`
  - Cache last 5 run details in IndexedDB
  - Cache batch items in IndexedDB
  - Return cached data when offline
  - **Dependency**: T051 complete
  - **Deliverable**: API caching functional
  - **Time**: 1.5 hours

---

## Phase 3.9: Polish, Testing & Deployment

- [X] **T082** [P] Unit tests for FEFO algorithm (backend)
  - Create `backend/tests/unit/fefo_tests.rs`
  - Test: Lots sorted by DateExpiry ASC
  - Test: Lots with insufficient qty excluded
  - Test: Only TFC1 location included
  - **Dependency**: T040 complete
  - **Deliverable**: FEFO algorithm unit tests pass
  - **Time**: 1 hour

- [X] **T083** [P] Unit tests for weight tolerance validation (backend)
  - Create `backend/tests/unit/validation_tests.rs`
  - Test: Weight within tolerance accepted
  - Test: Weight below tolerance rejected
  - Test: Weight above tolerance rejected
  - **Dependency**: T056 complete
  - **Deliverable**: Weight validation unit tests pass
  - **Time**: 45 minutes

- [X] **T084** [P] Unit tests for 4-phase transaction (backend)
  - Create `backend/tests/unit/transaction_tests.rs`
  - Test: All 4 phases execute in order
  - Test: Transaction rolls back on Phase 1 failure
  - Test: Transaction rolls back on Phase 2 failure
  - Test: Transaction rolls back on Phase 3 failure
  - Test: Transaction rolls back on Phase 4 failure
  - **Dependency**: T055 complete
  - **Deliverable**: Transaction rollback tests pass
  - **Time**: 1.5 hours

- [X] **T085** [P] E2E test for login flow (frontend)
  - Create `frontend/tests/e2e/login.spec.ts`
  - Test: LDAP login → Redirect to picking page
  - Test: SQL login → Redirect to picking page
  - Test: Invalid credentials → Display error message
  - Use Playwright for E2E testing
  - **Dependency**: T054 complete
  - **Deliverable**: Login E2E tests pass
  - **Time**: 1 hour

- [X] **T086** [P] E2E test for complete picking flow (frontend)
  - Create `frontend/tests/e2e/picking-flow.spec.ts`
  - Test: Select run → Select batch → Select item → Select lot → Select bin → Weigh → Save pick
  - Verify: Item marked as picked, batch ticket updated
  - **Dependency**: T069 complete
  - **Deliverable**: Picking E2E test passes
  - **Time**: 2 hours

- [X] **T087** [P] E2E test for FEFO compliance (frontend)
  - Create `frontend/tests/e2e/fefo-compliance.spec.ts`
  - Test: Lot selection modal displays FEFO lot first (sorted by DateExpiry ASC)
  - Test: User cannot override FEFO lot
  - **Dependency**: T069 complete
  - **Deliverable**: FEFO E2E test passes
  - **Time**: 1 hour

- [X] **T088** [P] E2E test for offline mode (frontend)
  - Create `frontend/tests/e2e/offline-mode.spec.ts`
  - Test: Disconnect network → Offline banner displays
  - Test: Cached run details accessible offline
  - Test: Weight operations disabled offline
  - **Dependency**: T080, T081 complete
  - **Deliverable**: Offline E2E test passes
  - **Time**: 1 hour

- [X] **T089** [P] E2E test for dual scale switching (frontend)
  - Create `frontend/tests/e2e/scale-switching.spec.ts`
  - Test: Small scale weight updates → Progress bar updates
  - Test: Big scale weight updates → Progress bar updates
  - Test: Independent state for small and big scales
  - **Dependency**: T075 complete
  - **Deliverable**: Dual scale E2E test passes
  - **Time**: 1 hour

- [X] **T090** Performance testing (all services)
  - Backend: API response time <100ms p95
  - Frontend: Bundle size <500KB gzipped
  - WebSocket: Weight update latency <200ms
  - Run performance tests from `quickstart.md`
  - **Dependency**: T069, T075 complete
  - **Deliverable**: Performance targets met
  - **Time**: 1.5 hours

- [X] **T091** [P] Update documentation
  - Create `README.md` with setup instructions
  - Document how to run existing bridge service from `Weight-scale/bridge-service/`
  - Update `docs/api.md` with API endpoints
  - Update `docs/deployment.md` with deployment guide
  - Document environment variables (including bridge service port configuration)
  - **Dependency**: All implementation complete
  - **Deliverable**: Documentation complete
  - **Time**: 1.5 hours

- [X] **T092** Code review and refactoring
  - Remove code duplication
  - Improve error messages
  - Add JSDoc/Rustdoc comments
  - Ensure consistent code style
  - **Dependency**: All implementation complete
  - **Deliverable**: Code quality improved
  - **Time**: 2 hours

- [X] **T093** Run quickstart.md validation scenarios
  - Execute all 10 validation scenarios from `quickstart.md`
  - Scenario 1: Backend API health check
  - Scenario 2: LDAP authentication
  - Scenario 3: SQL authentication fallback
  - Scenario 4: Run details auto-population
  - Scenario 5: Batch items with weight range
  - Scenario 6: FEFO lot selection
  - Scenario 7: 4-phase atomic picking transaction
  - Scenario 8: Weight tolerance validation
  - Scenario 9: WebSocket weight stream
  - Scenario 10: Frontend end-to-end flow
  - **Dependency**: All implementation complete
  - **Deliverable**: All validation scenarios pass
  - **Time**: 2 hours

- [X] **T094** Deployment preparation
  - Create production `.env` file
  - Build production frontend: `npm run build`
  - Build production backend: `cargo build --release`
  - **Note**: Bridge service already exists at `Weight-scale/bridge-service/` - use existing deployment
  - Create deployment package
  - **Dependency**: T093 complete
  - **Deliverable**: Deployment package ready
  - **Time**: 1 hour

- [ ] **T095** Production deployment
  - Deploy backend to production server (port 7075)
  - Deploy frontend to web server (port 6060)
  - **Note**: Bridge service already deployed at `Weight-scale/bridge-service/` - ensure it's running on port 5000
  - Configure reverse proxy (Nginx)
  - Set up SSL certificates
  - **Dependency**: T094 complete
  - **Deliverable**: Production deployment complete
  - **Time**: 2 hours

---

## Dependencies Summary

**Critical Path**:
1. Setup (T001-T010) → All projects initialized
2. Contract Tests (T011-T019) → Tests written and failing
3. Frontend UI (T020-T035) → Familiar UI components
4. Backend Foundation (T036-T046) → APIs support frontend
5. Authentication (T047-T054) → Login functional
6. Core Picking (T055-T069) → Picking workflow functional
7. Real-Time (T070-T075) → WebSocket weight integration
8. PWA (T076-T081) → Offline capabilities
9. Polish (T082-T095) → Testing, docs, deployment

**Blocking Dependencies**:
- T011-T019 (contract tests) before T036+ (implementation)
- T005 (database connection) blocks all backend services
- T020 (shadcn/ui) blocks all frontend components
- T051 (API client) blocks all frontend API integration
- T073 (useWeightScale) blocks T074-T075 (real-time weight)

**Parallel Execution Opportunities**:
- T001, T002, T003 (project setup) can run together
- T004, T006, T007 can run together
- T011-T019 (contract tests) can run together
- T020-T032 (frontend components) can run together
- T082-T089 (E2E tests) can run together

---

## Parallel Execution Examples

**Example 1: Project Setup (Phase 3.1)**
```bash
# Launch T001, T002, T003 in parallel
Task: "Initialize backend Rust project in backend/"
Task: "Initialize frontend React 19 project in frontend/"
Task: "Initialize bridge .NET 8 project in bridge/"
```

**Example 2: Contract Tests (Phase 3.2)**
```bash
# Launch T011-T014 in parallel
Task: "Backend auth contract tests in backend/tests/contract/auth_contract_test.rs"
Task: "Backend runs contract tests in backend/tests/contract/runs_contract_test.rs"
Task: "Backend picking contract tests in backend/tests/contract/picking_contract_test.rs"
Task: "Backend lots contract tests in backend/tests/contract/lots_contract_test.rs"
```

**Example 3: Frontend Components (Phase 3.3)**
```bash
# Launch T024-T029 in parallel (different files)
Task: "Create WeightProgressBar in frontend/src/components/picking/WeightProgressBar.tsx"
Task: "Create RunSelectionModal in frontend/src/components/picking/RunSelectionModal.tsx"
Task: "Create BatchSelectionModal in frontend/src/components/picking/BatchSelectionModal.tsx"
Task: "Create ItemSelectionModal in frontend/src/components/picking/ItemSelectionModal.tsx"
Task: "Create LotSelectionModal in frontend/src/components/picking/LotSelectionModal.tsx"
Task: "Create BinSelectionModal in frontend/src/components/picking/BinSelectionModal.tsx"
```

**Example 4: E2E Tests (Phase 3.9)**
```bash
# Launch T085-T089 in parallel
Task: "E2E test login flow in frontend/tests/e2e/login.spec.ts"
Task: "E2E test picking flow in frontend/tests/e2e/picking-flow.spec.ts"
Task: "E2E test FEFO compliance in frontend/tests/e2e/fefo-compliance.spec.ts"
Task: "E2E test offline mode in frontend/tests/e2e/offline-mode.spec.ts"
Task: "E2E test dual scale switching in frontend/tests/e2e/scale-switching.spec.ts"
```

---

## Task Execution Notes

- **[P] = Parallel**: Tasks marked [P] can run simultaneously (different files, no dependencies)
- **TDD Compliance**: All tests in Phase 3.2 MUST fail before implementing Phase 3.4+
- **Incremental Deploy**: After each phase, code should be in deployable state
- **Time Estimates**: Each task 1-2 hours max (split larger tasks into sub-tasks)
- **Reference Implementation**: Frontend UI should match `docs/frontend-ref-DontEdit/` structure
- **Constitutional Compliance**: Every task must verify against 8 constitutional principles
- **Commit Strategy**: Commit after each task completion

---

## Validation Checklist

**GATE: All items must be checked before tasks.md is complete**

- [x] All contracts have corresponding tests (T011-T019)
- [x] All entities have model tasks (T008)
- [x] All tests come before implementation (Phase 3.2 before Phase 3.4+)
- [x] Parallel tasks truly independent (marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Frontend UI matches reference implementation priority
- [x] Backend infrastructure supports frontend APIs
- [x] Authentication implemented before core features
- [x] Incremental deployment possible after each phase
- [x] All tasks completable in 1-2 hours max

---

**Total Tasks**: 95 tasks
**Estimated Effort**: ~110-140 hours (split across phases)
**Parallel Opportunities**: 25+ tasks can run in parallel
**Deployment Strategy**: Incremental (deploy after each phase)

**Ready for Execution**: ✅ All prerequisites met, tasks validated, ready for `/implement` command
