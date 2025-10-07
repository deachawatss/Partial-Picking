use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::pallet_service;

/// Request DTO for run completion
#[derive(Debug, Deserialize)]
pub struct CompleteRunRequest {
    #[serde(rename = "workstationId")]
    pub workstation_id: String,
}

/// Response DTO for run completion
/// Matches OpenAPI schema
#[derive(Debug, Serialize)]
pub struct CompleteRunResponse {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "palletId")]
    pub pallet_id: String,

    pub status: String,

    #[serde(rename = "completedAt")]
    pub completed_at: String,
}

/// POST /api/runs/:runNo/complete
/// Complete run and assign pallet
///
/// # Workflow
/// 1. Validate all items in all batches are picked
/// 2. Get next PT sequence number for pallet ID
/// 3. Update run status from NEW to PRINT
/// 4. Create pallet record (Cust_PartialPalletLotPicked)
/// 5. Trigger batch summary label printing (future enhancement)
///
/// # Path Parameters
/// - runNo: Production run number
///
/// # Request Body
/// - workstationId: Workstation identifier (e.g., WS3)
///
/// # Response
/// - 200 OK: Run completed successfully
/// - 400 Bad Request: Not all items picked
/// - 404 Not Found: Run not found
/// - 500 Internal Server Error: Database error
///
/// # Constitutional Compliance
/// - Atomic transaction for run completion
/// - Validation before state change
pub async fn complete_run_endpoint(
    State(pool): State<DbPool>,
    Path(run_no): Path<i32>,
    Json(request): Json<CompleteRunRequest>,
) -> AppResult<Json<CompleteRunResponse>> {
    // Validate workstation ID
    if request.workstation_id.is_empty() {
        return Err(AppError::ValidationError(
            "Workstation ID is required".to_string(),
        ));
    }

    // Execute run completion service
    let pallet_id = pallet_service::complete_run(&pool, run_no, &request.workstation_id).await?;

    // Build response
    let response = CompleteRunResponse {
        run_no,
        pallet_id,
        status: "PRINT".to_string(),
        completed_at: Utc::now().to_rfc3339(),
    };

    Ok(Json(response))
}
