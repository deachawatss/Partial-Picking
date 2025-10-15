use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    ItemPickedStatus, LotAllocationData, PendingItemDTO, PendingItemsResponse, PickRequest,
    PickResponse, PickedLotDTO, PickedLotsResponse, ToleranceValidation, UnpickResponse,
};
use crate::services::sequence_service;
use chrono::{DateTime, Utc};
use tiberius::Query;

/// Validate weight is within tolerance range
/// Uses validated SQL from: backend/src/db/queries/weight_tolerance_validation.sql
///
/// # Constitutional Requirement
/// Weight tolerance validation MUST be performed before saving pick
///
/// # Returns
/// * `Ok(ToleranceValidation)` - Tolerance data for validation
/// * `Err(AppError::RecordNotFound)` - Item not found
pub async fn validate_weight_tolerance(
    pool: &DbPool,
    run_no: i32,
    row_num: i32,
    line_id: i32,
    weight: f64,
) -> AppResult<ToleranceValidation> {
    let mut conn = pool.get().await?;

    // SQL from: weight_tolerance_validation.sql
    let sql = r#"
        SELECT
            cpp.ToPickedPartialQty AS TargetWeight,
            cpp.ItemKey,
            cpp.Unit,
            ISNULL(im.User9, 0) AS ToleranceKG,
            (cpp.ToPickedPartialQty - ISNULL(im.User9, 0)) AS WeightRangeLow,
            (cpp.ToPickedPartialQty + ISNULL(im.User9, 0)) AS WeightRangeHigh,
            cpp.PickedPartialQty AS CurrentPickedWeight,
            cpp.ItemBatchStatus,
            im.Desc1 AS ItemDescription
        FROM
            cust_PartialPicked cpp
            INNER JOIN INMAST im ON cpp.ItemKey = im.ItemKey
        WHERE
            cpp.RunNo = @P1
            AND cpp.RowNum = @P2
            AND cpp.LineId = @P3
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);
    query.bind(row_num);
    query.bind(line_id);

    let row = query
        .query(&mut *conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| {
            AppError::RecordNotFound(format!(
                "Item not found for RunNo={}, RowNum={}, LineId={}",
                run_no, row_num, line_id
            ))
        })?;

    // Use try_get::<f64> for SQL Server FLOAT(53) and NUMERIC columns
    // CRITICAL: Direct .get().unwrap_or() fails on NUMERIC types (e.g., INMAST.User9 tolerance)
    let target_weight: f64 = row.try_get::<f64, _>(0).ok().flatten().unwrap_or(0.0);
    let item_key: &str = row.get(1).unwrap_or("");
    let unit: Option<&str> = row.get(2);
    let tolerance_kg: f64 = row.try_get::<f64, _>(3).ok().flatten().unwrap_or(0.0);
    let weight_range_low: f64 = row.try_get::<f64, _>(4).ok().flatten().unwrap_or(0.0);
    let weight_range_high: f64 = row.try_get::<f64, _>(5).ok().flatten().unwrap_or(0.0);
    let current_picked_weight: f64 = row.try_get::<f64, _>(6).ok().flatten().unwrap_or(0.0);
    let item_batch_status: Option<&str> = row.get(7);
    let item_description: Option<&str> = row.get(8);

    let validation = ToleranceValidation {
        target_weight,
        item_key: item_key.to_string(),
        unit: unit.map(|s| s.to_string()),
        tolerance_kg,
        weight_range_low,
        weight_range_high,
        current_picked_weight,
        item_batch_status: item_batch_status.map(|s| s.to_string()),
        item_description: item_description.map(|s| s.to_string()),
    };

    // Check if weight is within tolerance
    if weight < validation.weight_range_low || weight > validation.weight_range_high {
        tracing::warn!(
            item_key = %validation.item_key,
            item_description = ?validation.item_description,
            weight = %weight,
            tolerance_kg = %validation.tolerance_kg,
            range_low = %validation.weight_range_low,
            range_high = %validation.weight_range_high,
            unit = ?validation.unit,
            "Weight validation failed - outside acceptable range"
        );
        return Err(AppError::WeightOutOfTolerance {
            weight,
            low: validation.weight_range_low,
            high: validation.weight_range_high,
        });
    }

    // Log validation warnings if current_picked_weight already exists
    if validation.current_picked_weight > 0.0 {
        tracing::warn!(
            item_key = %validation.item_key,
            current_weight = %validation.current_picked_weight,
            target_weight = %validation.target_weight,
            "Item already has picked weight recorded"
        );
    }

    // Log item batch status if set
    if let Some(ref status) = validation.item_batch_status {
        tracing::debug!(
            item_key = %validation.item_key,
            batch_status = %status,
            "Item batch status check"
        );
    }

    Ok(validation)
}

