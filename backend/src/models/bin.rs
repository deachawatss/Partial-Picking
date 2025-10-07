use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Bin entity - physical warehouse bin location
/// Database Table: BINMaster
/// Composite PK: (Location, BinNo)
/// PROJECT SCOPE: ONLY bins where Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL' (511 bins)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bin {
    /// Warehouse location (composite PK part 1, MUST='TFC1')
    #[serde(rename = "Location")]
    pub location: String,

    /// Bin identifier (composite PK part 2)
    #[serde(rename = "BinNo")]
    pub bin_no: String,

    /// Bin description
    #[serde(rename = "Description")]
    pub description: Option<String>,

    /// Aisle identifier
    pub aisle: Option<String>,

    /// Row identifier
    pub row: Option<String>,

    /// Rack identifier
    pub rack: Option<String>,

    /// Warehouse identifier (MUST='WHTFC1' for project scope)
    #[serde(rename = "User1")]
    pub user1: String,

    /// Bin type identifier (MUST='PARTIAL' for project scope)
    #[serde(rename = "User4")]
    pub user4: String,

    /// Storage condition
    #[serde(rename = "StrgCndtnKey")]
    pub strg_cndtn_key: Option<String>,

    /// Nettable flag
    #[serde(rename = "Nettable")]
    pub nettable: bool,

    /// Line sequence
    #[serde(rename = "LineSequence")]
    pub line_sequence: Option<i32>,

    /// Creator (FK to tbl_user.uname)
    #[serde(rename = "RecUserId")]
    pub rec_user_id: Option<String>,

    /// Record date
    #[serde(rename = "RecDate")]
    pub rec_date: Option<DateTime<Utc>>,
}

