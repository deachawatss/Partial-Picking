use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::services::run_service::{
    get_batch_items, get_run_details, BatchItemsResponse, RunDetailsResponse,
};
use axum::{
    extract::{Path, State},
    Json,
};

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