/// Validate item is not already picked
/// Uses validated SQL from: backend/src/db/queries/item_already_picked.sql
///
/// # Constitutional Requirement
/// Must prevent double-picking of same item
///
/// # Returns
/// * `Ok(ItemPickedStatus)` - Item status information
/// * `Err(AppError::ItemAlreadyPicked)` - Item already picked (PickedPartialQty > 0)
pub async fn validate_item_not_picked(
    pool: &DbPool,
    run_no: i32,
    row_num: i32,
    line_id: i32,
) -> AppResult<ItemPickedStatus> {
    let mut conn = pool.get().await?;

    // SQL from: item_already_picked.sql
    let sql = r#"
        SELECT
            RunNo,
            RowNum,
            LineId,
            ItemKey,
            ToPickedPartialQty AS TargetWeight,
            PickedPartialQty AS ActualWeight,
            ItemBatchStatus,
            PickingDate,
            ModifiedBy AS PickedByWorkstation,
            CASE WHEN PickedPartialQty > 0 THEN 1 ELSE 0 END AS IsPicked,
            CASE WHEN PickedPartialQty = 0 AND ItemBatchStatus = 'Allocated' THEN 1 ELSE 0 END AS WasUnpicked
        FROM
            cust_PartialPicked
        WHERE
            RunNo = @P1
            AND RowNum = @P2
            AND LineId = @P3
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);
    query.bind(row_num);
    query.bind(line_id);

    let row = query
        .query(&mut *conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| {
            AppError::RecordNotFound(format!(
                "Item not found for RunNo={}, RowNum={}, LineId={}",
                run_no, row_num, line_id
            ))
        })?;

    let item_key: &str = row.get(3).unwrap_or("");
    // Use try_get::<f64> for SQL Server FLOAT(53) columns
    let target_weight: f64 = row.try_get::<f64, _>(4).ok().flatten().unwrap_or(0.0);
    let actual_weight: f64 = row.try_get::<f64, _>(5).ok().flatten().unwrap_or(0.0);
    let item_batch_status: Option<&str> = row.get(6);
    // Use try_get for SQL Server DateTime columns that can be NULL
    let picking_date: Option<DateTime<Utc>> = row.try_get(7).ok().flatten();
    let picked_by_workstation: Option<&str> = row.get(8);
    let is_picked: i32 = row.get(9).unwrap_or(0);
    let was_unpicked: i32 = row.get(10).unwrap_or(0);

    let status = ItemPickedStatus {
        run_no,
        row_num,
        line_id,
        item_key: item_key.to_string(),
        target_weight,
        actual_weight,
        item_batch_status: item_batch_status.map(|s| s.to_string()),
        picking_date,
        picked_by_workstation: picked_by_workstation.map(|s| s.to_string()),
        is_picked: is_picked == 1,
        was_unpicked: was_unpicked == 1,
    };

    // Check if item is already picked
    if status.is_picked {
        tracing::error!(
            item_key = %status.item_key,
            run_no = %status.run_no,
            row_num = %status.row_num,
            line_id = %status.line_id,
            actual_weight = %status.actual_weight,
            target_weight = %status.target_weight,
            picked_by = ?status.picked_by_workstation,
            picking_date = ?status.picking_date,
            "Attempted to pick already picked item"
        );
        return Err(AppError::ItemAlreadyPicked(format!(
            "Item {} already picked for RunNo={}, RowNum={}, LineId={}",
            status.item_key, status.run_no, status.row_num, status.line_id
        )));
    }

    // Log if item was previously unpicked
    if status.was_unpicked {
        tracing::info!(
            item_key = %status.item_key,
            run_no = %status.run_no,
            batch_status = ?status.item_batch_status,
            "Item was previously picked and unpicked - re-picking"
        );
    }

    Ok(status)
}

/// Get lot allocation data from LotMaster for Phase 1 and Phase 3
/// Includes receipt/vendor fields for LotTransaction audit trail
async fn get_lot_allocation_data(
    conn: &mut tiberius::Client<tokio_util::compat::Compat<tokio::net::TcpStream>>,
    lot_no: &str,
    item_key: &str,
    bin_no: &str,
) -> AppResult<LotAllocationData> {
    let sql = r#"
        SELECT
            LotNo,
            BinNo,
            ItemKey,
            LocationKey,
            DateReceived,
            DateExpiry,
            ISNULL(DocumentNo, '') AS ReceiptDocNo,
            ISNULL(DocumentLineNo, 0) AS ReceiptDocLineNo,
            ISNULL(VendorKey, '') AS Vendorkey,
            ISNULL(VendorLotNo, '') AS VendorlotNo
        FROM LotMaster
        WHERE LotNo = @P1 AND ItemKey = @P2 AND BinNo = @P3 AND LocationKey = 'TFC1'
    "#;

    let mut query = Query::new(sql);
    query.bind(lot_no);
    query.bind(item_key);
    query.bind(bin_no);

    let row = query.query(conn).await?.into_row().await?.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "Lot {} not found for item {} in bin {}",
            lot_no, item_key, bin_no
        ))
    })?;

    Ok(LotAllocationData {
        lot_no: row.get::<&str, _>(0).unwrap_or("").to_string(),
        bin_no: row.get::<&str, _>(1).unwrap_or("").to_string(),
        item_key: row.get::<&str, _>(2).unwrap_or("").to_string(),
        location_key: row.get::<&str, _>(3).unwrap_or("TFC1").to_string(),
        // CRITICAL: Use .get() without type annotation for datetime columns
        // Tiberius Row::get() returns Option<DateTime<Utc>> automatically
        // try_get::<DateTime<Utc>, _>() fails type conversion and returns None
        date_received: row.get(4),
        date_expiry: row.get(5),
        // Receipt/Vendor fields from LotMaster (for LotTransaction audit trail)
        receipt_doc_no: row.get::<&str, _>(6).unwrap_or("").to_string(),
        receipt_doc_line_no: row.get::<i16, _>(7).unwrap_or(0),  // SQL Server SMALLINT
        vendor_key: row.get::<&str, _>(8).unwrap_or("").to_string(),
        vendor_lot_no: row.get::<&str, _>(9).unwrap_or("").to_string(),
    })
}

