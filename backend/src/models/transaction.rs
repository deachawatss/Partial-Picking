use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Transaction entity - audit record of picking operation
/// Database Table: LotTransaction
/// IMPORTANT: Append-only table (never delete, audit trail)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotTransaction {
    /// Transaction number (PK, auto-increment)
    #[serde(rename = "LotTranNo")]
    pub lot_tran_no: i32,

    /// Lot number (FK to LotMaster)
    #[serde(rename = "LotNo")]
    pub lot_no: String,

    /// Item SKU (FK to INMAST)
    #[serde(rename = "ItemKey")]
    pub item_key: String,

    /// Location code
    #[serde(rename = "LocationKey")]
    pub location_key: String,

    /// Received date (NULL for picking)
    #[serde(rename = "DateReceived")]
    pub date_received: Option<DateTime<Utc>>,

    /// Expiry date
    #[serde(rename = "DateExpiry")]
    pub date_expiry: Option<DateTime<Utc>>,

    /// Transaction type (5 for partial picking)
    #[serde(rename = "TransactionType")]
    pub transaction_type: i32,

    /// Receipt document
    #[serde(rename = "ReceiptDocNo")]
    pub receipt_doc_no: Option<String>,

    /// Receipt line
    #[serde(rename = "ReceiptDocLineNo")]
    pub receipt_doc_line_no: Option<i32>,

    /// Qty received (0 for picking)
    #[serde(rename = "QtyReceived")]
    pub qty_received: Option<f64>,

    /// Vendor key (NULL for picking)
    #[serde(rename = "Vendorkey")]
    pub vendorkey: Option<String>,

    /// Vendor lot (NULL for picking)
    #[serde(rename = "VendorlotNo")]
    pub vendorlot_no: Option<String>,

    /// Issue document (BatchNo from cust_PartialPicked)
    #[serde(rename = "IssueDocNo")]
    pub issue_doc_no: Option<String>,

    /// Issue line (LineId from cust_PartialPicked)
    #[serde(rename = "IssueDocLineNo")]
    pub issue_doc_line_no: Option<i32>,

    /// Picking timestamp
    #[serde(rename = "IssueDate")]
    pub issue_date: Option<DateTime<Utc>>,

    /// Weight from scale
    #[serde(rename = "QtyIssued")]
    pub qty_issued: f64,

    /// Customer code
    #[serde(rename = "CustomerKey")]
    pub customer_key: Option<String>,

    /// Workstation (WS1-WS4)
    #[serde(rename = "RecUserid")]
    pub rec_userid: Option<String>,

    /// Transaction date
    #[serde(rename = "RecDate")]
    pub rec_date: Option<DateTime<Utc>>,

    /// Processed flag ('Y' or 'N')
    #[serde(rename = "Processed")]
    pub processed: ProcessedStatus,

    /// Source bin (FK to BINMaster)
    #[serde(rename = "BinNo")]
    pub bin_no: Option<String>,

    /// System marker ('Picking Customization')
    #[serde(rename = "User5")]
    pub user5: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProcessedStatus {
    /// Not yet processed to inventory
    N,
    /// Transaction applied to inventory
    Y,
}

impl Default for ProcessedStatus {
    fn default() -> Self {
        ProcessedStatus::N
    }
}
