use chrono::{DateTime, NaiveDateTime, Utc};
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

    /// Weight source for audit trail: "automatic" (from scale) or "manual" (keyboard entry)
    /// Maps to CUSTOM1 field in cust_PartialPicked: "MANUAL" when manual, NULL when automatic
    #[serde(rename = "weightSource")]
    pub weight_source: String,

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

/// Internal DTO for lot allocation data needed for Phase 1 and Phase 3
#[derive(Debug, Clone)]
pub struct LotAllocationData {
    pub lot_no: String,
    pub bin_no: String,
    pub item_key: String,
    pub location_key: String,
    // CRITICAL: Use NaiveDateTime for SQL Server datetime columns (timezone-naive)
    // DateReceived and DateExpiry are datetime columns, NOT datetimeoffset
    // DateTime<Utc> is for datetimeoffset columns only
    pub date_received: Option<NaiveDateTime>,
    pub date_expiry: Option<NaiveDateTime>,
    // Receipt/Vendor fields from LotMaster (for LotTransaction audit trail)
    pub receipt_doc_no: String,        // DocumentNo -> ReceiptDocNo
    pub receipt_doc_line_no: i16,      // DocumentLineNo -> ReceiptDocLineNo (SQL Server SMALLINT)
    pub vendor_key: String,            // VendorKey -> Vendorkey
    pub vendor_lot_no: String,         // VendorLotNo -> VendorlotNo
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

    #[serde(rename = "recDate")]
    pub rec_date: Option<DateTime<Utc>>,
}

/// Response DTO for all picked lots in a run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickedLotsResponse {
    #[serde(rename = "pickedLots")]
    pub picked_lots: Vec<PickedLotDTO>,

    #[serde(rename = "runNo")]
    pub run_no: i32,
}

/// Pending item DTO for View Lots Modal - Pending Tab
/// Shows items that haven't been fully picked yet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingItemDTO {
    #[serde(rename = "batchNo")]
    pub batch_no: String,

    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "toPickedQty")]
    pub to_picked_qty: f64,

    #[serde(rename = "rowNum")]
    pub row_num: i32,

    #[serde(rename = "lineId")]
    pub line_id: i32,
}

/// Response DTO for all pending items in a run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingItemsResponse {
    #[serde(rename = "pendingItems")]
    pub pending_items: Vec<PendingItemDTO>,

    #[serde(rename = "runNo")]
    pub run_no: i32,
}