/// Get batch number from cust_PartialPicked
async fn get_batch_no(
    conn: &mut tiberius::Client<tokio_util::compat::Compat<tokio::net::TcpStream>>,
    run_no: i32,
    row_num: i32,
) -> AppResult<String> {
    let sql = "SELECT TOP 1 BatchNo FROM cust_PartialPicked WHERE RunNo = @P1 AND RowNum = @P2";

    let mut query = Query::new(sql);
    query.bind(run_no);
    query.bind(row_num);

    let row = query.query(conn).await?.into_row().await?.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "Batch not found for RunNo={}, RowNum={}",
            run_no, row_num
        ))
    })?;

    Ok(row.get::<&str, _>(0).unwrap_or("").to_string())
}

/// Get customer key from PNMAST for Phase 3 LotTransaction audit trail
async fn get_customer_key(
    conn: &mut tiberius::Client<tokio_util::compat::Compat<tokio::net::TcpStream>>,
    batch_no: &str,
) -> AppResult<String> {
    let sql = "SELECT CustKey FROM PNMAST WHERE BatchNo = @P1";

    let mut query = Query::new(sql);
    query.bind(batch_no);

    let row = query.query(conn).await?.into_row().await?.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "Customer key not found for BatchNo={}",
            batch_no
        ))
    })?;

    Ok(row.get::<&str, _>(0).unwrap_or("").to_string())
}

/// Get PackSize from cust_PartialPicked for Phase 1 audit trail
async fn get_pack_size(
    conn: &mut tiberius::Client<tokio_util::compat::Compat<tokio::net::TcpStream>>,
    run_no: i32,
    row_num: i32,
    line_id: i32,
) -> AppResult<f64> {
    let sql = "SELECT PackSize FROM cust_PartialPicked WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3";

    let mut query = Query::new(sql);
    query.bind(run_no);
    query.bind(row_num);
    query.bind(line_id);

    let row = query.query(conn).await?.into_row().await?.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "PackSize not found for RunNo={}, RowNum={}, LineId={}",
            run_no, row_num, line_id
        ))
    })?;

    Ok(row.try_get::<f64, _>(0).ok().flatten().unwrap_or(0.0))
}

