use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Lot entity - inventory lot with expiration tracking
/// Database Table: LotMaster
/// Composite PK: (LotNo, ItemKey, LocationKey, BinNo)
/// CRITICAL: Multiple records per LotNo (one per BinNo) - same lot can exist in multiple bins
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lot {
    /// Lot number (composite PK part 1)
    #[serde(rename = "LotNo")]
    pub lot_no: String,

    /// Item SKU (composite PK part 2, FK to INMAST.Itemkey)
    #[serde(rename = "ItemKey")]
    pub item_key: String,

    /// Location code (composite PK part 3)
    #[serde(rename = "LocationKey")]
    pub location_key: String,

    /// Bin number (composite PK part 4, FK to BINMaster)
    #[serde(rename = "BinNo")]
    pub bin_no: String,

    /// Received date
    #[serde(rename = "DateReceived")]
    pub date_received: Option<DateTime<Utc>>,

    /// Expiry date (FEFO sort key, must be > DateReceived)
    #[serde(rename = "DateExpiry")]
    pub date_expiry: Option<DateTime<Utc>>,

    /// Original received qty
    #[serde(rename = "QtyReceived")]
    pub qty_received: Option<f64>,

    /// Total issued qty
    #[serde(rename = "QtyIssued")]
    pub qty_issued: Option<f64>,

    /// Committed for picking (≥ 0, ≤ QtyOnHand)
    #[serde(rename = "QtyCommitSales")]
    pub qty_commit_sales: f64,

    /// Current on-hand qty
    #[serde(rename = "QtyOnHand")]
    pub qty_on_hand: f64,

    /// Receipt document
    #[serde(rename = "DocumentNo")]
    pub document_no: Option<String>,

    /// Receipt line
    #[serde(rename = "DocumentLineNo")]
    pub document_line_no: Option<i32>,

    /// Transaction code
    #[serde(rename = "TransactionType")]
    pub transaction_type: Option<i32>,

    /// Vendor identifier
    #[serde(rename = "VendorKey")]
    pub vendor_key: Option<String>,

    /// Vendor lot number
    #[serde(rename = "VendorLotNo")]
    pub vendor_lot_no: Option<String>,

    /// Qty on order
    #[serde(rename = "QtyOnOrder")]
    pub qty_on_order: Option<f64>,

    /// Lot status ('P' = Pass, 'H' = Hold, 'C' = Other, '' = None)
    #[serde(rename = "LotStatus")]
    pub lot_status: Option<LotStatus>,

    /// Quarantine date
    #[serde(rename = "DateQuarantine")]
    pub date_quarantine: Option<DateTime<Utc>>,

    /// Creator (FK to tbl_user.uname)
    #[serde(rename = "RecUserId")]
    pub rec_user_id: Option<String>,

    /// Record date
    #[serde(rename = "Recdate")]
    pub recdate: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LotStatus {
    /// Pass - approved for use
    P,
    /// Hold - quarantined
    H,
    /// Other status
    C,
}

