# API Documentation

**Partial Picking System PWA - REST API Reference**

Version: 1.0.0 | Last Updated: 2025-10-07

---

## Table of Contents

1. [Overview](#overview)
2. [Base URLs](#base-urls)
3. [Authentication](#authentication)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Production Runs](#production-run-endpoints)
   - [Picking Operations](#picking-endpoints)
   - [Lot Management](#lot-management-endpoints)
   - [Bin Management](#bin-management-endpoints)
   - [Sequences](#sequence-endpoints)
   - [Workstations](#workstation-endpoints)
7. [WebSocket Protocol](#websocket-protocol)
8. [Data Types](#data-types)
9. [Examples](#examples)

---

## Overview

The Partial Picking System API provides RESTful endpoints for warehouse picking operations with real-time weight integration, FEFO lot selection, and 4-phase atomic transactions.

**Key Features**:
- Dual authentication (LDAP + SQL fallback)
- JWT bearer token authentication (168-hour expiration)
- Real-time weight scale integration via WebSocket
- FEFO (First Expired, First Out) lot selection
- 4-phase atomic picking transactions
- TFC1 PARTIAL bin filtering (511 bins)
- Audit trail preservation

**Database**: SQL Server TFCPILOT3 @ 192.168.0.86:49381

**OpenAPI Specification**: [specs/001-i-have-an/contracts/openapi.yaml](../specs/001-i-have-an/contracts/openapi.yaml)

---

## Base URLs

### Development
```
http://localhost:7075/api
```

### Production
```
http://192.168.0.10:7075/api
```

### WebSocket Bridge (Weight Scales)
```
ws://localhost:5000        (Development)
ws://192.168.0.10:5000     (Production)
```

---

## Authentication

### Authentication Flow

The API uses JWT (JSON Web Token) bearer authentication with dual authentication support:

1. **LDAP Authentication** (Primary)
   - Authenticates against Active Directory (LDAP_URL from .env)
   - Returns JWT token on success

2. **SQL Authentication** (Fallback)
   - If LDAP fails/unreachable, validates against `tbl_user` table
   - Compares bcrypt hash of password
   - Returns JWT token on success

### Authentication Header

All protected endpoints require the `Authorization` header:

```http
Authorization: Bearer <jwt-token>
```

### Token Properties

- **Expiration**: 168 hours (7 days)
- **Algorithm**: HS256
- **Issuer**: NWFTH-PartialPicking
- **Claims**: userid, username, authSource, permissions

### Example Token Payload

```json
{
  "userid": 42,
  "username": "dechawat",
  "authSource": "LDAP",
  "permissions": ["putaway", "picking", "partial-picking"],
  "exp": 1730000000,
  "iat": 1729500000,
  "iss": "NWFTH-PartialPicking"
}
```

---

## Error Handling

All API errors follow a consistent error response format:

### Error Response Structure

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Error code (AUTH_*, DB_*, VALIDATION_*, BUSINESS_*, HARDWARE_*)
    message: string;        // User-friendly error message
    correlationId: string;  // Unique ID for troubleshooting
    details?: object;       // Optional additional context
  }
}
```

### Error Codes

| Code Prefix | Category | Example |
|-------------|----------|---------|
| `AUTH_*` | Authentication | `AUTH_INVALID_TOKEN`, `AUTH_LDAP_FAILED` |
| `DB_*` | Database | `DB_RECORD_NOT_FOUND`, `DB_TRANSACTION_FAILED` |
| `VALIDATION_*` | Input Validation | `VALIDATION_WEIGHT_OUT_OF_TOLERANCE` |
| `BUSINESS_*` | Business Logic | `BUSINESS_ITEM_ALREADY_PICKED` |
| `HARDWARE_*` | Hardware | `HARDWARE_SCALE_UNREACHABLE` |

### HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | Resource retrieved successfully |
| 201 | Created | Pick saved successfully |
| 400 | Bad Request | Weight out of tolerance |
| 401 | Unauthorized | Invalid or expired JWT token |
| 404 | Not Found | Run No not found |
| 500 | Internal Server Error | Database transaction failed |

### Example Error Responses

**Weight Out of Tolerance**:
```json
{
  "error": {
    "code": "VALIDATION_WEIGHT_OUT_OF_TOLERANCE",
    "message": "Weight 20.5 is outside acceptable range (19.975 - 20.025 KG)",
    "correlationId": "abc123-xyz789",
    "details": {
      "weight": 20.5,
      "targetQty": 20.0,
      "toleranceKG": 0.025,
      "weightRangeLow": 19.975,
      "weightRangeHigh": 20.025
    }
  }
}
```

**Item Already Picked**:
```json
{
  "error": {
    "code": "BUSINESS_ITEM_ALREADY_PICKED",
    "message": "Item INSALT02 already picked for this batch",
    "correlationId": "def456-uvw012",
    "details": {
      "itemKey": "INSALT02",
      "currentStatus": "Allocated",
      "pickingDate": "2025-10-06T09:30:00Z"
    }
  }
}
```

---

## Rate Limiting

**Current Implementation**: No rate limiting (trusted internal network)

**Production Recommendation**: Implement rate limiting for public-facing deployments:
- 100 requests per minute per IP
- 1000 requests per hour per user

---

## API Endpoints

## Authentication Endpoints

### POST /auth/login

Authenticate user with LDAP or SQL credentials.

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "username": "dechawat",
  "password": "P@ssw0rd123"
}
```

**Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userid": 42,
    "username": "dechawat",
    "firstName": "Dechawat",
    "lastName": "Wongsirasawat",
    "department": "Warehouse",
    "authSource": "LDAP",
    "permissions": ["putaway", "picking", "partial-picking"]
  }
}
```

**Errors**:
- `401 AUTH_INVALID_CREDENTIALS`: Invalid username or password
- `500 AUTH_LDAP_FAILED`: LDAP service unreachable

---

### POST /auth/refresh

Refresh an existing JWT token before expiration.

**Authentication**: Required (JWT bearer token)

**Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### GET /auth/me

Get current authenticated user details.

**Authentication**: Required

**Response (200 OK)**:
```json
{
  "userid": 42,
  "username": "dechawat",
  "firstName": "Dechawat",
  "lastName": "Wongsirasawat",
  "department": "Warehouse",
  "authSource": "LDAP",
  "permissions": ["putaway", "picking", "partial-picking"]
}
```

---

## Production Run Endpoints

### GET /runs

List all production runs with pagination (for Run Search Modal).

**Authentication**: Required

**Query Parameters**:
- `limit` (optional, integer, default 10): Number of records per page
- `offset` (optional, integer, default 0): Number of records to skip

**Response (200 OK)**:
```json
{
  "runs": [
    {
      "runNo": 6000037,
      "formulaId": "TSM2285A",
      "formulaDesc": "Marinade, Savory",
      "status": "NEW",
      "batchCount": 2
    },
    {
      "runNo": 213989,
      "formulaId": "TB44122B",
      "formulaDesc": "Battermix",
      "status": "PRINT",
      "batchCount": 4
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**Fields**:
- `runNo`: Production run number
- `formulaId`: FG Item Key (Formula ID)
- `formulaDesc`: FG Description (Formula Description)
- `status`: Run status (`NEW` or `PRINT`)
- `batchCount`: Total number of batches (COUNT(*) GROUP BY)
- `pagination.total`: Total number of runs matching filter
- `pagination.hasMore`: Whether more records exist

**Filters**:
- Only returns runs with Status IN ('NEW', 'PRINT')
- Ordered by RunNo DESC (newest first)

**SQL Query**:
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
OFFSET @offset ROWS FETCH NEXT 10 ROWS ONLY
```

**Example Request**:
```bash
# Get first page (10 runs)
curl "http://localhost:7075/api/runs?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Get second page
curl "http://localhost:7075/api/runs?limit=10&offset=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### GET /runs/{runNo}

Get production run details for UI auto-population.

**Authentication**: Required

**Path Parameters**:
- `runNo` (integer): Production run number (e.g., 6000037)

**Response (200 OK)**:
```json
{
  "runNo": 6000037,
  "fgItemKey": "TSM2285A",
  "fgDescription": "Marinade, Savory",
  "batches": [1, 2],
  "productionDate": "2025-10-06",
  "status": "NEW",
  "noOfBatches": 2
}
```

**Fields**:
- `fgItemKey`: FG Item Key (from `Cust_PartialRun.FormulaId`)
- `fgDescription`: FG Description (from `Cust_PartialRun.FormulaDesc`)
- `batches`: Array of all `RowNum` values (batch numbers)
- `productionDate`: Production date (from `RecDate`)
- `status`: Run status (`NEW` or `PRINT`)
- `noOfBatches`: Total batches count

**Errors**:
- `404 DB_RECORD_NOT_FOUND`: Run No not found

---

### GET /runs/{runNo}/batches/{rowNum}/items

Get items for a specific batch with weight ranges.

**Authentication**: Required

**Path Parameters**:
- `runNo` (integer): Production run number
- `rowNum` (integer): Batch number (1-indexed)

**Response (200 OK)**:
```json
{
  "items": [
    {
      "itemKey": "INRICF05",
      "description": "Rice Flour (RF-0010)",
      "totalNeeded": 14.24,
      "pickedQty": 0,
      "remainingQty": 14.24,
      "weightRangeLow": 14.215,
      "weightRangeHigh": 14.265,
      "toleranceKG": 0.025,
      "allergen": "",
      "status": null
    },
    {
      "itemKey": "INSALT02",
      "description": "Salt Medium without anticaking",
      "totalNeeded": 20.00,
      "pickedQty": 20.025,
      "remainingQty": 0,
      "weightRangeLow": 19.975,
      "weightRangeHigh": 20.025,
      "toleranceKG": 0.025,
      "allergen": "",
      "status": "Allocated"
    }
  ]
}
```

**Weight Range Calculation**:
- `weightRangeLow` = `totalNeeded - INMAST.User9`
- `weightRangeHigh` = `totalNeeded + INMAST.User9`
- `remainingQty` = `totalNeeded - pickedQty`

**Status Values**:
- `null`: Unpicked (never picked before)
- `"Allocated"`: Picked (PickedPartialQty > 0)

---

### POST /runs/{runNo}/complete

Complete production run and assign pallet ID.

**Authentication**: Required

**Path Parameters**:
- `runNo` (integer): Production run number

**Request Body**:
```json
{
  "workstationId": "WS3"
}
```

**Response (200 OK)**:
```json
{
  "runNo": 213935,
  "palletId": "623524",
  "status": "PRINT",
  "completedAt": "2025-05-29T12:00:04Z"
}
```

**Business Logic**:
1. Verify all items in all batches have `ItemBatchStatus = 'Allocated'`
2. Get next PT sequence number (atomically)
3. Create pallet record (`Cust_PartialPalletLotPicked`)
4. Update run status from `NEW` to `PRINT`
5. Trigger batch summary label printing

**Errors**:
- `400 BUSINESS_RUN_NOT_COMPLETE`: Not all items picked
- `404 DB_RECORD_NOT_FOUND`: Run No not found

---

## Picking Endpoints

### POST /picks

Execute 4-phase atomic picking transaction.

**Authentication**: Required

**Request Body**:
```json
{
  "runNo": 213996,
  "rowNum": 1,
  "lineId": 1,
  "lotNo": "2510403-1",
  "binNo": "PWBB-12",
  "weight": 20.025,
  "workstationId": "WS3"
}
```

**Response (201 Created)**:
```json
{
  "runNo": 213996,
  "rowNum": 1,
  "lineId": 1,
  "itemKey": "INSALT02",
  "lotNo": "2510403-1",
  "binNo": "PWBB-12",
  "pickedQty": 20.025,
  "targetQty": 20.00,
  "status": "Allocated",
  "pickingDate": "2025-10-06T10:15:30Z",
  "lotTranNo": 17282850
}
```

**4-Phase Atomic Transaction**:

**Phase 1**: Lot Allocation
```sql
INSERT INTO Cust_PartialLotPicked (RunNo, RowNum, LineId, LotNo, BinNo, Qty)
VALUES (@RunNo, @RowNum, @LineId, @LotNo, @BinNo, @Weight);
```

**Phase 2**: Weight Update
```sql
UPDATE cust_PartialPicked
SET PickedPartialQty = @Weight,
    ItemBatchStatus = 'Allocated',
    PickingDate = GETDATE(),
    ModifiedBy = @WorkstationId,
    ModifiedDate = GETDATE()
WHERE RunNo = @RunNo AND RowNum = @RowNum AND LineId = @LineId;
```

**Phase 3**: Transaction Recording
```sql
INSERT INTO LotTransaction (
  LotNo, ItemKey, TransactionType, QtyIssued, IssueDocNo, IssueDocLineNo,
  RecUserid, Processed, User5
) VALUES (
  @LotNo, @ItemKey, 5, @Weight, @BatchNo, @LineId,
  @WorkstationId, 'N', 'Picking Customization'
);
```

**Phase 4**: Inventory Commitment
```sql
UPDATE LotMaster
SET QtyCommitSales = QtyCommitSales + @Weight
WHERE LotNo = @LotNo AND ItemKey = @ItemKey AND BinNo = @BinNo;
```

**Validation Rules**:
- Weight must be within tolerance: `abs(weight - targetQty) <= toleranceKG`
- Item cannot already be picked (`ItemBatchStatus` must be `NULL` or unpicked state)
- Lot must have available quantity: `QtyOnHand - QtyCommitSales >= weight`
- Bin must be TFC1 PARTIAL bin

**Errors**:
- `400 VALIDATION_WEIGHT_OUT_OF_TOLERANCE`: Weight outside acceptable range
- `400 BUSINESS_ITEM_ALREADY_PICKED`: Item already picked
- `404 DB_RECORD_NOT_FOUND`: Run/Item not found
- `500 DB_TRANSACTION_FAILED`: Atomic transaction failed (with rollback)

---

### DELETE /picks/{runNo}/{rowNum}/{lineId}

Unpick item (reset weight to 0 while preserving audit trail).

**Authentication**: Required

**Path Parameters**:
- `runNo`, `rowNum`, `lineId`: Composite key

**Request Body**:
```json
{
  "workstationId": "WS3"
}
```

**Response (200 OK)**:
```json
{
  "runNo": 213996,
  "rowNum": 1,
  "lineId": 1,
  "itemKey": "INSALT02",
  "pickedQty": 0,
  "status": "Allocated",
  "unpickedAt": "2025-10-06T10:20:00Z"
}
```

**Unpick Workflow** (Atomic):
1. Reset `PickedPartialQty = 0`
2. Delete `Cust_PartialLotPicked` records
3. Delete `LotTransaction` records
4. Decrement `LotMaster.QtyCommitSales`
5. **PRESERVE**: `ItemBatchStatus`, `PickingDate`, `ModifiedBy`, `ModifiedDate`

**Audit Trail Preservation**: Status remains `'Allocated'` to indicate item was previously picked.

---

## Lot Management Endpoints

### GET /lots/available

Get available lots for item (FEFO sorted, TFC1 PARTIAL bins only).

**Authentication**: Required

**Query Parameters**:
- `itemKey` (required, string): Item SKU (e.g., `INSALT02`)
- `minQty` (optional, number): Minimum available quantity

**Response (200 OK)**:
```json
{
  "lots": [
    {
      "lotNo": "2510403-1",
      "itemKey": "INSALT02",
      "binNo": "PWBB-12",
      "locationKey": "TFC1",
      "qtyOnHand": 4284.73,
      "qtyCommitSales": 3715.81,
      "availableQty": 568.92,
      "expiryDate": "2027-12-16",
      "lotStatus": "P",
      "aisle": "PW",
      "row": "B",
      "rack": "12"
    },
    {
      "lotNo": "2510591-2",
      "itemKey": "INSALT02",
      "binNo": "PWBA-01",
      "locationKey": "TFC1",
      "qtyOnHand": 1250.0,
      "qtyCommitSales": 0,
      "availableQty": 1250.0,
      "expiryDate": "2028-01-05",
      "lotStatus": "P"
    }
  ]
}
```

**FEFO Algorithm** (First Expired, First Out):
```sql
SELECT LotNo, BinNo, DateExpiry, QtyOnHand, QtyCommitSales,
       (QtyOnHand - QtyCommitSales) AS AvailableQty
FROM LotMaster
JOIN BINMaster ON LotMaster.BinNo = BINMaster.BinNo
WHERE ItemKey = @ItemKey
  AND LotMaster.Location = 'TFC1'
  AND BINMaster.User1 = 'WHTFC1'
  AND BINMaster.User4 = 'PARTIAL'
  AND (QtyOnHand - QtyCommitSales) > 0
  AND LotStatus IN ('P', 'C', '', NULL)
ORDER BY DateExpiry ASC, Location ASC;
```

**Filtering**:
- Location = `'TFC1'`
- User1 = `'WHTFC1'`
- User4 = `'PARTIAL'`
- Available Qty > 0
- Lot Status: `'P'` (Pass), `'C'`, `''`, or `NULL` (excludes Hold)

**Sorting**:
1. `DateExpiry ASC` (earliest expiry first)
2. `LocationKey ASC` (secondary sort)

---

## Bin Management Endpoints

### GET /bins

List TFC1 PARTIAL bins (511 bins total).

**Authentication**: Required

**Query Parameters** (optional filters):
- `aisle` (string): Filter by aisle (e.g., `PW`)
- `row` (string): Filter by row (e.g., `B`)
- `rack` (string): Filter by rack (e.g., `12`)

**Response (200 OK)**:
```json
{
  "bins": [
    {
      "location": "TFC1",
      "binNo": "PWBB-12",
      "description": "PW Racking : Replenishment area",
      "aisle": "PW",
      "row": "B",
      "rack": "12",
      "user1": "WHTFC1",
      "user4": "PARTIAL"
    }
  ]
}
```

**Project Scope Filter**:
- Location = `'TFC1'`
- User1 = `'WHTFC1'`
- User4 = `'PARTIAL'`
- **Total**: 511 bins (all other bins excluded)

---

### GET /bins/{location}/{binNo}/contents

> **⚠️ NOT IMPLEMENTED** - This endpoint is documented but not yet implemented in the backend. See backend/src/main.rs for current implementation status.

Get bin contents (lots in bin).

**Authentication**: Required

**Path Parameters**:
- `location` (string, must be `TFC1`)
- `binNo` (string): Bin number

**Response (200 OK)**:
```json
{
  "bin": {
    "location": "TFC1",
    "binNo": "PWBB-12",
    "description": "PW Racking : Replenishment area",
    "aisle": "PW",
    "row": "B",
    "rack": "12"
  },
  "lots": [
    {
      "lotNo": "2510403-1",
      "itemKey": "INSALT02",
      "qtyOnHand": 4284.73,
      "expiryDate": "2027-12-16"
    }
  ]
}
```

---

## Sequence Endpoints

### POST /sequences/{seqName}/next

> **⚠️ NOT IMPLEMENTED** - This endpoint is documented but not yet implemented in the backend. See backend/src/main.rs for current implementation status.

Get and increment sequence number atomically.

**Authentication**: Required

**Path Parameters**:
- `seqName` (enum): Sequence name (currently only `PT` for pallet IDs)

**Response (200 OK)**:
```json
{
  "seqName": "PT",
  "seqNum": 623957
}
```

**Implementation**:
```sql
UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = @SeqName;
SELECT SeqNum FROM Seqnum WHERE SeqName = @SeqName;
```

**Atomicity**: Transaction ensures no duplicate sequence numbers.

---

## Workstation Endpoints

### GET /workstations

List all workstations with scale assignments.

**Authentication**: Required

**Query Parameters**:
- `status` (optional, enum): Filter by status (`Active` or `Inactive`)

**Response (200 OK)**:
```json
{
  "workstations": [
    {
      "workstationId": "WS-001",
      "workstationName": "WS3",
      "smallScaleId": "SCALE-SMALL-01",
      "bigScaleId": "SCALE-BIG-02",
      "status": "Active",
      "smallScale": {
        "scaleId": "SCALE-SMALL-01",
        "scaleType": "SMALL",
        "comPort": "COM3",
        "baudRate": 9600,
        "capacity": 30.0,
        "precision": 0.001,
        "status": "Active"
      },
      "bigScale": {
        "scaleId": "SCALE-BIG-02",
        "scaleType": "BIG",
        "comPort": "COM4",
        "baudRate": 9600,
        "capacity": 300.0,
        "precision": 0.01,
        "status": "Active"
      }
    }
  ]
}
```

---

### GET /workstations/{workstationId}

> **⚠️ NOT IMPLEMENTED** - This endpoint is documented but not yet implemented in the backend. See backend/src/main.rs for current implementation status.

Get workstation details with scale configuration.

**Authentication**: Required

**Path Parameters**:
- `workstationId` (string): Workstation identifier

**Response (200 OK)**: Same structure as individual workstation in list above.

---

## WebSocket Protocol

### Weight Scale WebSocket

**Endpoint**: `ws://<host>:5000/ws/scale/{workstationId}/{scaleType}`

**Parameters**:
- `workstationId`: Workstation identifier (e.g., `WS-001`)
- `scaleType`: Scale type (`small` or `big`)

**Example**: `ws://localhost:5000/ws/scale/WS-001/small`

### Message Types

**Server → Client: Continuous Mode Started**
```json
{
  "type": "continuousStarted",
  "pollingIntervalMs": 100,
  "scaleId": "SCALE-SMALL-01",
  "comPort": "COM3",
  "timestamp": "2025-10-06T10:15:30.125Z"
}
```

**Server → Client: Weight Update**
```json
{
  "type": "weightUpdate",
  "weight": 20.025,
  "unit": "KG",
  "stable": true,
  "scaleId": "SCALE-SMALL-01",
  "scaleType": "SMALL",
  "timestamp": "2025-10-06T10:15:30.225Z"
}
```

**Server → Client: Error**
```json
{
  "type": "error",
  "message": "Serial port COM3 unavailable",
  "scaleId": "SCALE-SMALL-01",
  "timestamp": "2025-10-06T10:15:30.325Z"
}
```

**Client → Server: Stop Continuous Mode**
```json
{
  "type": "stopContinuous"
}
```

### Performance Requirements

- **Latency**: < 200ms from scale read to client update
- **Polling Interval**: 100ms (configurable via `WEIGHT_POLLING_INTERVAL_MS`)
- **Reconnect**: Automatic reconnection on disconnect

See [specs/001-i-have-an/contracts/websocket.md](../specs/001-i-have-an/contracts/websocket.md) for full protocol specification.

---

## Data Types

### Common Types

```typescript
type RunStatus = 'NEW' | 'PRINT';
type ItemBatchStatus = 'Allocated' | null;
type LotStatus = 'P' | 'H' | 'C' | '';
type AuthSource = 'LDAP' | 'LOCAL';
type ScaleType = 'SMALL' | 'BIG';
type WorkstationStatus = 'Active' | 'Inactive';
```

### Timestamp Format

All timestamps use ISO 8601 format with UTC timezone:

```
2025-10-06T10:15:30Z
2025-10-06T10:15:30.125Z  (with milliseconds)
```

### Decimal Precision

All weight/quantity fields use decimal precision:
- **Weight**: Up to 3 decimal places (e.g., `20.025`)
- **Currency**: Not applicable
- **Percentages**: Not applicable

---

## Examples

### Complete Picking Workflow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:7075/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dechawat","password":"TestPassword123"}' \
  | jq -r '.token')

# 2. Get run details (auto-populate UI)
curl http://localhost:7075/api/runs/6000037 \
  -H "Authorization: Bearer $TOKEN"

# 3. Get batch items
curl http://localhost:7075/api/runs/6000037/batches/1/items \
  -H "Authorization: Bearer $TOKEN"

# 4. Get available lots (FEFO sorted)
curl "http://localhost:7075/api/lots/available?itemKey=INSALT02" \
  -H "Authorization: Bearer $TOKEN"

# 5. Connect to weight scale WebSocket
wscat -c ws://localhost:5000/ws/scale/WS-001/small

# 6. Save picked item (4-phase atomic transaction)
curl -X POST http://localhost:7075/api/picks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "runNo": 6000037,
    "rowNum": 1,
    "lineId": 1,
    "lotNo": "2510403-1",
    "binNo": "PWBB-12",
    "weight": 20.025,
    "workstationId": "WS3"
  }'

# 7. Complete run (when all items picked)
curl -X POST http://localhost:7075/api/runs/6000037/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workstationId": "WS3"}'
```

---

## Postman Collection

Import the OpenAPI spec into Postman:

1. Open Postman
2. Import → Link
3. Enter: `file:///path/to/specs/001-i-have-an/contracts/openapi.yaml`
4. Create environment with `baseUrl` variable

---

## Support

**OpenAPI Specification**: [specs/001-i-have-an/contracts/openapi.yaml](../specs/001-i-have-an/contracts/openapi.yaml)
**WebSocket Protocol**: [specs/001-i-have-an/contracts/websocket.md](../specs/001-i-have-an/contracts/websocket.md)
**Data Model**: [specs/001-i-have-an/data-model.md](../specs/001-i-have-an/data-model.md)
**Email**: support@nwfth.com

---

*Last Updated: 2025-10-07 | Version 1.0.0*