/// Execute 4-phase atomic picking transaction
///
/// # Constitutional Requirements
/// 1. All 4 phases MUST execute atomically (all or nothing)
/// 2. Use validated SQL queries from Database Specialist
/// 3. Composite keys (RunNo, RowNum, LineId) in all WHERE clauses
/// 4. Preserve audit trail metadata
///
/// # Phases
/// 1. Lot allocation (INSERT Cust_PartialLotPicked)
/// 2. Weight update (UPDATE cust_PartialPicked)
/// 3. Transaction recording (INSERT LotTransaction)
/// 4. Inventory commitment (UPDATE LotMaster.QtyCommitSales)
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `request` - Pick request with lot, bin, weight, and workstation info
///
/// # Returns
/// * `Ok(PickResponse)` - Successful pick with lot transaction number
/// * `Err(AppError)` - Validation error or transaction failure (rollback performed)
pub async fn save_pick(pool: &DbPool, request: PickRequest) -> AppResult<PickResponse> {
    // PRE-VALIDATION: Weight tolerance
    let tolerance = validate_weight_tolerance(
        pool,
        request.run_no,
        request.row_num,
        request.line_id,
        request.weight,
    )
    .await?;

    // PRE-VALIDATION: Item not already picked
    validate_item_not_picked(pool, request.run_no, request.row_num, request.line_id).await?;

    // Get sequence number for LotTranNo (BEFORE transaction)
    let lot_tran_no = sequence_service::get_next_value(pool, "PT").await?;

    // Get connection for transaction
    let mut conn = pool.get().await?;

    // BEGIN TRANSACTION using simple_query() - Official Tiberius pattern
    // Reference: https://github.com/prisma/tiberius/blob/main/tests/query.rs
    conn.simple_query("BEGIN TRAN")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("BEGIN TRAN failed: {}", e)))?;

    // Get lot allocation data
    let lot_data = match get_lot_allocation_data(
        &mut *conn,
        &request.lot_no,
        &tolerance.item_key,
        &request.bin_no,
    )
    .await
    {
        Ok(data) => data,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(e);
        }
    };

    // Get batch number
    let batch_no = match get_batch_no(&mut *conn, request.run_no, request.row_num).await {
        Ok(batch) => batch,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(e);
        }
    };

    // Get customer key from PNMAST for Phase 3 audit trail
    let cust_key = match get_customer_key(&mut *conn, &batch_no).await {
        Ok(key) => key,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(e);
        }
    };

    // Get PackSize from cust_PartialPicked for Phase 1 audit trail
    let pack_size = match get_pack_size(&mut *conn, request.run_no, request.row_num, request.line_id).await {
        Ok(size) => size,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(e);
        }
    };

    // ========================================================================
    // PHASE 1: LOT ALLOCATION
    // ========================================================================
    // SQL from: phase1_lot_allocation.sql (complete INSERT with all required columns)
    // NOTE: LotTranNo is IDENTITY column (auto-generated), do NOT insert explicitly
    let phase1_sql = r#"
        INSERT INTO Cust_PartialLotPicked (
            RunNo, RowNum, LineId, BatchNo, ItemKey, LotNo, SuggestedLotNo, LocationKey, BinNo,
            DateReceived, DateExpiry, TransactionType, ReceiptDocNo, ReceiptDocLineNo,
            QtyReceived, Vendorkey, VendorlotNo, IssueDocNo, IssueDocLineNo, IssueDate,
            QtyIssued, QtyUsed, AllocLotQty, CustomerKey, RecUserid, RecDate, ModifiedBy, ModifiedDate,
            Processed, TempQty, QtyForLotAssignment, PackSize, QtyOnHand, QtyReceivedKG,
            User1, User2, User3, User4, User5, User7, User8, User9, User10, User11, User12,
            LotStatus, ESG_REASON, ESG_APPROVER
        )
        VALUES (
            @P1, @P2, @P3, @P4, @P5, @P6, @P6, @P7, @P8,
            @P11, @P12, 5, @P13, @P14,
            @P9, @P15, @P16, '', 0, GETDATE(),
            @P9, @P9, @P9, '', @P10, GETDATE(), @P10, GETDATE(),
            'N', 0, 0, @P17, 0, 0,
            NULL, NULL, NULL, NULL, 'Picking Customization', NULL, NULL, NULL, NULL, NULL, NULL,
            'Allocated', NULL, NULL
        )
    "#;

    let mut phase1_query = Query::new(phase1_sql);
    phase1_query.bind(request.run_no); // @P1
    phase1_query.bind(request.row_num); // @P2
    phase1_query.bind(request.line_id); // @P3
    phase1_query.bind(batch_no.as_str()); // @P4
    phase1_query.bind(lot_data.item_key.as_str()); // @P5
    phase1_query.bind(lot_data.lot_no.as_str()); // @P6 (also used for SuggestedLotNo)
    phase1_query.bind(lot_data.location_key.as_str()); // @P7
    phase1_query.bind(lot_data.bin_no.as_str()); // @P8
    phase1_query.bind(request.weight); // @P9 (QtyIssued, QtyUsed, AllocLotQty)
    phase1_query.bind(request.workstation_id.as_str()); // @P10 (RecUserid, ModifiedBy)
    // CRITICAL: Unwrap Option<DateTime> before binding to Tiberius INSERT query
    // DateReceived and DateExpiry are NOT NULL in LotMaster, so unwrap with error handling
    phase1_query.bind(lot_data.date_received.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "DateReceived missing from LotMaster for lot {} item {} bin {}",
            lot_data.lot_no, lot_data.item_key, lot_data.bin_no
        ))
    })?); // @P11
    phase1_query.bind(lot_data.date_expiry.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "DateExpiry missing from LotMaster for lot {} item {} bin {}",
            lot_data.lot_no, lot_data.item_key, lot_data.bin_no
        ))
    })?); // @P12
    phase1_query.bind(lot_data.receipt_doc_no.as_str()); // @P13 (ReceiptDocNo from LotMaster)
    phase1_query.bind(lot_data.receipt_doc_line_no); // @P14 (ReceiptDocLineNo from LotMaster, i16)
    phase1_query.bind(lot_data.vendor_key.as_str()); // @P15 (Vendorkey from LotMaster)
    phase1_query.bind(lot_data.vendor_lot_no.as_str()); // @P16 (VendorlotNo from LotMaster)
    phase1_query.bind(pack_size); // @P17 (PackSize from cust_PartialPicked)

    // Execute Phase 1
    if let Err(e) = phase1_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Phase 1 failed: {}", e)));
    }

    // ========================================================================
    // PHASE 2: WEIGHT UPDATE (with CUSTOM1 audit field)
    // ========================================================================
    // SQL from: phase2_weight_update.sql
    // CUSTOM1 audit trail: 1 (bit TRUE) when manual entry, 0 (bit FALSE) when automatic (scale)
    let custom1_value: u8 = if request.weight_source.to_lowercase() == "manual" {
        1 // Manual = TRUE (bit 1)
    } else {
        0 // Automatic = FALSE (bit 0)
    };

    let phase2_sql = r#"
        UPDATE cust_PartialPicked
        SET
            PickedPartialQty = @P4,
            ItemBatchStatus = 'Allocated',
            PickingDate = GETDATE(),
            ModifiedBy = @P5,
            ModifiedDate = GETDATE(),
            CUSTOM1 = @P6
        WHERE
            RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
    "#;

    let mut phase2_query = Query::new(phase2_sql);
    phase2_query.bind(request.run_no); // @P1
    phase2_query.bind(request.row_num); // @P2
    phase2_query.bind(request.line_id); // @P3
    phase2_query.bind(request.weight); // @P4
    phase2_query.bind(request.workstation_id.as_str()); // @P5
    phase2_query.bind(custom1_value); // @P6 - 0 or 1 (bit)

    // Execute Phase 2
    if let Err(e) = phase2_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Phase 2 failed: {}", e)));
    }

    // ========================================================================
    // PHASE 3: TRANSACTION RECORDING (with audit trail fields)
    // ========================================================================
    // SQL from: phase3_transaction_record.sql
    // CRITICAL: LotTransaction.LotTranNo is IDENTITY column (auto-generated), do NOT insert explicitly
    // Audit trail fields populated from LotMaster and PNMAST:
    // - ReceiptDocNo, ReceiptDocLineNo, Vendorkey, VendorlotNo from LotMaster
    // - CustomerKey from PNMAST.CustKey
    let phase3_sql = r#"
        INSERT INTO LotTransaction (
            LotNo, ItemKey, LocationKey, DateReceived, DateExpiry, TransactionType,
            ReceiptDocNo, ReceiptDocLineNo, QtyReceived, Vendorkey, VendorlotNo, IssueDocNo,
            IssueDocLineNo, IssueDate, QtyIssued, CustomerKey, RecUserid, RecDate, Processed,
            TempQty, QtyForLotAssignment, BinNo, QtyUsed, DateQuarantine,
            User1, User2, User3, User4, User5, User6, User7, User8, User9, User10, User11, User12,
            ESG_REASON, ESG_APPROVER,
            CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5, CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10
        )
        VALUES (
            @P1, @P2, @P3, @P4, @P5, 5, @P11, @P12, 0, @P13, @P14, @P6, @P7, GETDATE(), @P8, @P15,
            @P9, GETDATE(), 'N', 0, 0, @P10, 0, NULL, NULL, NULL, NULL, NULL, 'Picking Customization',
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        )
    "#;

    let mut phase3_query = Query::new(phase3_sql);
    phase3_query.bind(lot_data.lot_no.as_str()); // @P1 - LotNo
    phase3_query.bind(lot_data.item_key.as_str()); // @P2 - ItemKey
    phase3_query.bind(lot_data.location_key.as_str()); // @P3 - LocationKey
    // CRITICAL: Unwrap Option<DateTime> before binding to Tiberius INSERT query
    // DateReceived and DateExpiry are NOT NULL in LotMaster, so unwrap with error handling
    phase3_query.bind(lot_data.date_received.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "DateReceived missing from LotMaster for lot {} item {} bin {}",
            lot_data.lot_no, lot_data.item_key, lot_data.bin_no
        ))
    })?); // @P4 - DateReceived (from LotMaster)
    phase3_query.bind(lot_data.date_expiry.ok_or_else(|| {
        AppError::RecordNotFound(format!(
            "DateExpiry missing from LotMaster for lot {} item {} bin {}",
            lot_data.lot_no, lot_data.item_key, lot_data.bin_no
        ))
    })?); // @P5 - DateExpiry (from LotMaster)
    phase3_query.bind(batch_no.as_str()); // @P6 - IssueDocNo
    phase3_query.bind(request.line_id as i16); // @P7 - IssueDocLineNo
    phase3_query.bind(request.weight); // @P8 - QtyIssued
    phase3_query.bind(request.workstation_id.as_str()); // @P9 - RecUserid
    phase3_query.bind(lot_data.bin_no.as_str()); // @P10 - BinNo
    phase3_query.bind(lot_data.receipt_doc_no.as_str()); // @P11 - ReceiptDocNo (from LotMaster)
    phase3_query.bind(lot_data.receipt_doc_line_no); // @P12 - ReceiptDocLineNo (from LotMaster)
    phase3_query.bind(lot_data.vendor_key.as_str()); // @P13 - Vendorkey (from LotMaster)
    phase3_query.bind(lot_data.vendor_lot_no.as_str()); // @P14 - VendorlotNo (from LotMaster)
    phase3_query.bind(cust_key.as_str()); // @P15 - CustomerKey (from PNMAST)

    // Execute Phase 3
    if let Err(e) = phase3_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Phase 3 failed: {}", e)));
    }

    // ========================================================================
    // PHASE 4: INVENTORY COMMITMENT
    // ========================================================================
    // SQL from: phase4_inventory_commit.sql
    let phase4_sql = r#"
        UPDATE LotMaster
        SET QtyCommitSales = QtyCommitSales + @P5
        WHERE LotNo = @P1 AND ItemKey = @P2 AND LocationKey = @P3 AND BinNo = @P4
    "#;

    let mut phase4_query = Query::new(phase4_sql);
    phase4_query.bind(lot_data.lot_no.as_str()); // @P1
    phase4_query.bind(lot_data.item_key.as_str()); // @P2
    phase4_query.bind(lot_data.location_key.as_str()); // @P3
    phase4_query.bind(lot_data.bin_no.as_str()); // @P4
    phase4_query.bind(request.weight); // @P5

    // Execute Phase 4
    if let Err(e) = phase4_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Phase 4 failed: {}", e)));
    }

    // ========================================================================
    // COMMIT TRANSACTION using simple_query() - Official Tiberius pattern
    // ========================================================================
    conn.simple_query("COMMIT")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("COMMIT failed: {}", e)))?;

    tracing::info!(
        run_no = %request.run_no,
        row_num = %request.row_num,
        line_id = %request.line_id,
        item_key = %tolerance.item_key,
        lot_tran_no = %lot_tran_no,
        weight = %request.weight,
        weight_source = %request.weight_source,
        custom1 = ?custom1_value,
        "Pick saved successfully (4-phase atomic transaction with CUSTOM1 audit)"
    );

    // Build response
    Ok(PickResponse {
        run_no: request.run_no,
        row_num: request.row_num,
        line_id: request.line_id,
        item_key: tolerance.item_key.clone(),
        lot_no: lot_data.lot_no,
        bin_no: lot_data.bin_no,
        picked_qty: request.weight,
        target_qty: tolerance.target_weight,
        status: "Allocated".to_string(),
        picking_date: Utc::now(),
        lot_tran_no,
    })
}

