use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::services::run_service::{
    get_all_run_items, get_batch_items, get_batch_summary, get_run_details, list_runs,
    revert_run_status, BatchItemsResponse, BatchSummaryResponse, RunDetailsResponse,
    RunListResponse,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

/// Query parameters for list_runs endpoint
#[derive(Debug, Deserialize)]
pub struct ListRunsQuery {
    #[serde(default = "default_limit")]
    pub limit: i32,

    #[serde(default = "default_offset")]
    pub offset: i32,

    /// Optional search query to filter runs by RunNo, FormulaId, or FormulaDesc
    pub search: Option<String>,
}

fn default_limit() -> i32 {
    10
}

fn default_offset() -> i32 {
    0
}

/// GET /api/runs
///
/// List all production runs with pagination
///
/// # OpenAPI Contract
/// - operationId: listRuns
/// - Query parameters: limit (default 10, max 100), offset (default 0)
/// - Response 200: RunListResponse with runs array and pagination metadata
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Uses composite keys (RunNo, RowNum) via GROUP BY
/// * ✅ Filters Status IN ('NEW', 'PRINT')
/// * ✅ Pagination with OFFSET/FETCH NEXT (10 per page default)
pub async fn list_runs_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Query(params): Query<ListRunsQuery>,
) -> AppResult<Json<RunListResponse>> {
    tracing::info!(
        user = %claims.username,
        limit = params.limit,
        offset = params.offset,
        "GET /api/runs request"
    );

    // Validate query parameters
    if params.limit < 1 {
        return Err(AppError::ValidationError(
            "Limit must be greater than 0".to_string(),
        ));
    }
    if params.limit > 100 {
        return Err(AppError::ValidationError(
            "Limit cannot exceed 100".to_string(),
        ));
    }
    if params.offset < 0 {
        return Err(AppError::ValidationError(
            "Offset cannot be negative".to_string(),
        ));
    }

    let response = list_runs(&pool, params.limit, params.offset, params.search.as_deref()).await?;

    Ok(Json(response))
}

/// GET /api/runs/:runNo
///
/// Get run details with auto-population fields
///
/// # OpenAPI Contract
/// - operationId: getRunDetails
/// - Path parameter: runNo (integer, minimum 1)
/// - Response 200: RunDetailsResponse
/// - Response 404: NotFoundError (Run No not found)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Uses composite keys (RunNo, RowNum)
/// * ✅ Auto-populates fgItemKey from FormulaId
/// * ✅ Auto-populates fgDescription from FormulaDesc
pub async fn get_run_details_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path(run_no): Path<i32>,
) -> AppResult<Json<RunDetailsResponse>> {
    tracing::info!(
        user = %claims.username,
        run_no = run_no,
        "GET /api/runs/{} request",
        run_no
    );

    // Validate run_no
    if run_no < 1 {
        return Err(AppError::ValidationError(
            "Run number must be greater than 0".to_string(),
        ));
    }

    let response = get_run_details(&pool, run_no).await?;

    Ok(Json(response))
}

/// GET /api/runs/:runNo/batches/:rowNum/items
///
/// Get items for batch with weight range calculation
///
/// # OpenAPI Contract
/// - operationId: getBatchItems
/// - Path parameters: runNo (integer), rowNum (integer)
/// - Response 200: BatchItemsResponse
/// - Response 404: NotFoundError (Batch not found)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Uses composite keys (RunNo, RowNum, LineId)
/// * ✅ Uses PickedPartialQty (NOT PickedPartialQtyKG)
/// * ✅ Weight range = ToPickedPartialQty ± INMAST.User9
pub async fn get_batch_items_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path((run_no, row_num)): Path<(i32, i32)>,
) -> AppResult<Json<BatchItemsResponse>> {
    tracing::info!(
        user = %claims.username,
        run_no = run_no,
        row_num = row_num,
        "GET /api/runs/{}/batches/{}/items request",
        run_no,
        row_num
    );

    // Validate parameters
    if run_no < 1 {
        return Err(AppError::ValidationError(
            "Run number must be greater than 0".to_string(),
        ));
    }
    if row_num < 1 {
        return Err(AppError::ValidationError(
            "Row number must be greater than 0".to_string(),
        ));
    }

    let response = get_batch_items(&pool, run_no, row_num).await?;

    Ok(Json(response))
}

/// GET /api/runs/:runNo/items
///
/// Get ALL items across ALL batches for a run
///
/// Used by ItemSelectionModal to show all unpicked items across all batches
///
/// # OpenAPI Contract
/// - operationId: getAllRunItems
/// - Path parameter: runNo (integer, minimum 1)
/// - Response 200: BatchItemsResponse
/// - Response 404: NotFoundError (Run not found)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Uses composite keys (RunNo, RowNum, LineId)
/// * ✅ Returns all items from all batches
pub async fn get_all_run_items_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path(run_no): Path<i32>,
) -> AppResult<Json<BatchItemsResponse>> {
    tracing::info!(
        user = %claims.username,
        run_no = run_no,
        "GET /api/runs/{}/items request",
        run_no
    );

    // Validate run_no
    if run_no < 1 {
        return Err(AppError::ValidationError(
            "Run number must be greater than 0".to_string(),
        ));
    }

    let response = get_all_run_items(&pool, run_no).await?;

    Ok(Json(response))
}

/// GET /api/runs/:runNo/summary
///
/// Get batch summary data for printing
///
/// Used by the PRINT button to generate batch summary labels (4×4" format)
/// Only returns data when run status is 'PRINT' (all items picked)
///
/// # OpenAPI Contract
/// - operationId: getBatchSummary
/// - Path parameter: runNo (integer, minimum 1)
/// - Response 200: BatchSummaryResponse
/// - Response 404: NotFoundError (Run not found or status not PRINT)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Uses composite keys (RunNo, RowNum, LineId)
/// * ✅ Only returns picked items (PickedPartialQty > 0)
/// * ✅ Filters by Status = 'PRINT'
/// * ✅ Groups items by batch (RowNum)
pub async fn get_batch_summary_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path(run_no): Path<i32>,
) -> AppResult<Json<BatchSummaryResponse>> {
    tracing::info!(
        user = %claims.username,
        run_no = run_no,
        "GET /api/runs/{}/summary request",
        run_no
    );

    // Validate run_no
    if run_no < 1 {
        return Err(AppError::ValidationError(
            "Run number must be greater than 0".to_string(),
        ));
    }

    let response = get_batch_summary(&pool, run_no).await?;

    Ok(Json(response))
}

/// POST /api/runs/:runNo/revert-status
///
/// Revert run status from PRINT to NEW
///
/// Allows users to make changes after run completion.
/// Only succeeds if current status is PRINT.
///
/// # OpenAPI Contract
/// - operationId: revertRunStatus
/// - Path parameter: runNo (integer, minimum 1)
/// - Response 200: RunDetailsResponse with status='NEW'
/// - Response 400: ValidationError (Status not PRINT)
/// - Response 404: NotFoundError (Run not found)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Atomic UPDATE operation
/// * ✅ Preserves audit trail (only changes Status field)
pub async fn revert_run_status_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path(run_no): Path<i32>,
) -> AppResult<Json<RunDetailsResponse>> {
    tracing::info!(
        user = %claims.username,
        run_no = run_no,
        "POST /api/runs/{}/revert-status request",
        run_no
    );

    // Validate run_no
    if run_no < 1 {
        return Err(AppError::ValidationError(
            "Run number must be greater than 0".to_string(),
        ));
    }

    let response = revert_run_status(&pool, run_no).await?;

    Ok(Json(response))
}
