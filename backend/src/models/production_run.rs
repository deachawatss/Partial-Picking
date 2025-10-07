use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Production run/batch entity
/// Database Table: Cust_PartialRun
/// Composite PK: (RunNo, RowNum)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionRun {
    /// Run identifier (composite PK part 1)
    #[serde(rename = "RunNo")]
    pub run_no: i32,

    /// Batch number (composite PK part 2, represents batch sequence)
    #[serde(rename = "RowNum")]
    pub row_num: i32,

    /// Batch identifier
    #[serde(rename = "BatchNo")]
    pub batch_no: Option<String>,

    /// FG Item Key (display field)
    #[serde(rename = "FormulaId")]
    pub formula_id: Option<String>,

    /// FG Description (display field)
    #[serde(rename = "FormulaDesc")]
    pub formula_desc: Option<String>,

    /// Total batches count (display field)
    #[serde(rename = "NoOfBatches")]
    pub no_of_batches: Option<i32>,

    /// Pallets per batch
    #[serde(rename = "PalletsPerBatch")]
    pub pallets_per_batch: Option<i32>,

    /// Run workflow status ('NEW' or 'PRINT')
    #[serde(rename = "Status")]
    pub status: Option<RunStatus>,

    /// Creator (FK to tbl_user.uname)
    #[serde(rename = "RecUserId")]
    pub rec_user_id: Option<String>,

    /// Production Date (display field)
    #[serde(rename = "RecDate")]
    pub rec_date: Option<DateTime<Utc>>,

    /// Last modifier (FK to tbl_user.uname)
    #[serde(rename = "ModifiedBy")]
    pub modified_by: Option<String>,

    /// Last modification timestamp
    #[serde(rename = "ModifiedDate")]
    pub modified_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RunStatus {
    /// Initial state when run created
    New,
    /// Pallet assigned, labels print (terminal state)
    Print,
}
