# PM Orchestration Prompt: Partial Picking System Implementation

**Role**: Project Manager & Orchestrator
**Mission**: Coordinate 6 specialized sub-agents to implement 95 tasks from `specs/001-i-have-an/tasks.md`
**Constitutional Compliance**: Enforce 8 principles from `.specify/memory/constitution.md` at every gate

## 6-Agent Workflow Architecture

```
1. Contract Guardian 🛡️  → Validates openapi.yaml/websocket.md (GATEKEEPER)
2. Database Specialist 🗄️ → FEFO SQL, composite keys, 4-phase transactions
3. Backend Engineer 🦀   → Rust/Axum endpoints using validated SQL
4. Frontend Builder ⚛️   → React 19 UI + WebSocket + PWA
5. QA Engineer 🧪        → Contract tests (TDD), E2E, performance
6. DevOps Manager 🚀     → Deployment, monitoring, docs
```

**Coordination Rules**:
- Contract Guardian approves BEFORE implementation begins
- Database Specialist provides SQL TO Backend Engineer (no SQL rewriting)
- Backend/Frontend can run in parallel AFTER validation
- QA Engineer tests AFTER implementation complete
- DevOps Manager deploys AFTER QA approval

---

## Phase 3.1: Setup & Project Initialization (T001-T010)

### 🎯 Phase Goal
Create project structure, initialize dependencies, configure tooling

### Agent Assignments

#### **STEP 1: DevOps Manager** (Parallel: T001, T002)
**Task T001**: Initialize backend Rust project structure
```
Create `backend/` directory
Initialize `Cargo.toml` with dependencies: axum@0.7, tiberius@0.12, bb8-tiberius, jsonwebtoken, bcrypt, ldap3, tokio, serde, serde_json
Create `backend/src/main.rs` with basic Axum server
Create `backend/.env.example` from template
Create `backend/src/config.rs` for environment variable loading
Deliverable: `cargo build` succeeds
```

**Task T002**: Initialize frontend React 19 project structure
```
Create `frontend/` directory
Initialize with Vite: `npm create vite@latest frontend -- --template react-ts`
Update `package.json` dependencies: react@19, tailwindcss@3, @radix-ui/react-*, @tanstack/react-query@5, zustand
Create `frontend/.env.example` from template
Create `frontend/vite.config.ts` with PWA plugin configuration
Create `frontend/tailwind.config.js` matching reference theme
Deliverable: `npm run dev` starts development server
```

#### **STEP 2: DevOps Manager** (T004, T006)
**Task T004**: Configure linting and formatting
**Task T006**: Environment configuration loading

#### **STEP 3: Backend Engineer** (T005, T008, T009, T010)
**Task T005**: Database connection verification
**Task T008**: Create Rust models from data-model.md
**Task T009**: Create error handling utilities
**Task T010**: Setup CORS and logging middleware

#### **STEP 4: Frontend Builder** (T007)
**Task T007**: Create shared TypeScript types from OpenAPI spec

### ✅ Phase 3.1 Completion Gate
- [ ] `cargo build` succeeds (backend)
- [ ] `npm run dev` succeeds (frontend)
- [ ] Bridge service verified at `Weight-scale/bridge-service/` (existing)
- [ ] Database connection to TFCPILOT3 @ 192.168.0.86:49381 successful
- [ ] All TypeScript types match `contracts/openapi.yaml`

---

## Phase 3.2: Contract Tests (TDD - Tests MUST Fail First) (T011-T018)

### 🎯 Phase Goal
Write ALL contract tests that MUST FAIL before ANY implementation

### 🛡️ CRITICAL: Contract Guardian Gate
**BEFORE any test is written, Contract Guardian MUST validate:**
```
Agent: Contract Guardian
Task: Validate ALL test specifications against contracts
- Read `specs/001-i-have-an/contracts/openapi.yaml`
- Read `specs/001-i-have-an/contracts/websocket.md`
- Verify test assertions match contract schemas exactly
- Check field names (e.g., PickedPartialQty NOT PickedPartialQtyKG)
- Check table names (e.g., cust_PartialPicked NOT Cust_PartialPicked)
- Check composite keys (RunNo, RowNum, LineId - all 3!)
- Approve test specifications OR reject with corrections
```

### Agent Assignments

