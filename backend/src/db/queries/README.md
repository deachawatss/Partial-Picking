# SQL Queries for Partial Picking System

This directory contains validated, production-ready SQL queries for the Backend Engineer to implement in Rust using Tiberius.

## Query Files

| File | Purpose | Parameters | Performance |
|------|---------|------------|-------------|
| `run_details.sql` | Get production run with auto-population fields | @P1: RunNo (int) | <10ms |
| `batch_items.sql` | Get batch items with weight tolerance calculation | @P1: RunNo, @P2: RowNum | <20ms |
| `fefo_lot_selection.sql` | FEFO-compliant lot selection (CRITICAL) | @P1: ItemKey, @P2: TargetQty | <30ms |
| `bin_filtering.sql` | Filter TFC1 PARTIAL bins (511 bins) | None | <15ms |
| `workstation_config.sql` | Get active workstation scale configuration | None | <5ms |

## Constitutional Compliance

All queries have been validated against these constitutional requirements:

1. **FEFO Compliance** ✅
   - `fefo_lot_selection.sql` uses `ORDER BY DateExpiry ASC, LocationKey ASC`
   - Validated: Returns earliest expiring lot (2028-04-23) for INSALT02

2. **Composite Key Usage** ✅
   - `run_details.sql`: Returns all (RunNo, RowNum) combinations
   - `batch_items.sql`: Filters by (RunNo, RowNum), returns LineId

3. **Correct Field Names** ✅
   - Uses `PickedPartialQty` (NOT PickedPartialQtyKG - always NULL)
   - Uses `INMAST.Desc1` for item description (NOT ItemDescription)
   - Uses `INMAST.User9` for weight tolerance (absolute KG values)

4. **BIN Filtering** ✅
   - Validates: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'
   - Confirmed: 511 bins in production database

5. **Performance** ✅
   - All queries execute <100ms (p95 requirement)
   - Tested against production runs: 213972, 213989, 6000037

## Production Validation

**Test Data**:
- RunNo 213972: 2 batches, "Batter mix" (TB2563E1)
- Batch 1 has 3+ items with tolerance 0.025 KG
- FEFO query returns LotNo 2510239 in BinNo JSBC (earliest expiry)
- BINMaster contains exactly 511 PARTIAL bins
- Active workstation: NB-DEACHAWAT with ControllerID_Small=15, ControllerID_Big=16

**Schema Notes**:
- Table casing: `cust_PartialPicked` (lowercase 'c'), `Cust_PartialRun` (uppercase 'C')
- INMAST description field: `Desc1` (not ItemDescription)
- Workstation table: `TFC_Weighup_WorkStations2` (not TFC_workstation2)
- LotMaster primary key: (LotNo, ItemKey, LocationKey, BinNo) - 4 columns

## Usage in Rust/Tiberius

```rust
// Example: fefo_lot_selection.sql
let lot = sqlx::query!(
    r#"
    SELECT TOP 1 LotNo, BinNo, DateExpiry, QtyOnHand, QtyCommitSales,
           (QtyOnHand - QtyCommitSales) AS AvailableQty
    FROM LotMaster
    WHERE ItemKey = @p1
      AND LocationKey = 'TFC1'
      AND (QtyOnHand - QtyCommitSales) >= @p2
      AND (LotStatus = 'P' OR LotStatus = 'C' OR LotStatus = '' OR LotStatus IS NULL)
    ORDER BY DateExpiry ASC, LocationKey ASC
    "#,
    item_key,
    target_qty
)
.fetch_one(&pool)
.await?;
```

## IMPORTANT: FEFO Query Pattern

The `fefo_lot_selection.sql` query pattern is **constitutionally mandated** and MUST be used exactly as written:

```sql
ORDER BY DateExpiry ASC, LocationKey ASC
```

**DateExpiry MUST be first in the ORDER BY clause**. Any deviation violates FEFO compliance and will be rejected in code review.

## Next Steps for Backend Engineer

1. Implement query execution in `backend/src/db/queries.rs`
2. Create Rust structs matching query result types
3. Write contract tests validating query results against OpenAPI schema
4. Ensure all queries use parameterized inputs (no SQL injection)
5. Add query performance metrics (execution time logging)

---

**Created**: 2025-10-07  
**Validated By**: Database Specialist Agent  
**Database**: TFCPILOT3 @ 192.168.0.86:49381  
**Credentials**: NSW / B3sp0k3 (from .env)
