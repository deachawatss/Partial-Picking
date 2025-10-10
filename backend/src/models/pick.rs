use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Request DTO for picking operation
/// Matches OpenAPI schema: PickRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickRequest {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "lineId")]
    pub line_id: i32,

    #[serde(rename = "lotNo")]
    pub lot_no: String,

    #[serde(rename = "binNo")]
    pub bin_no: String,

    /// Weight from scale
    pub weight: f64,

    #[serde(rename = "workstationId")]
    pub workstation_id: String,
}

/// Response DTO for picking operation
/// Matches OpenAPI schema: PickResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickResponse {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "lineId")]
    pub line_id: i32,

    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "lotNo")]
    pub lot_no: String,

    #[serde(rename = "binNo")]
    pub bin_no: String,

    #[serde(rename = "pickedQty")]
    pub picked_qty: f64,

    #[serde(rename = "targetQty")]
    pub target_qty: f64,

    pub status: String,

    #[serde(rename = "pickingDate")]
    pub picking_date: DateTime<Utc>,

    #[serde(rename = "lotTranNo")]
    pub lot_tran_no: i32,
}

/// Response DTO for unpick operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnpickResponse {
    #[serde(rename = "runNo")]
    pub run_no: i32,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "lineId")]
    pub line_id: i32,

    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "pickedQty")]
    pub picked_qty: f64,

    pub status: String,

    #[serde(rename = "unpickedAt")]
    pub unpicked_at: DateTime<Utc>,
}

/// Internal DTO for tolerance validation query result
#[derive(Debug, Clone)]
pub struct ToleranceValidation {
    pub target_weight: f64,
    pub item_key: String,
    pub unit: Option<String>,
    pub tolerance_kg: f64,
    pub weight_range_low: f64,
    pub weight_range_high: f64,
    pub current_picked_weight: f64,
    pub item_batch_status: Option<String>,
    pub item_description: Option<String>,
}

/// Internal DTO for item already picked validation query result
#[derive(Debug, Clone)]
pub struct ItemPickedStatus {
    pub run_no: i32,
    pub row_num: i32,
    pub line_id: i32,
    pub item_key: String,
    pub target_weight: f64,
    pub actual_weight: f64,
    pub item_batch_status: Option<String>,
    pub picking_date: Option<DateTime<Utc>>,
    pub picked_by_workstation: Option<String>,
    pub is_picked: bool,
    pub was_unpicked: bool,
}

/// Internal DTO for lot allocation data needed for Phase 1
#[derive(Debug, Clone)]
pub struct LotAllocationData {
    pub lot_no: String,
    pub bin_no: String,
    pub item_key: String,
    pub location_key: String,
    pub date_received: Option<DateTime<Utc>>,
    pub date_expiry: Option<DateTime<Utc>>,
}

/// Response DTO for picked lot details
/// Used in View Lots Modal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickedLotDTO {
    #[serde(rename = "lotTranNo")]
    pub lot_tran_no: i32,

    #[serde(rename = "batchNo")]
    pub batch_no: String,

    #[serde(rename = "lotNo")]
    pub lot_no: String,

    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "locationKey")]
    pub location_key: String,

    #[serde(rename = "dateExp")]
    pub date_exp: Option<String>, // DD/MM/YYYY format

    #[serde(rename = "qtyReceived")]
    pub qty_received: f64,

    #[serde(rename = "binNo")]
    pub bin_no: String,

    #[serde(rename = "packSize")]
    pub pack_size: f64,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "lineId")]
    pub line_id: i32,
}

/// Response DTO for all picked lots in a run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickedLotsResponse {
    #[serde(rename = "pickedLots")]
    pub picked_lots: Vec<PickedLotDTO>,

    #[serde(rename = "runNo")]
    pub run_no: i32,
}