#### **STEP 1: QA Engineer** (Parallel: T011-T014 after Contract Guardian approval)
**Task T011**: Backend auth contract tests
```
Create `backend/tests/contract/auth_contract_test.rs`
Test: POST /api/auth/login with LDAP credentials → LoginResponse schema
Test: POST /api/auth/login SQL fallback → LoginResponse schema
Test: Invalid credentials → 401 with ErrorResponse schema
Test: POST /api/auth/refresh → New JWT
Test: GET /api/auth/me → UserDTO schema
EXPECTED: ALL TESTS FAIL (no implementation yet)
```

**Task T012**: Backend runs contract tests (FEFO validation)
**Task T013**: Backend picking contract tests (4-phase atomic)
**Task T014**: Backend lots contract tests (FEFO)

#### **STEP 2: QA Engineer** (Parallel: T015-T018)
**Task T015**: Frontend auth API contract tests
**Task T016**: Frontend runs API contract tests
**Task T017**: Frontend picking API contract tests
**Task T018**: Frontend WebSocket contract tests

### ✅ Phase 3.2 Completion Gate
- [ ] Contract Guardian approved ALL test specifications
- [ ] ALL backend contract tests exist and FAIL
- [ ] ALL frontend contract tests exist and FAIL
- [ ] Test failures are EXPECTED (no implementation)
- [ ] Run: `cargo test --test '*_contract_test'` → ALL FAIL ✅
- [ ] Run: `npm test` → ALL contract tests FAIL ✅

**⚠️ BLOCKING GATE**: NO implementation work (Phase 3.4+) begins until ALL tests are failing

---

## Phase 3.3: Frontend UI (Match Reference Implementation) (T020-T035)

### 🎯 Phase Goal
Replicate familiar UI/UX from `docs/frontend-ref-DontEdit/`

### Agent Assignments

#### **STEP 1: Frontend Builder** (T020)
**Task T020**: Setup shadcn/ui base components
```
(we already have existing shadcn mcp try mcp first if not work install)
Install: npx shadcn-ui@latest init
Add components: button, input, dialog, progress, card, label, form
Create frontend/src/components/ui/ with all base components
Configure theme in tailwind.config.js (match reference colors)
```

#### **STEP 2: Frontend Builder** (Parallel: T021-T023)
**Task T021**: Create AuthContext provider
**Task T022**: Create LoginPage UI component
**Task T023**: Create PartialPickingPage layout

#### **STEP 3: Frontend Builder** (Parallel: T024-T032)
**Task T024**: Create WeightProgressBar component
**Task T025**: Create RunSelectionModal component
**Task T026**: Create BatchSelectionModal component
**Task T027**: Create ItemSelectionModal component
**Task T028**: Create LotSelectionModal component
**Task T029**: Create BinSelectionModal component
**Task T030**: Create BatchTicketGrid component
**Task T031**: Create ConnectionStatus component
**Task T032**: Create ErrorBoundary component

#### **STEP 4: Frontend Builder** (T033-T035)
**Task T033**: Implement routing
**Task T034**: Create PickingContext provider
**Task T035**: Integrate modals with PartialPickingPage

### ✅ Phase 3.3 Completion Gate
- [ ] All UI components match `docs/frontend-ref-DontEdit/` structure
- [ ] WeightProgressBar displays progress with color coding
- [ ] All modals (Run, Batch, Item, Lot, Bin) functional
- [ ] Routing works: `/` → Login, `/picking` → PartialPicking
- [ ] AuthContext and PickingContext providers ready
- [ ] NO backend integration yet

---

## Phase 3.4: Backend Foundation (Support Frontend APIs) (T036-T046)

### 🎯 Phase Goal
Implement backend APIs to support frontend UI

### 🗄️ Database Specialist Gate (Before Backend Implementation)
```
Agent: Database Specialist
Task: Provide validated SQL queries for Backend Engineer
- FEFO lot selection query (ORDER BY DateExpiry ASC, Location ASC)
- Run details query (auto-populate fgItemKey = FormulaId)
- Batch items query (calculate WeightRangeLow/High)
- Bin filtering query (Location='TFC1', User1='WHTFC1', User4='PARTIAL')
- Workstation configuration query
Deliverables: SQL files in `backend/src/db/queries/` with composite key filters
```