/// Execute unpick workflow atomically (4-phase reversal)
///
/// # Constitutional Requirements
/// 1. Preserve audit trail (ItemBatchStatus, PickingDate, ModifiedBy)
/// 2. Only reset PickedPartialQty to 0
/// 3. All 4 reversal phases MUST execute atomically
///
/// # Reversal Phases
/// 1. Reset weight (UPDATE cust_PartialPicked.PickedPartialQty = 0)
/// 2. Delete lot allocation (DELETE FROM Cust_PartialLotPicked)
/// 3. Delete transaction records (DELETE FROM LotTransaction WHERE IssueDocNo = batch AND IssueDocLineNo = line)
/// 4. Decrement inventory commitment (UPDATE LotMaster.QtyCommitSales)
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
/// * `row_num` - Batch number
/// * `line_id` - Line identifier
/// * `workstation_id` - Workstation performing unpick
///
/// # Returns
/// * `Ok(UnpickResponse)` - Successful unpick
/// * `Err(AppError)` - Transaction failure (rollback performed)
pub async fn unpick_item(
    pool: &DbPool,
    run_no: i32,
    row_num: i32,
    line_id: i32,
    workstation_id: &str,
) -> AppResult<UnpickResponse> {
    // Get connection
    let mut conn = pool.get().await?;

    // Get current picked data before unpicking
    let get_data_sql = r#"
        SELECT ItemKey, PickedPartialQty
        FROM cust_PartialPicked
        WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
    "#;

    let mut get_data_query = Query::new(get_data_sql);
    get_data_query.bind(run_no);
    get_data_query.bind(row_num);
    get_data_query.bind(line_id);

    let row = get_data_query
        .query(&mut *conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| {
            AppError::RecordNotFound(format!(
                "Item not found for RunNo={}, RowNum={}, LineId={}",
                run_no, row_num, line_id
            ))
        })?;

    let item_key: String = row.get::<&str, _>(0).unwrap_or("").to_string();
    // Use try_get::<f64> for SQL Server FLOAT(53) columns
    let picked_qty: f64 = row.try_get::<f64, _>(1).ok().flatten().unwrap_or(0.0);

    // Get lot allocation data to reverse Phase 4
    let get_lot_sql = r#"
        SELECT LotNo, BinNo
        FROM Cust_PartialLotPicked
        WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
    "#;

    let mut get_lot_query = Query::new(get_lot_sql);
    get_lot_query.bind(run_no);
    get_lot_query.bind(row_num);
    get_lot_query.bind(line_id);

    let lot_row = get_lot_query.query(&mut *conn).await?.into_row().await?;

    // BEGIN TRANSACTION using simple_query() - Official Tiberius pattern
    conn.simple_query("BEGIN TRAN")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("BEGIN TRAN failed: {}", e)))?;

    // ========================================================================
    // UNPICK PHASE 1: RESET WEIGHT (Audit Trail Preserved)
    // ========================================================================
    // SQL from: unpick_phase1_reset_weight.sql
    let unpick_phase1_sql = r#"
        UPDATE cust_PartialPicked
        SET
            PickedPartialQty = 0,
            ModifiedBy = @P4,
            ModifiedDate = GETDATE()
        WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
    "#;

    let mut unpick_phase1_query = Query::new(unpick_phase1_sql);
    unpick_phase1_query.bind(run_no);
    unpick_phase1_query.bind(row_num);
    unpick_phase1_query.bind(line_id);
    unpick_phase1_query.bind(workstation_id);

    // Execute Unpick Phase 1
    if let Err(e) = unpick_phase1_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Unpick Phase 1 failed: {}", e)));
    }

    // ========================================================================
    // UNPICK PHASE 2: DELETE LOT ALLOCATION
    // ========================================================================
    // SQL from: unpick_phase2_delete_lot_allocation.sql
    let unpick_phase2_sql =
        "DELETE FROM Cust_PartialLotPicked WHERE RunNo = @P1 AND RowNum = @P2 AND LineId = @P3";

    let mut unpick_phase2_query = Query::new(unpick_phase2_sql);
    unpick_phase2_query.bind(run_no);
    unpick_phase2_query.bind(row_num);
    unpick_phase2_query.bind(line_id);

    // Execute Unpick Phase 2
    if let Err(e) = unpick_phase2_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Unpick Phase 2 failed: {}", e)));
    }

    // ========================================================================
    // UNPICK PHASE 3: DELETE LOT TRANSACTION RECORDS
    // ========================================================================
    // SQL from: unpick_phase3_delete_lot_transaction.sql
    // Production behavior: DELETE LotTransaction records matching IssueDocNo (batch) and IssueDocLineNo (line ID)
    // Reference: PickingFlow.md lines 416-421, 543-554

    // Get batch number for LotTransaction deletion
    let batch_no = match get_batch_no(&mut *conn, run_no, row_num).await {
        Ok(batch) => batch,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(AppError::TransactionFailed(format!("Failed to get batch number for Phase 3: {}", e)));
        }
    };

    let unpick_phase3_sql = r#"
        DELETE FROM LotTransaction
        WHERE IssueDocNo = @P1 AND IssueDocLineNo = @P2
    "#;

    let mut unpick_phase3_query = Query::new(unpick_phase3_sql);
    unpick_phase3_query.bind(batch_no.as_str());
    unpick_phase3_query.bind(line_id as i16);

    // Execute Unpick Phase 3
    if let Err(e) = unpick_phase3_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!("Unpick Phase 3 failed: {}", e)));
    }

    // ========================================================================
    // UNPICK PHASE 4: DECREMENT INVENTORY COMMITMENT
    // ========================================================================
    // SQL from: unpick_phase4_decrement_commit.sql
    if let Some(lot_row) = lot_row {
        let lot_no: String = lot_row.get::<&str, _>(0).unwrap_or("").to_string();
        let bin_no: String = lot_row.get::<&str, _>(1).unwrap_or("").to_string();

        let unpick_phase4_sql = r#"
            UPDATE LotMaster
            SET QtyCommitSales = QtyCommitSales - @P5
            WHERE LotNo = @P1 AND ItemKey = @P2 AND LocationKey = @P3 AND BinNo = @P4
        "#;

        let mut unpick_phase4_query = Query::new(unpick_phase4_sql);
        unpick_phase4_query.bind(lot_no.as_str());
        unpick_phase4_query.bind(item_key.as_str());
        unpick_phase4_query.bind("TFC1");
        unpick_phase4_query.bind(bin_no.as_str());
        unpick_phase4_query.bind(picked_qty);

        // Execute Unpick Phase 4
        if let Err(e) = unpick_phase4_query.execute(&mut *conn).await {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(AppError::TransactionFailed(format!("Unpick Phase 4 failed: {}", e)));
        }
    }

    // COMMIT TRANSACTION using simple_query() - Official Tiberius pattern
    conn.simple_query("COMMIT")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("COMMIT failed: {}", e)))?;

    tracing::info!(
        run_no = %run_no,
        row_num = %row_num,
        line_id = %line_id,
        item_key = %item_key,
        workstation = %workstation_id,
        "Item unpicked successfully (audit trail preserved)"
    );

    Ok(UnpickResponse {
        run_no,
        row_num,
        line_id,
        item_key,
        picked_qty: 0.0,
        status: "Allocated".to_string(), // Preserved for audit
        unpicked_at: Utc::now(),
    })
}

