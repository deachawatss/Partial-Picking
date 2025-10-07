use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tiberius::{Query, Row};

/// Run details response matching OpenAPI RunDetailsResponse schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunDetailsResponse {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "fgItemKey")]
    pub fg_item_key: String,

    #[serde(rename = "fgDescription")]
    pub fg_description: String,

    pub batches: Vec<i32>,

    #[serde(rename = "productionDate")]
    pub production_date: String, // YYYY-MM-DD format

    pub status: String, // NEW | PRINT

    #[serde(rename = "noOfBatches")]
    pub no_of_batches: i32,
}

/// Batch item matching OpenAPI BatchItemDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemDTO {
    #[serde(rename = "itemKey")]
    pub item_key: String,

    pub description: String,

    #[serde(rename = "totalNeeded")]
    pub total_needed: f64,

    #[serde(rename = "pickedQty")]
    pub picked_qty: f64,

    #[serde(rename = "remainingQty")]
    pub remaining_qty: f64,

    #[serde(rename = "weightRangeLow")]
    pub weight_range_low: f64,

    #[serde(rename = "weightRangeHigh")]
    pub weight_range_high: f64,

    #[serde(rename = "toleranceKG")]
    pub tolerance_kg: f64,

    pub allergen: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>, // null | "Allocated"
}

/// Batch items response matching OpenAPI BatchItemsResponse schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemsResponse {
    pub items: Vec<BatchItemDTO>,
}

/// Get run details with auto-population fields
///
/// Uses validated SQL from Database Specialist: run_details.sql
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
///
/// # Returns
/// * RunDetailsResponse with FG Item Key, FG Description, batches array, etc.
/// * 404 if run not found
///
/// # Constitutional Compliance
/// * ✅ Uses composite keys (RunNo, RowNum)
/// * ✅ Auto-populates fgItemKey from FormulaId
/// * ✅ Auto-populates fgDescription from FormulaDesc
/// * ✅ Returns all batches (multiple RowNum values)
pub async fn get_run_details(pool: &DbPool, run_no: i32) -> AppResult<RunDetailsResponse> {
    let mut conn = pool.get().await?;

    // SQL from Database Specialist: run_details.sql
    let sql = r#"
        SELECT
            RunNo,
            RowNum,
            FormulaId,          -- Auto-populate to fgItemKey
            FormulaDesc,        -- Auto-populate to fgDescription
            NoOfBatches,        -- Total batches count
            RecDate,            -- Production date
            Status              -- Run status (NEW|PRINT)
        FROM Cust_PartialRun
        WHERE RunNo = @P1
        ORDER BY RowNum ASC
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    if rows.is_empty() {
        return Err(AppError::RecordNotFound(format!("Run No {}", run_no)));
    }

    // Extract data from first row (shared fields across all batches)
    let first_row = &rows[0];
    let fg_item_key: &str = first_row.get("FormulaId").unwrap_or("");
    let fg_description: &str = first_row.get("FormulaDesc").unwrap_or("");
    let no_of_batches: i32 = first_row.get("NoOfBatches").unwrap_or(0);
    let production_date: DateTime<Utc> = first_row.get("RecDate").unwrap_or(Utc::now());
    let status: &str = first_row.get("Status").unwrap_or("NEW");

    // Collect all batch numbers (RowNum)
    let batches: Vec<i32> = rows
        .iter()
        .filter_map(|row| row.get::<i32, _>("RowNum"))
        .collect();

    tracing::debug!(
        run_no = run_no,
        fg_item_key = fg_item_key,
        batches_count = batches.len(),
        status = status,
        "Retrieved run details"
    );

    Ok(RunDetailsResponse {
        run_no,
        fg_item_key: fg_item_key.to_string(),
        fg_description: fg_description.to_string(),
        batches,
        production_date: production_date.format("%Y-%m-%d").to_string(),
        status: status.to_string(),
        no_of_batches,
    })
}

/// Get batch items with weight range calculation
///
/// Uses validated SQL from Database Specialist: batch_items.sql
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `run_no` - Production run number
/// * `row_num` - Batch number
///
/// # Returns
/// * BatchItemsResponse with all items, calculated weight ranges, remaining qty
/// * 404 if batch not found
///
/// # Constitutional Compliance
/// * ✅ Uses composite keys (RunNo, RowNum, LineId)
/// * ✅ Uses PickedPartialQty (NOT PickedPartialQtyKG which is always NULL)
/// * ✅ JOIN INMAST for description and tolerance (User9)
/// * ✅ Weight range = ToPickedPartialQty ± tolerance
pub async fn get_batch_items(
    pool: &DbPool,
    run_no: i32,
    row_num: i32,
) -> AppResult<BatchItemsResponse> {
    let mut conn = pool.get().await?;

    // SQL from Database Specialist: batch_items.sql
    let sql = r#"
        SELECT
            p.RunNo,
            p.RowNum,
            p.LineId,
            p.ItemKey,
            i.Desc1 AS ItemDescription,
            p.ToPickedPartialQty,
            p.PickedPartialQty,
            p.ItemBatchStatus,
            p.Allergen,
            ISNULL(i.User9, 0) AS Tolerance,
            (p.ToPickedPartialQty - ISNULL(i.User9, 0)) AS WeightRangeLow,
            (p.ToPickedPartialQty + ISNULL(i.User9, 0)) AS WeightRangeHigh,
            (p.ToPickedPartialQty - p.PickedPartialQty) AS RemainingQty
        FROM cust_PartialPicked p
        LEFT JOIN INMAST i ON p.ItemKey = i.Itemkey
        WHERE p.RunNo = @P1
          AND p.RowNum = @P2
        ORDER BY p.LineId ASC
    "#;

    let mut query = Query::new(sql);
    query.bind(run_no);
    query.bind(row_num);

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    if rows.is_empty() {
        return Err(AppError::RecordNotFound(format!(
            "Batch {}/{} not found",
            run_no, row_num
        )));
    }

    let items: Vec<BatchItemDTO> = rows
        .iter()
        .map(|row| {
            let item_key: &str = row.get("ItemKey").unwrap_or("");
            let description: &str = row.get("ItemDescription").unwrap_or("");
            let total_needed: f64 = row.get("ToPickedPartialQty").unwrap_or(0.0);
            let picked_qty: f64 = row.get("PickedPartialQty").unwrap_or(0.0);
            let remaining_qty: f64 = row.get("RemainingQty").unwrap_or(0.0);
            let tolerance: f64 = row.get("Tolerance").unwrap_or(0.0);
            let weight_low: f64 = row.get("WeightRangeLow").unwrap_or(0.0);
            let weight_high: f64 = row.get("WeightRangeHigh").unwrap_or(0.0);
            let allergen: &str = row.get("Allergen").unwrap_or("");
            let status: Option<&str> = row.get("ItemBatchStatus");

            BatchItemDTO {
                item_key: item_key.to_string(),
                description: description.to_string(),
                total_needed,
                picked_qty,
                remaining_qty,
                weight_range_low: weight_low,
                weight_range_high: weight_high,
                tolerance_kg: tolerance,
                allergen: allergen.to_string(),
                status: status.map(|s| s.to_string()),
            }
        })
        .collect();

    tracing::debug!(
        run_no = run_no,
        row_num = row_num,
        items_count = items.len(),
        "Retrieved batch items"
    );

    Ok(BatchItemsResponse { items })
}
