use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    ItemPickedStatus, LotAllocationData, PickRequest, PickResponse, ToleranceValidation,
    UnpickResponse,
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
            im.Description AS ItemDescription
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

    let target_weight: f64 = row.get(0).unwrap_or(0.0);
    let item_key: &str = row.get(1).unwrap_or("");
    let unit: Option<&str> = row.get(2);
    let tolerance_kg: f64 = row.get(3).unwrap_or(0.0);
    let weight_range_low: f64 = row.get(4).unwrap_or(0.0);
    let weight_range_high: f64 = row.get(5).unwrap_or(0.0);
    let current_picked_weight: f64 = row.get(6).unwrap_or(0.0);
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
    if weight < weight_range_low || weight > weight_range_high {
        return Err(AppError::WeightOutOfTolerance {
            weight,
            low: weight_range_low,
            high: weight_range_high,
        });
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
    let target_weight: f64 = row.get(4).unwrap_or(0.0);
    let actual_weight: f64 = row.get(5).unwrap_or(0.0);
    let item_batch_status: Option<&str> = row.get(6);
    let picking_date: Option<DateTime<Utc>> = row.get(7);
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
        return Err(AppError::ItemAlreadyPicked(format!(
            "Item {} already picked for RunNo={}, RowNum={}, LineId={}",
            item_key, run_no, row_num, line_id
        )));
    }

    Ok(status)
}

