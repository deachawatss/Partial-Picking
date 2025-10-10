use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tiberius::{Query, Row};

/// Run list response matching OpenAPI RunListResponse schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunListResponse {
    pub runs: Vec<RunListItemDTO>,
    pub pagination: PaginationDTO,
}

/// Run list item matching OpenAPI RunListItemDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunListItemDTO {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "formulaId")]
    pub formula_id: String,

    #[serde(rename = "formulaDesc")]
    pub formula_desc: String,

    pub status: String, // NEW | PRINT

    #[serde(rename = "batchCount")]
    pub batch_count: i32,
}

/// Pagination metadata matching OpenAPI PaginationDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationDTO {
    pub total: i32,
    pub limit: i32,
    pub offset: i32,

    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

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
    pub production_date: String, // DD/MM/YYYY format (e.g., "10/10/2025")

    pub status: String, // NEW | PRINT

    #[serde(rename = "noOfBatches")]
    pub no_of_batches: i32,
}

/// Batch item matching OpenAPI BatchItemDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemDTO {
    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "batchNo")]
    pub batch_no: String,

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

    #[serde(rename = "totalAvailableSOH")]
    pub total_available_soh: f64,
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
    // Production date is always today (DD/MM/YYYY format)
    let production_date: DateTime<Utc> = Utc::now();
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
        production_date: production_date.format("%d/%m/%Y").to_string(),
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
    // CRITICAL: Use INLOC for SOH (not LotMaster) to match Angular reference app
    let sql = r#"
        SELECT
            p.RunNo,
            p.RowNum,
            p.LineId,
            p.BatchNo,
            p.ItemKey,
            i.Desc1 AS ItemDescription,
            p.ToPickedPartialQty,
            p.PickedPartialQty,
            p.ItemBatchStatus,
            p.Allergen,
            ISNULL(i.User9, 0) AS Tolerance,
            (p.ToPickedPartialQty - ISNULL(i.User9, 0)) AS WeightRangeLow,
            (p.ToPickedPartialQty + ISNULL(i.User9, 0)) AS WeightRangeHigh,
            (p.ToPickedPartialQty - p.PickedPartialQty) AS RemainingQty,
            ISNULL(
                (SELECT loc.Qtyonhand
                 FROM INLOC loc
                 WHERE loc.Itemkey = p.ItemKey AND loc.Location = 'TFC1'
                ), 0
            ) AS TotalAvailableSOH
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
            let batch_no: &str = row.get("BatchNo").unwrap_or("");
            let description: &str = row.get("ItemDescription").unwrap_or("");
            // CRITICAL: SQL Server FLOAT(53) = 8-byte double, must use try_get::<f64>
            // Using try_get::<f32> on FLOAT(53) columns causes type mismatch → returns None → displays 0.0
            let total_needed: f64 = row.try_get::<f64, _>("ToPickedPartialQty")
                .ok().flatten().unwrap_or(0.0);
            let picked_qty: f64 = row.try_get::<f64, _>("PickedPartialQty")
                .ok().flatten().unwrap_or(0.0);
            let remaining_qty: f64 = row.try_get::<f64, _>("RemainingQty")
                .ok().flatten().unwrap_or(0.0);
            let tolerance: f64 = row.try_get::<f64, _>("Tolerance")
                .ok().flatten().unwrap_or(0.0);
            let weight_low: f64 = row.try_get::<f64, _>("WeightRangeLow")
                .ok().flatten().unwrap_or(0.0);
            let weight_high: f64 = row.try_get::<f64, _>("WeightRangeHigh")
                .ok().flatten().unwrap_or(0.0);
            let allergen: &str = row.get("Allergen").unwrap_or("");
            let status: Option<&str> = row.get("ItemBatchStatus");
            let total_available_soh: f64 = row.try_get::<f64, _>("TotalAvailableSOH")
                .ok().flatten().unwrap_or(0.0);

            BatchItemDTO {
                item_key: item_key.to_string(),
                batch_no: batch_no.to_string(),
                description: description.to_string(),
                total_needed,
                picked_qty,
                remaining_qty,
                weight_range_low: weight_low,
                weight_range_high: weight_high,
                tolerance_kg: tolerance,
                allergen: allergen.to_string(),
                status: status.map(|s| s.to_string()),
                total_available_soh,
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

/// List all production runs with pagination and optional search
///
/// Uses validated SQL from PRD: Section 7.11A - Run Search Modal
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `limit` - Records per page (default 10, max 100)
/// * `offset` - Records to skip (default 0)
/// * `search` - Optional search query for filtering by RunNo, FormulaId, or FormulaDesc
///
/// # Returns
/// * RunListResponse with runs array and pagination metadata
///
/// # Constitutional Compliance
/// * ✅ Uses composite keys (RunNo, RowNum) via GROUP BY
/// * ✅ Filters Status IN ('NEW', 'PRINT')
/// * ✅ FEFO-friendly ordering (RunNo DESC - newest first)
/// * ✅ Pagination with OFFSET/FETCH NEXT
/// * ✅ Performance-optimized LIKE searches (prefix for RunNo, contains for text fields)
pub async fn list_runs(pool: &DbPool, limit: i32, offset: i32, search: Option<&str>) -> AppResult<RunListResponse> {
    let mut conn = pool.get().await?;

    // Validate limit (1-100)
    let limit = limit.clamp(1, 100);
    let offset = offset.max(0);

    // SQL from PRD Section 7.11A: Run Search Modal with optional search filtering
    // Get total count first
    let count_sql = if search.is_some() {
        r#"
        SELECT COUNT(DISTINCT RunNo) as TotalCount
        FROM Cust_PartialRun
        WHERE Status IN ('NEW', 'PRINT')
          AND (
            CAST(RunNo AS VARCHAR) LIKE @P1 + '%'
            OR FormulaId LIKE '%' + @P1 + '%'
            OR FormulaDesc LIKE '%' + @P1 + '%'
          )
        "#
    } else {
        r#"
        SELECT COUNT(DISTINCT RunNo) as TotalCount
        FROM Cust_PartialRun
        WHERE Status IN ('NEW', 'PRINT')
        "#
    };

    let mut count_query = Query::new(count_sql);
    if let Some(search_term) = search {
        count_query.bind(search_term);
    }

    let count_result = count_query.query(&mut *conn).await?;
    let count_rows: Vec<Row> = count_result.into_first_result().await?;
    let total: i32 = count_rows
        .first()
        .and_then(|row| row.get::<i32, _>("TotalCount"))
        .unwrap_or(0);

    // Get paginated runs with optional search filtering
    let runs_sql = if search.is_some() {
        r#"
        SELECT
            RunNo,
            FormulaId,
            FormulaDesc,
            Status,
            COUNT(*) as BatchCount
        FROM Cust_PartialRun
        WHERE Status IN ('NEW', 'PRINT')
          AND (
            CAST(RunNo AS VARCHAR) LIKE @P1 + '%'
            OR FormulaId LIKE '%' + @P1 + '%'
            OR FormulaDesc LIKE '%' + @P1 + '%'
          )
        GROUP BY RunNo, FormulaId, FormulaDesc, Status
        ORDER BY RunNo DESC
        OFFSET @P2 ROWS FETCH NEXT @P3 ROWS ONLY
        "#
    } else {
        r#"
        SELECT
            RunNo,
            FormulaId,
            FormulaDesc,
            Status,
            COUNT(*) as BatchCount
        FROM Cust_PartialRun
        WHERE Status IN ('NEW', 'PRINT')
        GROUP BY RunNo, FormulaId, FormulaDesc, Status
        ORDER BY RunNo DESC
        OFFSET @P1 ROWS FETCH NEXT @P2 ROWS ONLY
        "#
    };

    let mut query = Query::new(runs_sql);
    if let Some(search_term) = search {
        query.bind(search_term);
        query.bind(offset);
        query.bind(limit);
    } else {
        query.bind(offset);
        query.bind(limit);
    }

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    let runs: Vec<RunListItemDTO> = rows
        .iter()
        .map(|row| {
            let run_no: i32 = row.get("RunNo").unwrap_or(0);
            let formula_id: &str = row.get("FormulaId").unwrap_or("");
            let formula_desc: &str = row.get("FormulaDesc").unwrap_or("");
            let status: &str = row.get("Status").unwrap_or("NEW");
            let batch_count: i32 = row.get("BatchCount").unwrap_or(0);

            RunListItemDTO {
                run_no,
                formula_id: formula_id.to_string(),
                formula_desc: formula_desc.to_string(),
                status: status.to_string(),
                batch_count,
            }
        })
        .collect();

    let has_more = (offset + limit) < total;

    let pagination = PaginationDTO {
        total,
        limit,
        offset,
        has_more,
    };

    tracing::debug!(
        total = total,
        limit = limit,
        offset = offset,
        returned_count = runs.len(),
        has_more = has_more,
        search = ?search,
        "Retrieved run list"
    );

    Ok(RunListResponse { runs, pagination })
}
