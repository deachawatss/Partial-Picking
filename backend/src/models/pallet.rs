use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Pallet entity - completed batch pallet with sequential ID
/// Database Table: Cust_PartialPalletLotPicked
/// Composite PK: (RunNo, RowNum, LineId)
/// CRITICAL: Records created AFTER all items picked, NOT during picking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pallet {
    /// Run identifier (composite PK part 1, FK to Cust_PartialRun)
    #[serde(rename = "RunNo")]
    pub run_no: i32,

    /// Batch number (composite PK part 2, FK to Cust_PartialRun)
    #[serde(rename = "RowNum")]
    pub row_num: i32,

    /// Line identifier (composite PK part 3, always = 1)
    #[serde(rename = "LineId")]
    pub line_id: i32,

    /// Batch identifier
    #[serde(rename = "BatchNo")]
    pub batch_no: Option<String>,

    /// Pallet identifier from PT sequence (sequential: 623524, 623525, ...)
    #[serde(rename = "PalletID")]
    pub pallet_id: String,

    /// Creator (Workstation ID or user)
    #[serde(rename = "RecUserid")]
    pub rec_userid: Option<String>,

    /// Pallet assignment date
    #[serde(rename = "RecDate")]
    pub rec_date: Option<DateTime<Utc>>,

    /// Modifier
    #[serde(rename = "ModifiedBy")]
    pub modified_by: Option<String>,

    /// Modification date
    #[serde(rename = "ModifiedDate")]
    pub modified_date: Option<DateTime<Utc>>,
}