/// Get lot allocation data from LotMaster for Phase 1 and Phase 3
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
            DateExpiry
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
        date_received: row.get(4),
        date_expiry: row.get(5),
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

    // BEGIN TRANSACTION
    Query::new("BEGIN TRANSACTION")
        .execute(&mut *conn)
        .await
        .map_err(|e| AppError::TransactionFailed(format!("BEGIN TRANSACTION failed: {}", e)))?;

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
            Query::new("ROLLBACK TRANSACTION")
                .execute(&mut *conn)
                .await
                .ok();
            return Err(e);
        }
    };

    // Get batch number
    let batch_no = match get_batch_no(&mut *conn, request.run_no, request.row_num).await {
        Ok(batch) => batch,
        Err(e) => {
            Query::new("ROLLBACK TRANSACTION")
                .execute(&mut *conn)
                .await
                .ok();
            return Err(e);
        }
    };

    // ========================================================================
    // PHASE 1: LOT ALLOCATION
    // ========================================================================
    // SQL from: phase1_lot_allocation.sql
    let phase1_sql = r#"
        INSERT INTO Cust_PartialLotPicked (
            LotTranNo, RunNo, RowNum, LineId, BatchNo, LotNo, SuggestedLotNo, ItemKey,
            LocationKey, DateReceived, DateExpiry, TransactionType, ReceiptDocNo, ReceiptDocLineNo,
            QtyReceived, Vendorkey, VendorlotNo, IssueDocNo, IssueDocLineNo, IssueDate, QtyIssued,
            CustomerKey, RecUserid, RecDate, ModifiedBy, ModifiedDate, Processed, TempQty,
            QtyForLotAssignment, BinNo, QtyUsed, DateQuarantine, PackSize, QtyOnHand,
            User1, User2, User3, User4, User5, User6, User7, User8, User9, User10, User11, User12,
            QtyReceivedKG, AllocLotQty, LotStatus,
            CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5, CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10,
            ESG_REASON, ESG_APPROVER
        )
        VALUES (
            @P1, @P2, @P3, @P4, @P5, @P6, @P6, @P7, @P8, @P10, @P11, 5, '', 0, 0, '', '',
            @P14, @P15, GETDATE(), @P12, '', @P13, GETDATE(), @P13, GETDATE(), 'N', 0, 0, @P9,
            0, NULL, 0, 0, '', '', '', '', '', NULL, 0, 0, 0, 0, 0, 0, 0, @P12, '', 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, '', ''
        )
    "#;

    let mut phase1_query = Query::new(phase1_sql);
    phase1_query.bind(lot_tran_no); // @P1
    phase1_query.bind(request.run_no); // @P2
    phase1_query.bind(request.row_num); // @P3
    phase1_query.bind(request.line_id); // @P4
    phase1_query.bind(batch_no.as_str()); // @P5
    phase1_query.bind(lot_data.lot_no.as_str()); // @P6
    phase1_query.bind(lot_data.item_key.as_str()); // @P7
    phase1_query.bind(lot_data.location_key.as_str()); // @P8
    phase1_query.bind(lot_data.bin_no.as_str()); // @P9
    phase1_query.bind(lot_data.date_received); // @P10
    phase1_query.bind(lot_data.date_expiry); // @P11
    phase1_query.bind(request.weight); // @P12 (QtyIssued)
    phase1_query.bind(request.workstation_id.as_str()); // @P13
    phase1_query.bind(batch_no.as_str()); // @P14 (IssueDocNo)
    phase1_query.bind(request.line_id as i16); // @P15 (IssueDocLineNo)

    if let Err(e) = phase1_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Phase 1 failed: {}",
            e
        )));
    }

    // ========================================================================
    // PHASE 2: WEIGHT UPDATE
    // ========================================================================
    // SQL from: phase2_weight_update.sql
    let phase2_sql = r#"
        UPDATE cust_PartialPicked
        SET
            PickedPartialQty = @P4,
            ItemBatchStatus = 'Allocated',
            PickingDate = GETDATE(),
            ModifiedBy = @P5,
            ModifiedDate = GETDATE()
        WHERE
            RunNo = @P1 AND RowNum = @P2 AND LineId = @P3
    "#;

    let mut phase2_query = Query::new(phase2_sql);
    phase2_query.bind(request.run_no); // @P1
    phase2_query.bind(request.row_num); // @P2
    phase2_query.bind(request.line_id); // @P3
    phase2_query.bind(request.weight); // @P4
    phase2_query.bind(request.workstation_id.as_str()); // @P5

    if let Err(e) = phase2_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Phase 2 failed: {}",
            e
        )));
    }

    // ========================================================================
    // PHASE 3: TRANSACTION RECORDING
    // ========================================================================
    // SQL from: phase3_transaction_record.sql
    let phase3_sql = r#"
        INSERT INTO LotTransaction (
            LotTranNo, LotNo, ItemKey, LocationKey, DateReceived, DateExpiry, TransactionType,
            ReceiptDocNo, ReceiptDocLineNo, QtyReceived, Vendorkey, VendorlotNo, IssueDocNo,
            IssueDocLineNo, IssueDate, QtyIssued, CustomerKey, RecUserid, RecDate, Processed,
            TempQty, QtyForLotAssignment, BinNo, QtyUsed, DateQuarantine,
            User1, User2, User3, User4, User5, User6, User7, User8, User9, User10, User11, User12,
            ESG_REASON, ESG_APPROVER,
            CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5, CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10
        )
        VALUES (
            @P1, @P2, @P3, @P4, NULL, @P6, 5, '', 0, 0, '', '', @P9, @P10, GETDATE(), @P8, '',
            @P11, GETDATE(), 'N', 0, 0, @P7, 0, NULL, '', '', '', '', 'Picking Customization',
            NULL, 0, 0, 0, 0, 0, 0, '', '', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        )
    "#;

    let mut phase3_query = Query::new(phase3_sql);
    phase3_query.bind(lot_tran_no); // @P1
    phase3_query.bind(lot_data.lot_no.as_str()); // @P2
    phase3_query.bind(lot_data.item_key.as_str()); // @P3
    phase3_query.bind(lot_data.location_key.as_str()); // @P4
    phase3_query.bind(lot_data.date_expiry); // @P6
    phase3_query.bind(lot_data.bin_no.as_str()); // @P7
    phase3_query.bind(request.weight); // @P8 (QtyIssued)
    phase3_query.bind(batch_no.as_str()); // @P9 (IssueDocNo)
    phase3_query.bind(request.line_id as i16); // @P10 (IssueDocLineNo)
    phase3_query.bind(request.workstation_id.as_str()); // @P11

    if let Err(e) = phase3_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Phase 3 failed: {}",
            e
        )));
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

    if let Err(e) = phase4_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Phase 4 failed: {}",
            e
        )));
    }

    // ========================================================================
    // COMMIT TRANSACTION
    // ========================================================================
    Query::new("COMMIT TRANSACTION")
        .execute(&mut *conn)
        .await
        .map_err(|e| AppError::TransactionFailed(format!("COMMIT failed: {}", e)))?;

    tracing::info!(
        run_no = %request.run_no,
        row_num = %request.row_num,
        line_id = %request.line_id,
        item_key = %tolerance.item_key,
        lot_tran_no = %lot_tran_no,
        weight = %request.weight,
        "Pick saved successfully (4-phase atomic transaction)"
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
/// 3. SKIP: Do NOT delete from LotTransaction (append-only audit trail)
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
    let picked_qty: f64 = row.get(1).unwrap_or(0.0);

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

    // BEGIN TRANSACTION
    Query::new("BEGIN TRANSACTION")
        .execute(&mut *conn)
        .await
        .map_err(|e| AppError::TransactionFailed(format!("BEGIN TRANSACTION failed: {}", e)))?;

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

    if let Err(e) = unpick_phase1_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Unpick Phase 1 failed: {}",
            e
        )));
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

    if let Err(e) = unpick_phase2_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Unpick Phase 2 failed: {}",
            e
        )));
    }

    // ========================================================================
    // UNPICK PHASE 3: SKIP (Audit Trail Preservation)
    // ========================================================================
    // LotTransaction is append-only - DO NOT DELETE

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

        if let Err(e) = unpick_phase4_query.execute(&mut *conn).await {
            Query::new("ROLLBACK TRANSACTION")
                .execute(&mut *conn)
                .await
                .ok();
            return Err(AppError::TransactionFailed(format!(
                "Unpick Phase 4 failed: {}",
                e
            )));
        }
    }

    // COMMIT TRANSACTION
    Query::new("COMMIT TRANSACTION")
        .execute(&mut *conn)
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
