use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{
    PendingItemsResponse, PickRequest, PickResponse, PickedLotsResponse, UnpickResponse,
};
use crate::services::picking_service;

/// POST /api/picks
/// Execute 4-phase atomic picking transaction
///
/// # Request Body
/// - runNo: Production run number
/// - rowNum: Batch number
/// - lineId: Line identifier
/// - lotNo: Selected lot number (from FEFO algorithm)
/// - binNo: Source bin (TFC1 PARTIAL bin)
/// - weight: Actual weight from scale (must be within tolerance)
/// - workstationId: Workstation identifier (e.g., WS3)
///
/// # Response
/// - 201 Created: Pick saved successfully
/// - 400 Bad Request: Weight out of tolerance or item already picked
/// - 404 Not Found: Item not found
/// - 500 Internal Server Error: Transaction failed (rollback performed)
///
/// # Constitutional Compliance
/// - Uses Database Specialist SQL queries verbatim
/// - 4-phase atomic transaction (all or nothing)
/// - Composite keys in all WHERE clauses
/// - Audit trail preservation
pub async fn save_pick_endpoint(
    State(pool): State<DbPool>,
    Json(request): Json<PickRequest>,
) -> AppResult<(StatusCode, Json<PickResponse>)> {
    // Validate request
    if request.weight <= 0.0 {
        return Err(AppError::ValidationError(
            "Weight must be greater than 0".to_string(),
        ));
    }

    if request.lot_no.is_empty() {
        return Err(AppError::ValidationError(
            "Lot number is required".to_string(),
        ));
    }

    if request.bin_no.is_empty() {
        return Err(AppError::ValidationError(
            "Bin number is required".to_string(),
        ));
    }

    if request.workstation_id.is_empty() {
        return Err(AppError::ValidationError(
            "Workstation ID is required".to_string(),
        ));
    }

    // Execute picking service
    let response = picking_service::save_pick(&pool, request).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

/// DELETE /api/picks/:runNo/:rowNum/:lineId
/// Unpick item (reset to 0 while preserving audit trail)
///
/// # Path Parameters
/// - runNo: Production run number
/// - rowNum: Batch number
/// - lineId: Line identifier
///
/// # Request Body
/// - workstationId: Workstation performing unpick
///
/// # Response
/// - 200 OK: Item unpicked successfully
/// - 404 Not Found: Item not found
/// - 500 Internal Server Error: Transaction failed (rollback performed)
///
/// # Audit Trail Preservation (Constitutional Requirement #7)
/// - ItemBatchStatus: Preserved (remains 'Allocated')
/// - PickingDate: Preserved
/// - ModifiedBy: Preserved
/// - Only PickedPartialQty reset to 0
pub async fn unpick_item_endpoint(
    State(pool): State<DbPool>,
    Path((run_no, row_num, line_id)): Path<(i32, i32, i32)>,
    Json(body): Json<serde_json::Value>,
) -> AppResult<Json<UnpickResponse>> {
    // Extract workstation ID from request body
    let workstation_id = body
        .get("workstationId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            AppError::ValidationError("workstationId is required in request body".to_string())
        })?;

    // Execute unpick service
    let response =
        picking_service::unpick_item(&pool, run_no, row_num, line_id, workstation_id).await?;

    Ok(Json(response))
}

/// GET /api/picks/run/:runNo/lots
/// Get all picked lots for a run (for View Lots Modal)
///
/// # Path Parameters
/// - runNo: Production run number
///
/// # Response
/// - 200 OK: List of picked lots with run information
/// - 404 Not Found: Run not found or no picked lots
/// - 500 Internal Server Error: Query failed
///
/// # Returns
/// - pickedLots: Array of PickedLotDTO
/// - runNo: Production run number
pub async fn get_picked_lots_endpoint(
    State(pool): State<DbPool>,
    Path(run_no): Path<i32>,
) -> AppResult<Json<PickedLotsResponse>> {
    let response = picking_service::get_picked_lots_for_run(&pool, run_no).await?;

    Ok(Json(response))
}

/// GET /api/picks/run/:runNo/pending
/// Get all pending (unpicked or partially picked) items for a run
/// Used in View Lots Modal - Pending Tab
///
/// # Path Parameters
/// - runNo: Production run number
///
/// # Response
/// - 200 OK: List of pending items
/// - 500 Internal Server Error: Query failed
///
/// # Returns
/// - pendingItems: Array of PendingItemDTO (batchNo, itemKey, toPickedQty)
/// - runNo: Production run number
pub async fn get_pending_items_endpoint(
    State(pool): State<DbPool>,
    Path(run_no): Path<i32>,
) -> AppResult<Json<PendingItemsResponse>> {
    let response = picking_service::get_pending_items_for_run(&pool, run_no).await?;

    Ok(Json(response))
}
