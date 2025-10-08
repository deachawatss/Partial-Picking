# Architecture Documentation

**Partial Picking System PWA - System Architecture**

Version: 1.0.0 | Last Updated: 2025-10-07

---

## System Overview

The Partial Picking System is a 3-tier Progressive Web Application built with modern technologies for high performance, reliability, and offline capability.

```
┌──────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                       │
│  React 19 PWA (TypeScript + Tailwind CSS v3 + TanStack Query) │
│  - Offline-first architecture (Service Worker)           │
│  - Real-time UI updates (WebSocket + React concurrent)   │
│  - Optimized for 1280x1024 touchscreens                 │
└────────────┬─────────────────────────────────────────────┘
             │ REST API + WebSocket
┌────────────▼─────────────────────────────────────────────┐
│                  APPLICATION LAYER                        │
│  Rust Backend (Axum 0.7)                                 │
│  - JWT authentication (LDAP + SQL fallback)              │
│  - Business logic enforcement (FEFO, weight validation)   │
│  - 4-phase atomic transactions                           │
└────┬───────────────────────────┬─────────────────────────┘
     │ SQL (Tiberius)            │ WebSocket Client
┌────▼──────────────┐   ┌────────▼───────────────────────┐
│   DATA LAYER      │   │  HARDWARE INTEGRATION LAYER    │
│  SQL Server       │   │  .NET 8 Bridge Service         │
│  TFCPILOT3        │   │  - Serial port communication   │
│  (Composite PKs)  │   │  - Weight scale protocol       │
└───────────────────┘   └────────────────────────────────┘
```

---

## Core Architectural Principles

### 1. Constitutional Compliance

All code adheres to 8 constitutional principles:

1. **Contract-First Development**: OpenAPI spec validation
2. **Type Safety**: TypeScript strict + Rust compile-time guarantees
3. **TDD**: Contract tests written first (fail → implement → pass)
4. **Atomic Transactions**: 4-phase picking with rollback
5. **Real-Time Performance**: <200ms WebSocket latency
6. **Security by Default**: JWT, CORS, parameterized queries
7. **Audit Trail**: Never delete metadata (ItemBatchStatus preserved)
8. **No Artificial Keys**: Composite keys (RunNo+RowNum+LineId)

### 2. FEFO Algorithm

**First Expired, First Out** lot selection:

```sql
ORDER BY DateExpiry ASC, Location ASC
```

**Filtering**:
- Location = `'TFC1'`
- User1 = `'WHTFC1'`
- User4 = `'PARTIAL'`
- Available Qty > 0

Result: 511 TFC1 PARTIAL bins only.

### 3. 4-Phase Atomic Transactions

All picking operations execute atomically:

```
Phase 1: Lot Allocation     → Cust_PartialLotPicked INSERT
Phase 2: Weight Update       → cust_PartialPicked UPDATE
Phase 3: Transaction Record  → LotTransaction INSERT
Phase 4: Inventory Commit    → LotMaster QtyCommitSales UPDATE
```

**Rollback**: If any phase fails, all phases roll back.

---

## Technology Stack Details

### Frontend

**React 19 Features**:
- **useTransition**: Non-blocking weight updates
- **Concurrent Rendering**: Smooth UI during data fetching
- **Suspense**: Loading states for code splitting

**State Management**:
- TanStack Query v5 for server state
- React Context for auth state
- LocalStorage for workstation selection

**Offline PWA**:
- Service Worker caches API responses
- IndexedDB for offline data persistence
- Background sync for pending transactions

**UI Framework**:
- Tailwind CSS v3 (utility-first styling)
- ShadCN UI components (accessible, customizable)

### Backend

**Axum 0.7 Architecture**:

```rust
// Router hierarchy
app
  ├── /api/auth       (public)
  ├── /api/runs       (JWT protected)
  ├── /api/picks      (JWT protected)
  ├── /api/lots       (JWT protected)
  └── /api/workstations (JWT protected)

// Middleware stack
- Tower Tracing (request logging)
- Tower CORS (cross-origin)
- JWT validation (custom middleware)
- Error handling (custom middleware)
```

