use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::auth::AuthUser;
use crate::services::bin_service::{get_bins, BinsResponse};
use axum::{
    extract::{Query as QueryParams, State},
    Json,
};
use serde::Deserialize;

/// Query parameters for GET /api/bins
#[derive(Debug, Deserialize)]
pub struct GetBinsQuery {
    pub aisle: Option<String>,
    pub row: Option<String>,
    pub rack: Option<String>,
}

/// GET /api/bins?aisle=X&row=Y&rack=Z
///
/// List TFC1 PARTIAL bins with optional filters
///
/// # OpenAPI Contract
/// - operationId: listBins
/// - Query parameters: aisle (optional), row (optional), rack (optional)
/// - Response 200: BinsResponse (bins array)
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Location = 'TFC1' (TFC warehouse)
/// * ✅ User1 = 'WHTFC1' (warehouse identifier)
/// * ✅ User4 = 'PARTIAL' (bin type - partial picking area)
/// * ✅ Returns 511 bins total without filters
pub async fn list_bins_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    QueryParams(params): QueryParams<GetBinsQuery>,
) -> AppResult<Json<BinsResponse>> {
    tracing::info!(
        user = %claims.username,
        aisle = ?params.aisle,
        row = ?params.row,
        rack = ?params.rack,
        "GET /api/bins request"
    );

    let response = get_bins(&pool, params.aisle, params.row, params.rack).await?;

    tracing::info!(
        bins_count = response.bins.len(),
        "Returned {} TFC1 PARTIAL bins",
        response.bins.len()
    );

    Ok(Json(response))
}
