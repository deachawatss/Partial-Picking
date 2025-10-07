use serde::{Deserialize, Serialize};

/// Weight scale entity - hardware scale device
/// Database Table: TFC_Weightscale2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightScale {
    /// Scale identifier (PK, unique)
    #[serde(rename = "ScaleId")]
    pub scale_id: String,

    /// Scale classification ('SMALL' or 'BIG')
    #[serde(rename = "ScaleType")]
    pub scale_type: ScaleType,

    /// Serial port (COM1 to COM99, env-specific)
    #[serde(rename = "ComPort")]
    pub com_port: String,

    /// Serial baud rate (9600, 19200, 38400, 115200)
    #[serde(rename = "BaudRate")]
    pub baud_rate: i32,

    /// Max capacity in kg (informational, not enforced)
    #[serde(rename = "Capacity")]
    pub capacity: Option<f64>,

    /// Precision in kg (informational, not enforced)
    #[serde(rename = "Precision")]
    pub precision: Option<f64>,

    /// Scale status ('Active' or 'Inactive')
    #[serde(rename = "Status")]
    pub status: ScaleStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ScaleType {
    Small,
    Big,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ScaleStatus {
    /// Scale operational, bridge service connects
    Active,
    /// Scale offline, bridge service skips
    Inactive,
}
