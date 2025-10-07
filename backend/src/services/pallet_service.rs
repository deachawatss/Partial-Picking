use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::sequence_service;
use tiberius::Query;

/// Complete production run and assign pallet ID
///
/// # Workflow
/// 1. Validate all items in run are picked (ItemBatchStatus='Allocated')
/// 2. Get next PT sequence for pallet ID
/// 3. Insert Cust_PartialPalletLotPicked record
/// 4. Update run status from NEW to PRINT
///
/// # Constitutional Requirements
/// - All items MUST be picked before completion
/// - Transaction must be atomic
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
/// * `workstation_id` - Workstation completing the run
///
/// # Returns
/// * `Ok(String)` - Assigned pallet ID (from PT sequence)
/// * `Err(AppError::RunNotComplete)` - Not all items picked
/// * `Err(AppError)` - Database error
pub async fn complete_run(pool: &DbPool, run_no: i32, workstation_id: &str) -> AppResult<String> {
    let mut conn = pool.get().await?;

    // ========================================================================
    // VALIDATION: Check all items are picked
    // ========================================================================
    let validation_sql = r#"
        SELECT
            COUNT(*) AS TotalItems,
            SUM(CASE WHEN ItemBatchStatus = 'Allocated' AND PickedPartialQty > 0 THEN 1 ELSE 0 END) AS PickedItems
        FROM cust_PartialPicked
        WHERE RunNo = @P1
    "#;

    let mut validation_query = Query::new(validation_sql);
    validation_query.bind(run_no);

    let row = validation_query
        .query(&mut *conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| AppError::RecordNotFound(format!("Run {} not found", run_no)))?;

    let total_items: i32 = row.get(0).unwrap_or(0);
    let picked_items: i32 = row.get(1).unwrap_or(0);

    if total_items == 0 {
        return Err(AppError::RecordNotFound(format!(
            "Run {} has no items",
            run_no
        )));
    }

    if picked_items < total_items {
        return Err(AppError::RunNotComplete(format!(
            "Cannot complete run {} - only {}/{} items picked",
            run_no, picked_items, total_items
        )));
    }

    // ========================================================================
    // GET SEQUENCE NUMBER
    // ========================================================================
    let pallet_id = sequence_service::get_next_value(pool, "PT").await?;
    let pallet_id_str = pallet_id.to_string();

    // Start transaction for atomic completion
    let mut conn = pool.get().await?;

    // BEGIN TRANSACTION (SQL-level transaction control)
    if let Err(e) = Query::new("BEGIN TRANSACTION").execute(&mut *conn).await {
        return Err(AppError::TransactionFailed(format!(
            "Failed to begin transaction: {}",
            e
        )));
    }

    // ========================================================================
    // INSERT PALLET RECORD
    // ========================================================================
    // Get run metadata for pallet record
    let run_metadata_sql = r#"
        SELECT TOP 1
            FormulaId,
            FormulaDesc,
            RecDate
        FROM Cust_PartialRun
        WHERE RunNo = @P1
    "#;

    let mut run_metadata_query = Query::new(run_metadata_sql);
    run_metadata_query.bind(run_no);

    // Execute query and consume stream - use ? operator and handle cleanup separately
    // to avoid borrow checker issues with nested match statements
    let run_row_opt = run_metadata_query
        .query(&mut *conn)
        .await
        .map_err(|e| AppError::DatabaseError(format!("Failed to query run metadata: {}", e)))?
        .into_row()
        .await
        .map_err(|e| AppError::DatabaseError(format!("Failed to fetch run metadata: {}", e)))?;

    let run_row = run_row_opt
        .ok_or_else(|| AppError::RecordNotFound(format!("Run {} metadata not found", run_no)))?;

    let formula_id: &str = run_row.get(0).unwrap_or("");
    let formula_desc: &str = run_row.get(1).unwrap_or("");
    let rec_date: Option<chrono::NaiveDateTime> = run_row.get(2);

    // Insert pallet record
    let insert_pallet_sql = r#"
        INSERT INTO Cust_PartialPalletLotPicked (
            PalletID,
            RunNo,
            ItemKey,
            ItemDescription,
            RecUserid,
            RecDate,
            ModifiedBy,
            ModifiedDate,
            Status,
            ProductionDate
        )
        VALUES (
            @P1,
            @P2,
            @P3,
            @P4,
            @P5,
            GETDATE(),
            @P5,
            GETDATE(),
            'PRINT',
            @P6
        )
    "#;

    let mut insert_pallet_query = Query::new(insert_pallet_sql);
    insert_pallet_query.bind(pallet_id_str.as_str());
    insert_pallet_query.bind(run_no);
    insert_pallet_query.bind(formula_id);
    insert_pallet_query.bind(formula_desc);
    insert_pallet_query.bind(workstation_id);
    insert_pallet_query.bind(rec_date);

    if let Err(e) = insert_pallet_query.execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Failed to insert pallet record: {}",
            e
        )));
    }

    // ========================================================================
    // UPDATE RUN STATUS
    // ========================================================================
    let update_run_sql = r#"
        UPDATE Cust_PartialRun
        SET
            Status = 'PRINT',
            ModifiedBy = @P2,
            ModifiedDate = GETDATE()
        WHERE RunNo = @P1
    "#;

    let mut update_run_query = Query::new(update_run_sql);
    update_run_query.bind(run_no);
    update_run_query.bind(workstation_id);

    let rows_affected = match update_run_query.execute(&mut *conn).await {
        Ok(result) => result.rows_affected().first().copied().unwrap_or(0),
        Err(e) => {
            Query::new("ROLLBACK TRANSACTION")
                .execute(&mut *conn)
                .await
                .ok();
            return Err(AppError::TransactionFailed(format!(
                "Failed to update run status: {}",
                e
            )));
        }
    };

    if rows_affected == 0 {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::RecordNotFound(format!(
            "Run {} not found for status update",
            run_no
        )));
    }

    // ========================================================================
    // COMMIT TRANSACTION
    // ========================================================================
    if let Err(e) = Query::new("COMMIT TRANSACTION").execute(&mut *conn).await {
        Query::new("ROLLBACK TRANSACTION")
            .execute(&mut *conn)
            .await
            .ok();
        return Err(AppError::TransactionFailed(format!(
            "Failed to commit run completion: {}",
            e
        )));
    }

    tracing::info!(
        run_no = %run_no,
        pallet_id = %pallet_id_str,
        total_items = %total_items,
        workstation = %workstation_id,
        "Run completed successfully"
    );

    Ok(pallet_id_str)
}
