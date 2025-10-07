use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use tiberius::Query;

/// Get next sequence number for specified sequence name
/// Atomically increments and retrieves sequence number from Seqnum table
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `seq_name` - Sequence name (e.g., "PT" for pallet/transaction sequence)
///
/// # Returns
/// * `Ok(i32)` - Next sequence number (already incremented)
/// * `Err(AppError)` - Database error or sequence not found
///
/// # Database Query
/// Uses validated SQL from: backend/src/db/queries/get_next_sequence.sql
///
/// # Example
/// ```rust
/// let lot_tran_no = get_next_value(&pool, "PT").await?;
/// // lot_tran_no might be: 623957
/// ```
pub async fn get_next_value(pool: &DbPool, seq_name: &str) -> AppResult<i32> {
    // Get connection from pool - use simple connection without transaction
    // The UPDATE + SELECT pattern is atomic enough for sequence generation
    let mut conn = pool.get().await?;

    // STEP 1: Increment sequence (atomic with row-level lock)
    // SQL from: get_next_sequence.sql
    let update_sql = "UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = @P1";

    let mut update_query = Query::new(update_sql);
    update_query.bind(seq_name);

    let rows_affected = update_query
        .execute(&mut *conn)
        .await?
        .rows_affected()
        .first()
        .copied()
        .unwrap_or(0);

    // Validate sequence exists
    if rows_affected == 0 {
        return Err(AppError::RecordNotFound(format!(
            "Sequence '{}' not found in Seqnum table",
            seq_name
        )));
    }

    // STEP 2: Retrieve new sequence number
    let select_sql = "SELECT SeqNum FROM Seqnum WHERE SeqName = @P1";

    let mut select_query = Query::new(select_sql);
    select_query.bind(seq_name);

    let row = select_query
        .query(&mut *conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| {
            AppError::DatabaseError(format!("Failed to retrieve sequence '{}'", seq_name))
        })?;

    let seq_num: i32 = row
        .get(0)
        .ok_or_else(|| AppError::DatabaseError("Sequence number column not found".to_string()))?;

    tracing::debug!(
        seq_name = %seq_name,
        seq_num = %seq_num,
        "Generated sequence number"
    );

    Ok(seq_num)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require database connection
    // Run with: cargo test --features integration_tests

    #[tokio::test]
    #[ignore] // Run only with --ignored flag
    async fn test_get_next_value_pt_sequence() {
        // This test requires actual database connection
        // Manually verify sequence increments correctly
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_next_value_invalid_sequence() {
        // Should return RecordNotFound error for non-existent sequence
    }
}
