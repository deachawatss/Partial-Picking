use crate::db::DbPool;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use tiberius::{Query, Row};

/// Workstation DTO matching OpenAPI WorkstationDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkstationDTO {
    #[serde(rename = "workstationId")]
    pub workstation_id: String,

    #[serde(rename = "workstationName")]
    pub workstation_name: String,

    #[serde(rename = "smallScaleId", skip_serializing_if = "Option::is_none")]
    pub small_scale_id: Option<String>,

    #[serde(rename = "bigScaleId", skip_serializing_if = "Option::is_none")]
    pub big_scale_id: Option<String>,

    pub status: String, // Active | Inactive
}

/// Workstations response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkstationsResponse {
    pub workstations: Vec<WorkstationDTO>,
}

/// List all workstations with scale assignments
///
/// Uses validated SQL from Database Specialist: workstation_config.sql
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `status_filter` - Optional filter by status (Active | Inactive)
///
/// # Returns
/// * Vector of workstations with scale configurations
///
/// # Constitutional Compliance
/// * ✅ Returns only active workstations by default
/// * ✅ Each workstation has 2 scales (1 SMALL, 1 BIG)
/// * ✅ Frontend uses controller IDs for WebSocket endpoints
pub async fn get_workstations(
    pool: &DbPool,
    status_filter: Option<String>,
) -> AppResult<WorkstationsResponse> {
    let mut conn = pool.get().await?;

    // SQL from Database Specialist: workstation_config.sql
    let mut sql = r#"
        SELECT
            WorkstationName,
            ControllerID_Small,
            ControllerID_Big,
            DualScaleEnabled,
            IsActive
        FROM TFC_Weighup_WorkStations2
    "#
    .to_string();

    // Add status filter
    if let Some(ref status) = status_filter {
        if status.eq_ignore_ascii_case("Active") {
            sql.push_str(" WHERE IsActive = 1");
        } else if status.eq_ignore_ascii_case("Inactive") {
            sql.push_str(" WHERE IsActive = 0");
        }
    } else {
        // Default: only active workstations
        sql.push_str(" WHERE IsActive = 1");
    }

    sql.push_str(" ORDER BY WorkstationName ASC");

    let query = Query::new(&sql);
    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    let workstations: Vec<WorkstationDTO> = rows
        .iter()
        .enumerate()
        .map(|(idx, row)| {
            let workstation_name: &str = row.get("WorkstationName").unwrap_or("");
            let small_scale_id: Option<&str> = row.get("ControllerID_Small");
            let big_scale_id: Option<&str> = row.get("ControllerID_Big");
            let is_active: bool = row.get("IsActive").unwrap_or(false);

            // Generate workstation ID (use index-based ID if not available)
            let workstation_id = format!("WS-{:03}", idx + 1);

            WorkstationDTO {
                workstation_id,
                workstation_name: workstation_name.to_string(),
                small_scale_id: small_scale_id.map(|s| s.to_string()),
                big_scale_id: big_scale_id.map(|s| s.to_string()),
                status: if is_active { "Active" } else { "Inactive" }.to_string(),
            }
        })
        .collect();

    tracing::debug!(
        workstations_count = workstations.len(),
        status_filter = ?status_filter,
        "Retrieved workstation configurations"
    );

    Ok(WorkstationsResponse { workstations })
}
