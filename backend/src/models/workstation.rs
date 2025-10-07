use serde::{Deserialize, Serialize};

/// Workstation entity - picking workstation with dual scale assignment
/// Database Table: TFC_workstation2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workstation {
    /// Workstation identifier (PK, unique)
    #[serde(rename = "WorkstationId")]
    pub workstation_id: String,

    /// Display name (WS1-WS4)
    #[serde(rename = "WorkstationName")]
    pub workstation_name: String,

    /// Small scale assignment (FK to TFC_Weightscale2)
    #[serde(rename = "SmallScaleId")]
    pub small_scale_id: Option<String>,

    /// Big scale assignment (FK to TFC_Weightscale2)
    #[serde(rename = "BigScaleId")]
    pub big_scale_id: Option<String>,

    /// Workstation status ('Active' or 'Inactive')
    #[serde(rename = "Status")]
    pub status: WorkstationStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkstationStatus {
    /// Workstation operational
    Active,
    /// Workstation offline (hidden from selection UI)
    Inactive,
}