/// Get all picked lots for a run
/// Used in View Lots Modal to display picked items with delete capability
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
///
/// # Returns
/// * `Ok(PickedLotsResponse)` - List of picked lots with run information
/// * `Err(AppError)` - Query error or no data found
pub async fn get_picked_lots_for_run(pool: &DbPool, run_no: i32) -> AppResult<PickedLotsResponse> {
    let mut conn = pool.get().await?;

    // Query to get all picked lots for the run
    // Joins Cust_PartialLotPicked with cust_PartialPicked and LotMaster
    // NOTE: PackSize comes from cpp (cust_PartialPicked) not cplp (Cust_PartialLotPicked)
    // to avoid "Invalid column name" errors on some SQL Server instances
    let sql = r#"
        SELECT
            cplp.LotTranNo,
            cpp.BatchNo,
            cplp.LotNo,
            cplp.ItemKey,
            cplp.LocationKey,
            CONVERT(VARCHAR, lm.DateExpiry, 103) AS DateExp,
            cplp.QtyReceived,
            cplp.BinNo,
            cpp.PackSize,
            cpp.RowNum,
            cpp.LineId,
            cplp.RecDate
        FROM Cust_PartialLotPicked cplp
        INNER JOIN cust_PartialPicked cpp
            ON cplp.RunNo = cpp.RunNo
            AND cplp.RowNum = cpp.RowNum
            AND cplp.LineId = cpp.LineId
        LEFT JOIN LotMaster lm
            ON cplp.LotNo = lm.LotNo
            AND cplp.ItemKey = lm.ItemKey
            AND cplp.LocationKey = lm.LocationKey
            AND cplp.BinNo = lm.BinNo
        WHERE cplp.RunNo = @P1
        ORDER BY cpp.BatchNo, cplp.LotNo
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);

    let stream = query.query(&mut *conn).await?;
    let rows = stream.into_first_result().await?;

    let mut picked_lots = Vec::new();

    for row in rows {
        let lot_tran_no: i32 = row.get(0).unwrap_or(0);
        let batch_no: &str = row.get(1).unwrap_or("");
        let lot_no: &str = row.get(2).unwrap_or("");
        let item_key: &str = row.get(3).unwrap_or("");
        let location_key: &str = row.get(4).unwrap_or("TFC1");
        let date_exp: Option<&str> = row.get(5);
        let qty_received: f64 = row.get::<f64, _>(6).unwrap_or(0.0);
        let bin_no: &str = row.get(7).unwrap_or("");
        let pack_size: f64 = row.get::<f64, _>(8).unwrap_or(0.0);
        let row_num: i32 = row.get(9).unwrap_or(0);
        let line_id: i32 = row.get(10).unwrap_or(0);
        let rec_date: Option<DateTime<Utc>> = row.try_get(11).ok().flatten();

        picked_lots.push(PickedLotDTO {
            lot_tran_no,
            batch_no: batch_no.to_string(),
            lot_no: lot_no.to_string(),
            item_key: item_key.to_string(),
            location_key: location_key.to_string(),
            date_exp: date_exp.map(|s| s.to_string()),
            qty_received,
            bin_no: bin_no.to_string(),
            pack_size,
            row_num,
            line_id,
            rec_date,
        });
    }

    tracing::info!(
        run_no = %run_no,
        lot_count = %picked_lots.len(),
        "Fetched picked lots for run"
    );

    Ok(PickedLotsResponse {
        picked_lots,
        run_no,
    })
}