**Database Layer** (Tiberius):
- Connection pooling (2-10 connections)
- Prepared statements (SQL injection prevention)
- Transaction support (4-phase atomicity)

**Authentication**:
1. LDAP bind attempt (ldap3 crate)
2. Fallback to SQL (bcrypt password hash)
3. JWT token generation (jsonwebtoken crate, HS256)

### Bridge Service

**.NET 8 WebSocket Server**:

```csharp
// Weight scale protocol
SerialPort.Open(comPort, baudRate=9600)
  → Read weight data (continuous mode, 100ms interval)
  → Parse weight value + stability flag
  → Broadcast to WebSocket clients
  → Handle reconnection (auto-retry)
```

**Concurrency**: One serial reader per scale, multiple WebSocket clients per scale.

---

## Data Flow Diagrams

### Authentication Flow

```
User → Frontend → POST /api/auth/login
                    ├→ LDAP Bind (ldap://192.168.0.1)
                    │   ✓ Success → Generate JWT
                    │   ✗ Fail → Fallback to SQL
                    └→ SQL Query (bcrypt compare)
                        ✓ Success → Generate JWT
                        ✗ Fail → 401 Unauthorized

JWT Token (168h expiration)
  ↓
Frontend stores in memory (not localStorage - security)
  ↓
All API requests include: Authorization: Bearer <token>
```

### Picking Workflow

```
1. User enters Run No
   → GET /api/runs/{runNo}
   → Auto-populate: FG Item, Description, Batches

2. User selects Batch
   → GET /api/runs/{runNo}/batches/{rowNum}/items
   → Display items with weight ranges

3. User selects Item
   → GET /api/lots/available?itemKey={itemKey}
   → Display FEFO-sorted lots

4. User selects Lot
   → Connect WebSocket: ws://.../ws/scale/{workstation}/{scaleType}
   → Receive real-time weight updates (100ms interval)

5. Weight within tolerance → Enable "Add Lot" button
   → POST /api/picks (4-phase atomic transaction)
   → Update UI: item marked "Allocated"
   → Print item label (4×4")

6. All items picked → Run completion
   → POST /api/runs/{runNo}/complete
   → Assign pallet ID (PT sequence)
   → Print batch summary labels
   → Status: NEW → PRINT
```

### WebSocket Weight Updates

```
Client                     Bridge Service                   Scale
  │                              │                            │
  ├──── Connect WS ──────────────►                            │
  │                              ├──── Open Serial Port ──────►
  │                              │                            │
  │◄──── continuousStarted ──────┤                            │
  │                              │                            │
  │                              │◄──── Weight Data (100ms) ───┤
  │◄──── weightUpdate ───────────┤                            │
  │     (20.025 KG, stable)      │                            │
  │                              │                            │
  │──── stopContinuous ──────────►                            │
  │                              ├──── Close Serial Port ─────►
  │◄──── Connection Closed ──────┤                            │
```

---

## Database Schema

### Key Tables

**cust_PartialPicked** (Pick Items):
- **PK**: RunNo + RowNum + LineId (composite)
- **Weight Fields**:
  - `ToPickedPartialQty` (target weight)
  - `PickedPartialQty` (actual weight from scale)
  - ❌ `PickedPartialQtyKG` (NEVER USED - always NULL)

**LotMaster** (Inventory):
- **PK**: LotNo + ItemKey + LocationKey + BinNo
- **Commitment**: `QtyCommitSales` (incremented during picking)
- **Available**: `QtyOnHand - QtyCommitSales`

**Cust_PartialRun** (Production Runs):
- **PK**: RunNo + RowNum
- **Status**: NEW → PRINT (one-way transition)

**BINMaster** (Bins):
- **Filter**: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'
- **Count**: 511 bins total

See [data-model.md](../specs/001-i-have-an/data-model.md) for full schema.

---

