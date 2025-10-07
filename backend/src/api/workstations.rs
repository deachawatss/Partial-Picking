use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::auth::AuthUser;
use crate::services::workstation_service::{get_workstations, WorkstationsResponse};
use axum::{
    extract::{Query as QueryParams, State},
    Json,
};
use serde::Deserialize;

/// Query parameters for GET /api/workstations
#[derive(Debug, Deserialize)]
pub struct GetWorkstationsQuery {
    pub status: Option<String>, // Active | Inactive
}

/// GET /api/workstations?status=Active
///
/// List all workstations with scale assignments
///
/// # OpenAPI Contract
/// - operationId: listWorkstations
/// - Query parameter: status (optional, enum: Active | Inactive)
/// - Response 200: WorkstationsResponse (workstations array)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Returns only active workstations by default
/// * ✅ Each workstation has 2 scales (1 SMALL, 1 BIG)
/// * ✅ Frontend uses controller IDs for WebSocket endpoints
pub async fn list_workstations_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    QueryParams(params): QueryParams<GetWorkstationsQuery>,
) -> AppResult<Json<WorkstationsResponse>> {
    tracing::info!(
        user = %claims.username,
        status_filter = ?params.status,
        "GET /api/workstations request"
    );

    let response = get_workstations(&pool, params.status).await?;

    tracing::info!(
        workstations_count = response.workstations.len(),
        "Returned {} workstations",
        response.workstations.len()
    );

    Ok(Json(response))
}
