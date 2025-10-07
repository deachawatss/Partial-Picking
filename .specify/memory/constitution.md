# Partial Picking System Constitution

## Core Principles

### I. Database Schema Fidelity (NON-NEGOTIABLE)
All database interactions must conform to the verified production schema (v2.5):
- Composite primary keys must be used correctly (Item + Location + Lot + LotSeq)
- Field naming verified from production: `PickedPartialQty` (NOT PickedPartialQtyKG)
- QtyCommitSales updates during picking operations (immediate commitment)
- BIN filtering: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL' (511 bins only)
- No schema assumptions without verification against real production data

### II. FEFO Compliance (NON-NEGOTIABLE)
First Expired, First Out algorithm is the core business rule:
- Lot selection MUST sort by ExpDate ASC, then Location ASC
- Operators cannot override FEFO-selected bins
- System must present only the next FEFO-compliant bin
- Manual bin selection removed from production version
- FEFO logic must be tested against real production runs (213972, 213989, 6000037)

### III. 4-Phase Transaction Atomicity
All picking operations follow the verified 4-phase pattern:
1. Lot allocation (TFC_Picking record creation)
2. Weight update (INVLOT.PickedPartialQty + INMAST.PickedPartialQtyKG)
3. Transaction recording (TFHTRX with timestamp)
4. Inventory commitment (INVLOT.QtyCommitSales)

Phases must execute atomically with proper rollback on failure. Each phase must be individually verifiable in audit trail.

### IV. Real-Time Weight Integration
Weight scale integration is critical to operational accuracy:
- Dual scale support (SMALL/BIG) via TFC_Weightscale2 configuration
- WebSocket bridge (.NET 8) for Windows hardware integration
- Weight tolerance validation: INMAST.User9 (absolute KG values, e.g., ±0.025 KG)
- Scale readings must update UI within 200ms
- Offline mode must disable weight-dependent operations

### V. Audit Trail Preservation
All operations must maintain complete audit trails:
- Unpick/delete operations preserve original transaction records
- Modification fields tracked: ModifiedBy, ModifiedDate, ModifiedTime
- TFHTRX transaction log is append-only (never delete)
- TFC_Picking_Backup maintains full history
- Audit queries must be performant (indexed on timestamp fields)

### VI. Production-Ready Quality Standards
Code must meet production deployment criteria:
- TypeScript strict mode enabled (no `any` types without justification)
- Error handling with specific error codes and user-facing messages
- Loading states for all async operations
- Responsive design tested on actual warehouse tablets (10-12" screens)
- Offline PWA capability with service worker implementation
- Print operations work on Windows native printers (4×4" labels)

### VII. Maintain Working User Experience
Preserve proven UX patterns from Angular prototype:
- 3-step workflow: FG Selection → Bin Assignment → Weight Confirmation
- Visual feedback: Color coding (green=in-tolerance, red=out-of-tolerance)
- Workstation selection persists across sessions (localStorage)
- Label printing on every successful pick (individual + batch summary)
- No unnecessary navigation steps added

### VIII. Environment Configuration (NON-NEGOTIABLE)
All environment-specific values must be configured via `.env`:
- No hard-coded ports, database connections, or service URLs in source code
- Configuration values: DATABASE_SERVER (192.168.0.86), DATABASE_PORT (49381), DATABASE_NAME (TFCPILOT3)
- Service ports: BACKEND_PORT (7075), FRONTEND_PORT (6060), BRIDGE_SERVICE_PORT (5000)
- Authentication: LDAP_URL, JWT_SECRET, JWT_DURATION_HOURS
- Hardware: DEFAULT_SCALE_BAUD_RATE, WEIGHT_POLLING_INTERVAL_MS, SCALE_CONTINUOUS_MODE
- `.env` file is the single source of truth for all deployments

## Technical Architecture Constraints

### Frontend Standards
- **Stack**: React 19 + TypeScript + Tailwind CSS
- **State Management**: React Context for global state (workstation, active batch)
- **API Client**: Type-safe fetch wrappers with error handling
- **PWA**: Service worker for offline capability, manifest.json configured
- **Build**: Vite for development, optimized production builds
- **Testing**: Vitest for unit tests, React Testing Library for components

### Backend Standards
- **Stack**: Rust with Axum framework
- **Database**: SQL Server (configured via .env: DATABASE_SERVER, DATABASE_PORT, DATABASE_NAME)
- **Connection Pool**: tiberius with connection pooling configured
- **API Design**: RESTful endpoints with proper HTTP status codes
- **Error Handling**: Structured error responses with error codes
- **Logging**: Structured JSON logs with correlation IDs

### Integration Standards
- **Scale Bridge**: .NET 8 WebSocket service (configured via .env: BRIDGE_SERVICE_PORT, ENABLE_WEBSOCKETS)
- **Database Access**: Direct SQL queries (no ORM to avoid abstraction leaks)
- **Label Printing**: Windows print spooler integration (System.Drawing)
- **Network**: Services configured via .env (BACKEND_PORT=7075, FRONTEND_PORT=6060, SERVER_HOST=0.0.0.0)

## Development Workflow

### Code Review Requirements
- All PRs must include:
  - Database schema compliance verification
  - FEFO algorithm correctness check
  - Weight tolerance validation tests
  - Audit trail preservation confirmation
  - Type safety verification (no `any` without justification)

### Testing Gates
- **Unit Tests**: All business logic (FEFO, weight validation, phase transitions)
- **Integration Tests**: Database queries against test data matching production patterns
- **E2E Tests**: Critical path (FG selection → picking → label print) on real tablet
- **Performance**: Database queries <100ms, UI updates <200ms

### Deployment Approval
- Successfully tested on actual warehouse workstation (WS1-WS4)
- Label printing verified with physical printer
- Weight scale integration tested with real hardware
- Database backup verified before schema changes
- Rollback plan documented for breaking changes

## Data Quality Standards

### Production Data Verification
- All assumptions must be verified against real data (Runs 213972, 213989, 6000037)
- Field mappings documented: FormulaId → FG Item Key, FormulaDesc → FG Description
- Null handling based on actual data patterns (not assumptions)
- Date formats: YYYYMMDD (integer) for dates, HHMMSS (integer) for times

### Test Data Requirements
- Test data must mirror production patterns (composite keys, lot sequences)
- Include edge cases: expired lots, partial bins, multiple lots per bin
- Weight tolerance test cases: exact match, within tolerance, out of tolerance
- FEFO test cases: multiple lots with varying expiration dates

## Governance

This constitution is the authoritative source for all development decisions:
- All PRs must be verified against these principles before merge
- Deviations require explicit justification and architectural review
- New principles require documentation update and team review
- Breaking changes require migration plan and rollback strategy

Use `.specify/memory/guidance.md` for runtime development guidance and decision-making context.

**Version**: 1.0.0 | **Ratified**: 2025-10-06 | **Last Amended**: 2025-10-06
