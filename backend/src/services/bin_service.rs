use crate::db::DbPool;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use tiberius::{Query, Row};

/// Bin DTO matching OpenAPI BinDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinDTO {
    pub location: String,

    #[serde(rename = "binNo")]
    pub bin_no: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub aisle: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub row: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack: Option<String>,

    pub user1: String, // WHTFC1

    pub user4: String, // PARTIAL
}

/// Bins response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinsResponse {
    pub bins: Vec<BinDTO>,
}

/// List TFC1 PARTIAL bins
///
/// Uses validated SQL from Database Specialist: bin_filtering.sql
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `aisle` - Optional aisle filter
/// * `row` - Optional row filter
/// * `rack` - Optional rack filter
///
/// # Returns
/// * Vector of bins (511 bins total when no filters)
///
/// # Constitutional Compliance
/// * ✅ Location = 'TFC1' (TFC warehouse)
/// * ✅ User1 = 'WHTFC1' (warehouse identifier)
/// * ✅ User4 = 'PARTIAL' (bin type - partial picking area)
/// * ✅ Expected result: 511 bins without filters
pub async fn get_bins(
    pool: &DbPool,
    aisle_filter: Option<String>,
    row_filter: Option<String>,
    rack_filter: Option<String>,
) -> AppResult<BinsResponse> {
    let mut conn = pool.get().await?;

    // SQL from Database Specialist: bin_filtering.sql with optional filters
    let mut sql = r#"
        SELECT
            Location,
            BinNo,
            Description,
            aisle,
            row,
            rack,
            User1,
            User4
        FROM BINMaster
        WHERE Location = 'TFC1'
          AND User1 = 'WHTFC1'
          AND User4 = 'PARTIAL'
    "#
    .to_string();

    // Add optional filters
    let mut param_count = 0;
    if aisle_filter.is_some() {
        param_count += 1;
        sql.push_str(&format!(" AND aisle = @P{}", param_count));
    }
    if row_filter.is_some() {
        param_count += 1;
        sql.push_str(&format!(" AND row = @P{}", param_count));
    }
    if rack_filter.is_some() {
        param_count += 1;
        sql.push_str(&format!(" AND rack = @P{}", param_count));
    }

    sql.push_str(" ORDER BY BinNo ASC");

    let mut query = Query::new(&sql);

    // Bind parameters in order
    param_count = 0;
    if let Some(ref aisle) = aisle_filter {
        param_count += 1;
        query.bind(aisle.as_str());
    }
    if let Some(ref row) = row_filter {
        param_count += 1;
        query.bind(row.as_str());
    }
    if let Some(ref rack) = rack_filter {
        query.bind(rack.as_str());
    }

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    let bins: Vec<BinDTO> = rows
        .iter()
        .map(|row| {
            let location: &str = row.get("Location").unwrap_or("TFC1");
            let bin_no: &str = row.get("BinNo").unwrap_or("");
            let description: Option<&str> = row.get("Description");
            let aisle: Option<&str> = row.get("aisle");
            let row_val: Option<&str> = row.get("row");
            let rack: Option<&str> = row.get("rack");
            let user1: &str = row.get("User1").unwrap_or("WHTFC1");
            let user4: &str = row.get("User4").unwrap_or("PARTIAL");

            BinDTO {
                location: location.to_string(),
                bin_no: bin_no.to_string(),
                description: description.map(|s| s.to_string()),
                aisle: aisle.map(|s| s.to_string()),
                row: row_val.map(|s| s.to_string()),
                rack: rack.map(|s| s.to_string()),
                user1: user1.to_string(),
                user4: user4.to_string(),
            }
        })
        .collect();

    tracing::debug!(
        bins_count = bins.len(),
        aisle_filter = ?aisle_filter,
        row_filter = ?row_filter,
        rack_filter = ?rack_filter,
        "Retrieved TFC1 PARTIAL bins"
    );

    Ok(BinsResponse { bins })
}