### Agent Assignments

#### **STEP 1: Backend Engineer** (T036-T037)
**Task T036**: Implement JWT token generation/validation utilities
**Task T037**: Create JWT authentication middleware

#### **STEP 2: Backend Engineer + Database Specialist** (T038-T045)
**Task T038**: Implement run queries service (use Database Specialist SQL)
**Task T039**: Implement runs API endpoints
**Task T040**: Implement FEFO lot selection service (use Database Specialist SQL)
**Task T041**: Implement lots API endpoints
**Task T042**: Implement bin filtering service (use Database Specialist SQL)
**Task T043**: Implement bins API endpoint
**Task T044**: Implement workstation configuration service
**Task T045**: Implement workstations API endpoint

#### **STEP 3: Backend Engineer** (T046)
**Task T046**: Wire up all API routes in main

### ✅ Phase 3.4 Completion Gate
- [ ] Database Specialist provided ALL SQL queries
- [ ] Backend Engineer used validated SQL (NO modifications)
- [ ] JWT middleware protects all endpoints
- [ ] Run: `cargo test --test '*_contract_test'` → T012 tests PASS ✅
- [ ] FEFO query uses correct ORDER BY (DateExpiry ASC, Location ASC)
- [ ] All queries use composite keys (RunNo, RowNum, LineId)

---

## Phase 3.5: Authentication (LDAP + SQL Dual Auth) (T047-T054)

### 🎯 Phase Goal
Implement dual authentication with LDAP primary, SQL fallback

### Agent Assignments

#### **STEP 1: Backend Engineer** (T047-T050)
**Task T047**: Implement LDAP authentication service
**Task T048**: Implement SQL fallback authentication service
**Task T049**: Implement dual authentication strategy
**Task T050**: Implement auth API endpoints

#### **STEP 2: Frontend Builder** (T051-T053)
**Task T051**: Create API client with authentication
**Task T052**: Implement auth API service methods
**Task T053**: Integrate AuthContext with auth API

#### **STEP 3: Frontend Builder** (T054)
**Task T054**: Wire LoginPage with AuthContext

### ✅ Phase 3.5 Completion Gate
- [ ] Run: `cargo test --test '*_contract_test'` → T011 tests PASS ✅
- [ ] Run: `npm test` → T015 contract tests PASS ✅
- [ ] LDAP authentication against `ldap://192.168.0.1` works
- [ ] SQL fallback to `dbo.Users` table works
- [ ] JWT token stored in localStorage (168-hour expiration)
- [ ] Login page redirects to `/picking` on success

---

## Phase 3.6: Core Picking Functionality (4-Phase Atomic Transactions) (T055-T069)

### 🎯 Phase Goal
Implement 4-phase atomic picking with weight validation

### 🗄️ Database Specialist Gate (4-Phase Transaction SQL)
```
Agent: Database Specialist
Task: Provide 4-phase atomic transaction SQL
Phase 1: INSERT Cust_PartialLotPicked (lot allocation)
Phase 2: UPDATE cust_PartialPicked SET PickedPartialQty (weight update)
Phase 3: INSERT LotTransaction with TransactionType=5 (transaction recording)
Phase 4: UPDATE LotMaster SET QtyCommitSales += weight (inventory commitment)
CRITICAL: All phases in single BEGIN...COMMIT transaction with ROLLBACK on failure
```

### Agent Assignments

#### **STEP 1: Backend Engineer + Database Specialist** (T055-T059)
**Task T055**: Implement 4-phase picking transaction service (use Database Specialist SQL)
**Task T056**: Implement weight tolerance validation
**Task T057**: Implement item already picked validation
**Task T058**: Implement sequence generation for LotTranNo
**Task T059**: Integrate sequence generation in picking service

#### **STEP 2: Backend Engineer** (T060-T064)
**Task T060**: Implement picking API endpoints
**Task T061**: Implement unpick/delete service
**Task T062**: Implement unpick API endpoint
**Task T063**: Implement run completion service
**Task T064**: Implement run completion API endpoint

#### **STEP 3: Frontend Builder** (T065-T069)
**Task T065**: Implement runs API service methods
**Task T066**: Implement picking API service methods
**Task T067**: Implement lots API service methods
**Task T068**: Integrate PickingContext with picking APIs
**Task T069**: Wire PartialPickingPage with PickingContext

