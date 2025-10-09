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

    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "minQty")]
    pub min_qty: Option<f64>,
}

/// GET /api/lots/available?itemKey=X&runNo=Y&rowNum=Z&minQty=W
///
/// Get available lots for item (FEFO-sorted, TFC1 PARTIAL bins only)
/// Enhanced with PackSize from cust_PartialPicked JOIN
///
/// # OpenAPI Contract
/// - operationId: getAvailableLots
/// - Query parameters: itemKey (required), runNo (required), rowNum (required), minQty (optional)
/// - Response 200: LotsResponse (lots array with packSize)
///
/// # Constitutional Compliance (CRITICAL)
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ FEFO sorting: ORDER BY DateExpiry ASC, LocationKey ASC
/// * ✅ Filters: Location='TFC1', Available qty >= minQty
/// * ✅ LotStatus IN ('P', 'C', '', NULL) - only usable lots
/// * ✅ Returns TOP 1 if minQty specified, all lots otherwise
/// * ✅ Includes PackSize from cust_PartialPicked
pub async fn get_available_lots_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    QueryParams(params): QueryParams<GetLotsQuery>,
) -> AppResult<Json<LotsResponse>> {
    tracing::info!(
        user = %claims.username,
        item_key = %params.item_key,
        run_no = params.run_no,
        row_num = params.row_num,
        min_qty = ?params.min_qty,
        "GET /api/lots/available request"
    );

    // Validate itemKey
    if params.item_key.trim().is_empty() {
        return Err(AppError::ValidationError(
            "itemKey is required and cannot be empty".to_string(),
        ));
    }

    // Validate runNo
    if params.run_no <= 0 {
        return Err(AppError::ValidationError(
            "runNo must be greater than 0".to_string(),
        ));
    }

    // Validate rowNum
    if params.row_num <= 0 {
        return Err(AppError::ValidationError(
            "rowNum must be greater than 0".to_string(),
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

    let response = get_available_lots(
        &pool,
        &params.item_key,
        params.run_no,
        params.row_num,
        params.min_qty,
    )
    .await?;

    Ok(Json(response))
}
