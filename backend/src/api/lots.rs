use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::services::lot_service::{get_available_lots, LotsResponse};
use axum::{
    extract::{Query as QueryParams, State},
    Json,
};
use serde::Deserialize;

/// Query parameters for GET /api/lots/available
#[derive(Debug, Deserialize)]
pub struct GetLotsQuery {
    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "minQty")]
    pub min_qty: Option<f64>,
}

/// GET /api/lots/available?itemKey=X&minQty=Y
///
/// Get available lots for item (FEFO-sorted, TFC1 PARTIAL bins only)
///
/// # OpenAPI Contract
/// - operationId: getAvailableLots
/// - Query parameters: itemKey (required), minQty (optional)
/// - Response 200: LotsResponse (lots array)
///
/// # Constitutional Compliance (CRITICAL)
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ FEFO sorting: ORDER BY DateExpiry ASC, LocationKey ASC
/// * ✅ Filters: Location='TFC1', Available qty >= minQty
/// * ✅ LotStatus IN ('P', 'C', '', NULL) - only usable lots
/// * ✅ Returns TOP 1 if minQty specified, all lots otherwise
pub async fn get_available_lots_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    QueryParams(params): QueryParams<GetLotsQuery>,
) -> AppResult<Json<LotsResponse>> {
    tracing::info!(
        user = %claims.username,
        item_key = %params.item_key,
        min_qty = ?params.min_qty,
        "GET /api/lots/available request"
    );

    // Validate itemKey
    if params.item_key.trim().is_empty() {
        return Err(AppError::ValidationError(
            "itemKey is required and cannot be empty".to_string(),
        ));
    }

    // Validate minQty if provided
    if let Some(qty) = params.min_qty {
        if qty < 0.0 {
            return Err(AppError::ValidationError(
                "minQty must be greater than or equal to 0".to_string(),
            ));
        }
    }

    let response = get_available_lots(&pool, &params.item_key, params.min_qty).await?;

    Ok(Json(response))
}