### ✅ Phase 3.6 Completion Gate
- [ ] Run: `cargo test --test '*_contract_test'` → T013 tests PASS ✅
- [ ] Run: `npm test` → T017 contract tests PASS ✅
- [ ] 4-phase transaction is ATOMIC (all or nothing)
- [ ] Weight tolerance validation enforced (400 error if out of range)
- [ ] Unpick preserves audit trail (ItemBatchStatus, PickingDate, ModifiedBy)
- [ ] PickingPage functional end-to-end (without WebSocket)

---

## Phase 3.7: Real-Time WebSocket Weight Integration (T073-T075)

### 🎯 Phase Goal
Integrate real-time weight from existing bridge service

### Agent Assignments

#### **STEP 1: Frontend Builder** (T073)
**Task T073**: Implement useWeightScale hook connecting to existing bridge
```
Connect to existing bridge service: ws://localhost:5000/ws/scale/{scaleType}
Message format from bridge: {type: "weight", data: {weight, unit, stable, scaleId, timestamp}}
Use React 19 useTransition for non-blocking updates (<200ms latency)
Handle status messages: {type: "status", data: {connected, port, error}}
```

#### **STEP 2: Frontend Builder** (T074-T075)
**Task T074**: Integrate useWeightScale with WeightProgressBar
**Task T075**: Integrate useWeightScale with PartialPickingPage

### ✅ Phase 3.7 Completion Gate
- [ ] Run: `npm test` → T018 WebSocket contract tests PASS ✅
- [ ] WebSocket connection to existing bridge successful
- [ ] Weight updates <200ms latency (React 19 concurrent rendering)
- [ ] Small and big scales have independent state
- [ ] Weight auto-populates when stable
- [ ] Connection status displayed (online/offline)

---

## Phase 3.8: PWA & Offline Capabilities (T076-T081)

### 🎯 Phase Goal
Add offline PWA capabilities with service worker

### Agent Assignments

#### **STEP 1: Frontend Builder** (T076-T078)
**Task T076**: Configure service worker
**Task T077**: Create PWA manifest
**Task T078**: Implement service worker registration

#### **STEP 2: Frontend Builder** (T079-T081)
**Task T079**: Implement offline detection hook
**Task T080**: Implement offline mode UI
**Task T081**: Implement API caching strategy

### ✅ Phase 3.8 Completion Gate
- [ ] Service worker precaches app shell and static assets
- [ ] PWA manifest with 192x192 and 512x512 icons
- [ ] Offline banner displays when network unavailable
- [ ] Last 5 run details cached in IndexedDB
- [ ] Cached data accessible offline
- [ ] Weight operations disabled when offline

---

## Phase 3.9: Polish, Testing & Deployment (T082-T095)

### 🎯 Phase Goal
Complete testing, optimize performance, deploy to production

### Agent Assignments

#### **STEP 1: QA Engineer** (Parallel: T082-T089)
**Task T082**: Unit tests for FEFO algorithm
**Task T083**: Unit tests for weight tolerance validation
**Task T084**: Unit tests for 4-phase transaction
**Task T085**: E2E test for login flow
**Task T086**: E2E test for complete picking flow
**Task T087**: E2E test for FEFO compliance
**Task T088**: E2E test for offline mode
**Task T089**: E2E test for dual scale switching

#### **STEP 2: QA Engineer** (T090)
**Task T090**: Performance testing
```
Backend: API response time <100ms p95
Frontend: Bundle size <500KB gzipped
WebSocket: Weight update latency <200ms
Run all scenarios from quickstart.md
```

#### **STEP 3: DevOps Manager** (T091-T092)
**Task T091**: Update documentation
**Task T092**: Code review and refactoring

#### **STEP 4: QA Engineer** (T093)
**Task T093**: Run quickstart.md validation scenarios
```
Execute all 10 validation scenarios:
1. Backend API health check
2. LDAP authentication
3. SQL authentication fallback
4. Run details auto-population
5. Batch items with weight range
6. FEFO lot selection
7. 4-phase atomic picking transaction
8. Weight tolerance validation
9. WebSocket weight stream
10. Frontend end-to-end flow
```

#### **STEP 5: DevOps Manager** (T094-T095)
**Task T094**: Deployment preparation
```
Create production .env file
Build production frontend: npm run build
Build production backend: cargo build --release
Create deployment package
```

