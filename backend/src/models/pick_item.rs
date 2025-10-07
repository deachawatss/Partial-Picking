use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Pick item entity - individual ingredient to be picked
/// Database Table: cust_PartialPicked (CRITICAL: lowercase 'c')
/// Composite PK: (RunNo, RowNum, LineId)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickItem {
    /// Run identifier (composite PK part 1, FK to Cust_PartialRun)
    #[serde(rename = "RunNo")]
    pub run_no: i32,

    /// Batch number (composite PK part 2, FK to Cust_PartialRun)
    #[serde(rename = "RowNum")]
    pub row_num: i32,

    /// Line sequence (composite PK part 3, sequential per batch)
    #[serde(rename = "LineId")]
    pub line_id: i32,

    /// Batch identifier
    #[serde(rename = "BatchNo")]
    pub batch_no: Option<String>,

    /// Line type ('FI' = Finished Item)
    #[serde(rename = "LineTyp")]
    pub line_typ: Option<String>,

    /// Item SKU (FK to INMAST.Itemkey)
    #[serde(rename = "ItemKey")]
    pub item_key: String,

    /// Warehouse location
    #[serde(rename = "Location")]
    pub location: Option<String>,

    /// Unit of measure ('KG', 'LB', 'EA')
    #[serde(rename = "Unit")]
    pub unit: Option<String>,

    /// Formula standard qty
    #[serde(rename = "StandardQty")]
    pub standard_qty: Option<f64>,

    /// Package size
    #[serde(rename = "PackSize")]
    pub pack_size: Option<f64>,

    /// Target weight (Total Needed) - MUST be > 0
    #[serde(rename = "ToPickedPartialQty")]
    pub to_picked_partial_qty: f64,

    /// Actual picked weight from scale (default 0)
    #[serde(rename = "PickedPartialQty")]
    pub picked_partial_qty: f64,

    /// Timestamp when picked
    #[serde(rename = "PickingDate")]
    pub picking_date: Option<DateTime<Utc>>,

    /// Picking status ('Allocated' or NULL)
    /// NULL = unpicked (never picked)
    /// 'Allocated' with PickedPartialQty > 0 = picked
    /// 'Allocated' with PickedPartialQty = 0 = unpicked (preserves audit trail)
    #[serde(rename = "ItemBatchStatus")]
    pub item_batch_status: Option<ItemBatchStatus>,

    /// Allergen code ('W' = Wheat, '' = None)
    #[serde(rename = "Allergen")]
    pub allergen: Option<String>,

    /// Creator (FK to tbl_user.uname)
    #[serde(rename = "RecUserId")]
    pub rec_user_id: Option<String>,

    /// Record date
    #[serde(rename = "RecDate")]
    pub rec_date: Option<DateTime<Utc>>,

    /// Last modifier (Workstation ID: WS1-WS4)
    #[serde(rename = "ModifiedBy")]
    pub modified_by: Option<String>,

    /// Last modification timestamp
    #[serde(rename = "ModifiedDate")]
    pub modified_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ItemBatchStatus {
    /// Item picked (or was picked before but unpicked)
    Allocated,
}