/// Get all pending (unpicked or partially picked) items for a run
/// Used in View Lots Modal - Pending Tab
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
///
/// # Returns
/// * `Ok(PendingItemsResponse)` - List of pending items where PickedPartialQty < ToPickedPartialQty
/// * `Err(AppError)` - Query error
pub async fn get_pending_items_for_run(
    pool: &DbPool,
    run_no: i32,
) -> AppResult<PendingItemsResponse> {
    let mut conn = pool.get().await?;

    // Query cust_PartialPicked for items not yet picked
    // Items where PickedPartialQty = 0 (no weight entered yet)
    // Logic: Any weight within valid range = completely picked (matches table "Picked" definition)
    // ORDER BY matches Batch table sorting: largest quantities first (efficient picking), then newer batches
    let sql = r#"
        SELECT
            BatchNo,
            ItemKey,
            ToPickedPartialQty,
            RowNum,
            LineId
        FROM cust_PartialPicked
        WHERE RunNo = @P1
          AND PickedPartialQty = 0
        ORDER BY ToPickedPartialQty DESC, BatchNo DESC
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);

    let stream = query.query(&mut *conn).await?;
    let rows = stream.into_first_result().await?;

    let mut pending_items = Vec::new();

    for row in rows {
        let batch_no: &str = row.get(0).unwrap_or("");
        let item_key: &str = row.get(1).unwrap_or("");
        // Use f64 for SQL Server FLOAT(53) - CRITICAL: f32 causes type mismatch returning 0.0
        let to_picked_qty: f64 = row.try_get::<f64, _>(2).ok().flatten().unwrap_or(0.0);
        let row_num: i32 = row.get(3).unwrap_or(0);
        let line_id: i32 = row.get(4).unwrap_or(0);

        pending_items.push(PendingItemDTO {
            batch_no: batch_no.to_string(),
            item_key: item_key.to_string(),
            to_picked_qty,
            row_num,
            line_id,
        });
    }

    tracing::info!(
        run_no = %run_no,
        pending_count = %pending_items.len(),
        "Fetched pending items for run"
    );

    Ok(PendingItemsResponse {
        pending_items,
        run_no,
    })
}