**Task T095**: Production deployment
```
Deploy backend to 192.168.0.10:7075 (Windows PowerShell)
Deploy frontend to 192.168.0.10:6060 (IIS)
Verify bridge service at 192.168.0.10:5000
Configure SSL certificates
Database at 192.168.0.86:49381
```

### ✅ Phase 3.9 Completion Gate
- [ ] ALL unit tests pass
- [ ] ALL E2E tests pass at 1280x1024 resolution
- [ ] Performance targets met (API <100ms, WebSocket <200ms, Bundle <500KB)
- [ ] All 10 quickstart.md scenarios pass
- [ ] Documentation complete (README, API docs, deployment guide)
- [ ] Production deployment successful
- [ ] Windows host (192.168.0.10) serving all services
- [ ] Database connection to 192.168.0.86 verified

---

## Constitutional Compliance Checklist

**MANDATORY VERIFICATION at EVERY phase:**

1. ✅ **Contract-First Development**
   - Contract Guardian approved before implementation?
   - All APIs match openapi.yaml schemas?
   - WebSocket messages match websocket.md?

2. ✅ **Type Safety**
   - TypeScript strict mode enabled?
   - Rust compile-time guarantees enforced?
   - No `any` types in TypeScript?

3. ✅ **TDD with Failing Tests**
   - Contract tests written FIRST?
   - Tests FAILED before implementation?
   - Tests PASS after implementation?

4. ✅ **Atomic Transactions**
   - 4-phase picking is atomic?
   - ROLLBACK on any phase failure?
   - No partial state commits?

5. ✅ **Real-Time Performance**
   - WebSocket latency <200ms?
   - API response <100ms p95?
   - React 19 useTransition for concurrent updates?

6. ✅ **Security by Default**
   - JWT auth on all endpoints?
   - CORS configured?
   - Parameterized queries (no SQL injection)?

7. ✅ **Audit Trail Preservation**
   - ItemBatchStatus preserved on unpick?
   - PickingDate preserved?
   - ModifiedBy preserved?

8. ✅ **No Artificial Keys**
   - Composite keys used (RunNo, RowNum, LineId)?
   - NO surrogate IDs added?
   - All 3 keys in WHERE clauses?

---

## Parallel Execution Commands

### Phase 3.1 Setup (Parallel Tasks)
```bash
# Launch T001 + T002 simultaneously
Task Agent: DevOps Manager
Tasks: [T001, T002]
Description: "Initialize backend Rust and frontend React 19 projects in parallel"
```

### Phase 3.2 Contract Tests (Parallel Tasks)
```bash
# Launch T011-T014 simultaneously (after Contract Guardian approval)
Task Agent: QA Engineer
Tasks: [T011, T012, T013, T014]
Description: "Write backend contract tests in parallel - ALL MUST FAIL"

# Launch T015-T018 simultaneously
Task Agent: QA Engineer
Tasks: [T015, T016, T017, T018]
Description: "Write frontend contract tests in parallel - ALL MUST FAIL"
```

### Phase 3.3 Frontend UI (Parallel Tasks)
```bash
# Launch T024-T029 simultaneously
Task Agent: Frontend Builder
Tasks: [T024, T025, T026, T027, T028, T029]
Description: "Create all modal components in parallel (different files)"
```

### Phase 3.9 Testing (Parallel Tasks)
```bash
# Launch T082-T089 simultaneously
Task Agent: QA Engineer
Tasks: [T082, T083, T084, T085, T086, T087, T088, T089]
Description: "Run all unit and E2E tests in parallel"
```

---

## Agent Handoff Protocol

### When to Invoke Each Agent

#### 🛡️ Contract Guardian
**TRIGGER**: Before ANY implementation that touches APIs or WebSocket
**INPUT**: Contract specifications (openapi.yaml, websocket.md)
**OUTPUT**: Approval ✅ or Rejection ❌ with corrections
**BLOCKS**: All implementation work until approved

#### 🗄️ Database Specialist
**TRIGGER**: Before writing any SQL queries
**INPUT**: data-model.md, constitutional FEFO requirements
**OUTPUT**: Validated SQL files with composite keys
**DELIVERS TO**: Backend Engineer (no modifications allowed)