## Security Architecture

### Authentication

- **Primary**: LDAP (Active Directory) bind
- **Fallback**: SQL bcrypt hash validation
- **Token**: JWT (HS256, 168-hour expiration)

### Authorization

- **Permissions**: Stored in `tbl_user.app_permissions`
- **Validation**: Middleware checks JWT claims

### Data Protection

- **SQL Injection**: Parameterized queries (Tiberius)
- **XSS**: React auto-escaping
- **CORS**: Configured allowed origins only
- **Secrets**: Environment variables (never committed)

### Network Security

- **Internal Network**: 192.168.0.x (not public-facing)
- **HTTPS**: Recommended (not implemented in v1.0)

---

## Performance Optimization

### Frontend

- **Code Splitting**: Lazy-loaded routes
- **Tree Shaking**: Vite production build
- **Bundle Size**: < 500 KB (gzipped)
- **Caching**: Service Worker caches assets

### Backend

- **Connection Pooling**: 2-10 SQL connections
- **Query Optimization**: Indexed joins, FEFO query optimized
- **Response Compression**: Gzip middleware

### WebSocket

- **Polling Interval**: 100ms (configurable)
- **Latency**: < 200ms (requirement)
- **Concurrency**: Multiple clients per scale

---

## Scalability Considerations

### Current Capacity

- **Concurrent Users**: 4 workstations (WS1-WS4)
- **Database Load**: Low (simple CRUD operations)
- **WebSocket Connections**: 8 total (4 WS × 2 scales)

### Future Scaling

**Horizontal Scaling** (if needed):
- Load balancer for multiple backend instances
- Sticky sessions for WebSocket connections
- Database read replicas

**Vertical Scaling** (easier):
- Increase server resources
- Optimize database indexes
- Adjust connection pool size

---

## Deployment Architecture

### Development

```
localhost:6060  → Frontend (Vite dev server)
localhost:7075  → Backend (cargo run)
localhost:5000  → Bridge (dotnet run)
192.168.0.86:49381 → Database (SQL Server)
```

### Production

```
192.168.0.10:6060  → Frontend (IIS static files)
192.168.0.10:7075  → Backend (Windows Service via NSSM)
192.168.0.10:5000  → Bridge (Windows Service)
192.168.0.86:49381 → Database (SQL Server)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide.

---

## Monitoring and Observability

### Logging

**Backend**:
- Structured JSON logs (tracing_subscriber)
- Log levels: ERROR, WARN, INFO, DEBUG, TRACE
- Rotation: Daily, 30-day retention

**Frontend**:
- Browser console (development)
- Error boundary catches React errors
- IIS logs for HTTP requests

**Bridge**:
- Serial port errors logged
- WebSocket connection events

### Metrics (Future)

- API response times (Prometheus)
- Database query times (SQL Server monitoring)
- WebSocket latency (custom metrics)

---

## Disaster Recovery

### Backup Strategy

- **Database**: Nightly SQL Server backups
- **Application**: Version control (Git)
- **Configuration**: .env templates in Git

### Recovery Time Objective (RTO)

- **Backend**: 15 minutes (restore from backup)
- **Frontend**: 5 minutes (re-deploy static files)
- **Database**: 1 hour (restore from backup)

### High Availability

**Current**: Single server (192.168.0.10)

**Future**:
- Load balancer with failover
- Database clustering (SQL Server AlwaysOn)
- Multi-region deployment (if needed)

---

## References

- **OpenAPI Spec**: [specs/001-i-have-an/contracts/openapi.yaml](../specs/001-i-have-an/contracts/openapi.yaml)
- **WebSocket Protocol**: [specs/001-i-have-an/contracts/websocket.md](../specs/001-i-have-an/contracts/websocket.md)
- **Data Model**: [specs/001-i-have-an/data-model.md](../specs/001-i-have-an/data-model.md)
- **API Documentation**: [docs/API.md](./API.md)

---

*Last Updated: 2025-10-07 | Version 1.0.0*
