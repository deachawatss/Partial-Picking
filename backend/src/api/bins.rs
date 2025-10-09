use crate::db::DbPool;
use crate::error::AppResult;
use crate::middleware::auth::AuthUser;
use crate::services::bin_service::{get_bins, get_bins_for_lot, BinLotDTO, BinsResponse};
use axum::{
    extract::{Path, Query as QueryParams, State},
    Json,
};
use serde::{Deserialize, Serialize};

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

/// Response wrapper for bins-for-lot endpoint
#[derive(Debug, Serialize)]
pub struct BinLotsResponse {
    pub bins: Vec<BinLotDTO>,
}

/// GET /api/bins/lot/{lotNo}/{itemKey}
///
/// Get bins that contain inventory for a specific lot and item
///
/// # OpenAPI Contract
/// - operationId: getBinsForLot
/// - Path parameters: lotNo (required), itemKey (required)
/// - Response 200: BinLotsResponse (bins array with inventory details)
///
/// # Use Case
/// * When user selects a lot, show available bins for that lot
/// * Allows manual override of bin selection within the same lot
///
/// # Constitutional Compliance
/// * ✅ JWT authentication required (AuthUser extractor)
/// * ✅ Location = 'TFC1'
/// * ✅ Returns bins with DateExpiry, QtyOnHand, QtyCommitSales, PackSize
pub async fn get_bins_for_lot_endpoint(
    State(pool): State<DbPool>,
    AuthUser(claims): AuthUser,
    Path((lot_no, item_key)): Path<(String, String)>,
) -> AppResult<Json<BinLotsResponse>> {
    tracing::info!(
        user = %claims.username,
        lot_no = %lot_no,
        item_key = %item_key,
        "GET /api/bins/lot request"
    );

    let bins = get_bins_for_lot(&pool, &lot_no, &item_key).await?;

    tracing::info!(
        bins_count = bins.len(),
        lot_no = %lot_no,
        item_key = %item_key,
        "Returned bins for lot"
    );

    Ok(Json(BinLotsResponse { bins }))
}