#### 🦀 Backend Engineer
**TRIGGER**: After Contract Guardian approval + Database Specialist SQL ready
**INPUT**: Validated SQL, OpenAPI schemas, constitutional principles
**OUTPUT**: Rust/Axum endpoints, services, middleware
**DEPENDS ON**: Database Specialist SQL (use as-is)

#### ⚛️ Frontend Builder
**TRIGGER**: After Contract Guardian approval OR in parallel with Backend
**INPUT**: OpenAPI types, reference UI (docs/frontend-ref-DontEdit/), WebSocket protocol
**OUTPUT**: React 19 components, hooks, contexts, PWA features
**USES**: shadcn/ui, TanStack Query, Zustand

#### 🧪 QA Engineer
**TRIGGER**:
- BEFORE implementation (write failing tests)
- AFTER implementation (validate tests pass)
- END of phase (E2E tests, performance validation)
**INPUT**: Contract specifications, constitutional requirements
**OUTPUT**:
- Contract tests (MUST FAIL before implementation)
- E2E tests (validate complete workflows)
- Performance reports (verify <100ms API, <200ms WebSocket)

#### 🚀 DevOps Manager
**TRIGGER**:
- START of project (setup, environment)
- AFTER QA approval (deployment)
- END of phase (documentation updates)
**INPUT**: Deployment requirements, production environment specs
**OUTPUT**:
- Development environment setup
- Production deployment (Windows PowerShell to 192.168.0.10)
- Documentation (README, deployment guides)
- CLAUDE.md updates

---

## Quality Gates Between Phases

### Gate 1: After Phase 3.1 (Setup)
**QA CHECK**: Run prerequisite validation
```bash
cd backend && cargo build
cd frontend && npm run dev
# Verify bridge service at Weight-scale/bridge-service/
```

### Gate 2: After Phase 3.2 (Contract Tests)
**QA CHECK**: Verify ALL tests FAIL
```bash
cargo test --test '*_contract_test'  # ALL MUST FAIL
npm test                              # ALL contract tests MUST FAIL
```
**BLOCKING**: NO Phase 3.4+ work until this gate passes

### Gate 3: After Phase 3.4 (Backend Foundation)
**QA CHECK**: Verify contract tests NOW PASS
```bash
cargo test --test '*_contract_test'  # T012 MUST PASS
```

### Gate 4: After Phase 3.6 (Core Picking)
**QA CHECK**: 4-phase transaction validation
```bash
cargo test --test '*_contract_test'  # T013 MUST PASS (4-phase atomicity)
```

### Gate 5: After Phase 3.7 (WebSocket)
**QA CHECK**: Performance validation
```bash
npm test  # T018 WebSocket tests PASS
# Measure WebSocket latency <200ms
```

### Gate 6: After Phase 3.9 (Final)
**QA CHECK**: Complete validation
```bash
# Run all 10 quickstart.md scenarios
# Performance targets met
# Documentation complete
```

---

## Common Pitfalls & Prevention

### ❌ Pitfall 1: Wrong Table/Field Names
**Prevention**: Contract Guardian reviews ALL SQL before execution
**Common Errors**:
- `Cust_PartialPicked` → ✅ `cust_PartialPicked` (lowercase c)
- `PickedPartialQtyKG` → ✅ `PickedPartialQty` (no KG suffix)

### ❌ Pitfall 2: Missing Composite Keys
**Prevention**: Database Specialist validates ALL WHERE clauses
**Rule**: ALWAYS use RunNo + RowNum + LineId (all 3!)

### ❌ Pitfall 3: Wrong FEFO Sort Order
**Prevention**: Contract Guardian validates FEFO query
**Correct**: `ORDER BY DateExpiry ASC, Location ASC` (DateExpiry FIRST)

### ❌ Pitfall 4: Deleting Audit Trail
**Prevention**: Backend Engineer reviews unpick logic
**Rule**: ONLY set `PickedPartialQty=0`, NEVER touch ItemBatchStatus/PickingDate/ModifiedBy

---

## Example: Complete Flow for One Feature

### Feature: Implement Save Pick Functionality

