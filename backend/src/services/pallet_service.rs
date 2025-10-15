use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::sequence_service;
use tiberius::Query;

/// Complete production run and assign pallet ID
///
/// # Workflow
/// 1. Validate all items in run are picked (ItemBatchStatus='Allocated')
/// 2. Get next PT sequence for pallet ID
/// 3. DELETE existing pallet records (defensive cleanup for MS Access edits)
/// 4. Insert fresh Cust_PartialPalletLotPicked records
/// 5. Update run status from NEW to PRINT
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

    // BEGIN TRANSACTION using simple_query() - Official Tiberius pattern
    // Reference: https://github.com/prisma/tiberius/blob/main/tests/query.rs
    conn.simple_query("BEGIN TRAN")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("BEGIN TRAN failed: {}", e)))?;

    // ========================================================================
    // CLEANUP: Delete any existing pallet records (defensive programming)
    // ========================================================================
    // This handles edge cases like manual MS Access status edits where
    // Status was changed from PRINT to NEW without deleting pallet records.
    // Ensures pallet records always match current picked items.
    let delete_pallet_sql = r#"
        DELETE FROM Cust_PartialPalletLotPicked
        WHERE RunNo = @P1
    "#;

    let mut delete_pallet_query = Query::new(delete_pallet_sql);
    delete_pallet_query.bind(run_no);

    let delete_result = match delete_pallet_query.execute(&mut *conn).await {
        Ok(result) => result,
        Err(e) => {
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(AppError::TransactionFailed(format!(
                "Failed to delete existing pallet records: {}",
                e
            )));
        }
    };

    let deleted_rows = delete_result.rows_affected()[0];
    if deleted_rows > 0 {
        tracing::info!(
            run_no = run_no,
            deleted_pallet_records = deleted_rows,
            "Deleted existing pallet records before re-completion (likely manual status edit)"
        );
    }

    // ========================================================================
    // INSERT PALLET RECORDS (one per item)
    // ========================================================================
    // Bulk INSERT from cust_PartialPicked
    // Schema: Primary key (RunNo, RowNum, LineId)
    // Production pattern: All User/CUSTOM/ESG fields are NULL (verified from run 6000028)
    let insert_pallet_sql = r#"
        INSERT INTO Cust_PartialPalletLotPicked (
            RunNo, RowNum, BatchNo, LineId, PalletID,
            RecUserid, RecDate, ModifiedBy, ModifiedDate,
            User1, User2, User3, User4, User5, User6, User7, User8, User9, User10, User11, User12,
            CUSTOM1, CUSTOM2, CUSTOM3, CUSTOM4, CUSTOM5, CUSTOM6, CUSTOM7, CUSTOM8, CUSTOM9, CUSTOM10,
            ESG_REASON, ESG_APPROVER
        )
        SELECT
            cpp.RunNo, cpp.RowNum, cpp.BatchNo, cpp.LineId, @P1,
            @P2, GETDATE(), '', GETDATE(),
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
            NULL, NULL
        FROM cust_PartialPicked cpp
        WHERE cpp.RunNo = @P3
    "#;

    let mut insert_pallet_query = Query::new(insert_pallet_sql);
    insert_pallet_query.bind(pallet_id_str.as_str()); // @P1 - PalletID
    insert_pallet_query.bind(workstation_id); // @P2 - RecUserid
    insert_pallet_query.bind(run_no); // @P3 - RunNo filter

    if let Err(e) = insert_pallet_query.execute(&mut *conn).await {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::TransactionFailed(format!(
            "Failed to insert pallet records: {}",
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
            let _ = conn.simple_query("ROLLBACK").await;
            return Err(AppError::TransactionFailed(format!(
                "Failed to update run status: {}",
                e
            )));
        }
    };

    if rows_affected == 0 {
        let _ = conn.simple_query("ROLLBACK").await;
        return Err(AppError::RecordNotFound(format!(
            "Run {} not found for status update",
            run_no
        )));
    }

    // ========================================================================
    // COMMIT TRANSACTION using simple_query() - Official Tiberius pattern
    // ========================================================================
    conn.simple_query("COMMIT")
        .await
        .map_err(|e| AppError::TransactionFailed(format!("COMMIT failed: {}", e)))?;

    tracing::info!(
        run_no = %run_no,
        pallet_id = %pallet_id_str,
        total_items = %total_items,
        workstation = %workstation_id,
        "Run completed successfully - cleaned up existing pallet records (if any) and created fresh records with status PRINT"
    );

    Ok(pallet_id_str)
}