#### Step 1: Contract Guardian Validation
```
Agent: Contract Guardian
Task: Validate POST /api/picks endpoint specification
- Read contracts/openapi.yaml
- Verify SavePickRequest schema
- Verify PickResponse schema
- Verify error schemas (400, 401, 500)
Output: ✅ APPROVED - specification matches contract
```

#### Step 2: QA Engineer (Write Failing Test)
```
Agent: QA Engineer
Task: Write contract test for save pick (T013)
- Create backend/tests/contract/picking_contract_test.rs
- Test: test_save_pick_success_4_phase_atomic
- Test: test_save_pick_weight_out_of_tolerance
- Test: test_save_pick_transaction_rollback_on_phase_failure
Output: Tests written and FAILING ❌ (expected)
```

#### Step 3: Database Specialist (Provide SQL)
```
Agent: Database Specialist
Task: Provide 4-phase atomic transaction SQL (T055)
Output: 4 SQL statements in backend/src/db/queries/save_pick.sql
- Phase 1: INSERT Cust_PartialLotPicked
- Phase 2: UPDATE cust_PartialPicked
- Phase 3: INSERT LotTransaction (with sequence)
- Phase 4: UPDATE LotMaster
All in BEGIN...COMMIT transaction
```

#### Step 4: Backend Engineer (Implement)
```
Agent: Backend Engineer
Task: Implement save_pick service (T055, T060)
- Create backend/src/services/picking_service.rs
- Use Database Specialist SQL EXACTLY as provided
- Implement save_pick() function
- Create POST /api/picks endpoint
- Add JWT middleware
Output: Implementation complete
```

#### Step 5: QA Engineer (Validate)
```
Agent: QA Engineer
Task: Run contract tests
Command: cargo test --test '*_contract_test'
Expected: T013 tests NOW PASS ✅
```

#### Step 6: Frontend Builder (Integrate)
```
Agent: Frontend Builder
Task: Integrate save pick in UI (T066, T068, T069)
- Create frontend/src/services/api/picking.ts
- Implement savePick() method
- Wire to PickingContext
- Connect to PartialPickingPage
Output: Save pick button functional
```

#### Step 7: QA Engineer (E2E Test)
```
Agent: QA Engineer
Task: E2E test for complete picking flow (T086)
- Create frontend/tests/e2e/picking-flow.spec.ts
- Test: Select run → batch → item → lot → bin → weigh → save
- Verify: Item marked as picked, batch ticket updated
Expected: E2E test PASSES ✅
```

#### Step 8: DevOps Manager (Document)
```
Agent: DevOps Manager
Task: Update documentation
- Add save pick to docs/api.md
- Update quickstart.md validation scenario
Output: Documentation complete
```

---

## Final Deployment Checklist

### Pre-Deployment (DevOps Manager)
- [ ] All 10 quickstart.md scenarios pass
- [ ] Performance targets met (API <100ms, WebSocket <200ms)
- [ ] Frontend bundle <500KB gzipped
- [ ] Production .env configured
- [ ] SSL certificates ready
- [ ] Windows PowerShell deployment script tested

### Deployment to Production (192.168.0.10 Windows)
```powershell
# Run deployment script
.\scripts\deploy-production.ps1

# Verify services
http://192.168.0.10:7075/api/health      # Backend
http://192.168.0.10:6060                 # Frontend
ws://192.168.0.10:5000/ws/scale/small    # Bridge

# Database connection
192.168.0.86:49381 (TFCPILOT3)
```

### Post-Deployment Validation
- [ ] Backend API health check passes
- [ ] Frontend loads and displays login page
- [ ] WebSocket connection to scales successful
- [ ] Database queries execute successfully
- [ ] LDAP authentication works
- [ ] Complete picking flow functional

---

## Success Criteria

**Project is complete when:**
1. ✅ All 95 tasks completed
2. ✅ All 8 constitutional principles verified
3. ✅ Contract Guardian approved all APIs/WebSocket
4. ✅ Database Specialist provided all SQL (used without modification)
5. ✅ All contract tests PASS
6. ✅ All E2E tests PASS at 1280x1024 resolution
7. ✅ All 10 quickstart.md scenarios PASS
8. ✅ Performance targets met
9. ✅ Production deployment successful
10. ✅ Documentation complete

**Ready to Execute**: Use this prompt to orchestrate all 6 sub-agents for complete Partial Picking System implementation following TDD, constitutional compliance, and quality gates.
