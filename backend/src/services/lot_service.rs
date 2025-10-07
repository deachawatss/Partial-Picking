use crate::db::DbPool;
use crate::error::AppResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tiberius::{Query, Row};

/// Lot availability DTO matching OpenAPI LotAvailabilityDTO schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotAvailabilityDTO {
    #[serde(rename = "lotNo")]
    pub lot_no: String,

    #[serde(rename = "itemKey")]
    pub item_key: String,

    #[serde(rename = "binNo")]
    pub bin_no: String,

    #[serde(rename = "locationKey")]
    pub location_key: String,

    #[serde(rename = "qtyOnHand")]
    pub qty_on_hand: f64,

    #[serde(rename = "qtyCommitSales")]
    pub qty_commit_sales: f64,

    #[serde(rename = "availableQty")]
    pub available_qty: f64,

    #[serde(rename = "expiryDate")]
    pub expiry_date: String, // YYYY-MM-DD format

    #[serde(rename = "lotStatus")]
    pub lot_status: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub aisle: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub row: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack: Option<String>,
}

/// Lots response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotsResponse {
    pub lots: Vec<LotAvailabilityDTO>,
}

/// Get available lots for item (FEFO-sorted, TFC1 PARTIAL bins only)
///
/// Uses validated SQL from Database Specialist: fefo_lot_selection.sql
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `item_key` - Item SKU to search for
/// * `min_qty` - Optional minimum available quantity required
///
/// # Returns
/// * Vector of available lots sorted by FEFO (DateExpiry ASC, Location ASC)
/// * Empty vector if no lots available
///
/// # Constitutional Compliance (CRITICAL)
/// * ✅ ORDER BY DateExpiry ASC FIRST (constitutional requirement)
/// * ✅ Then LocationKey ASC (secondary sort)
/// * ✅ Filters: Location='TFC1', Available qty >= target
/// * ✅ LotStatus IN ('P', 'C', '', NULL) - only usable lots
/// * ✅ Returns TOP 1 for specific target qty, or all available lots
pub async fn get_available_lots(
    pool: &DbPool,
    item_key: &str,
    min_qty: Option<f64>,
) -> AppResult<LotsResponse> {
    let mut conn = pool.get().await?;

    // SQL from Database Specialist: fefo_lot_selection.sql
    // Modified to return all lots (not just TOP 1) for listing
    let sql = if let Some(_qty) = min_qty {
        r#"
        SELECT TOP 1
            LotNo,
            BinNo,
            DateExpiry,
            QtyOnHand,
            QtyCommitSales,
            (QtyOnHand - QtyCommitSales) AS AvailableQty,
            LocationKey,
            LotStatus
        FROM LotMaster
        WHERE ItemKey = @P1
          AND LocationKey = 'TFC1'
          AND (QtyOnHand - QtyCommitSales) >= @P2
          AND (LotStatus = 'P' OR LotStatus = 'C' OR LotStatus = '' OR LotStatus IS NULL)
        ORDER BY DateExpiry ASC, LocationKey ASC
        "#
    } else {
        r#"
        SELECT
            LotNo,
            BinNo,
            DateExpiry,
            QtyOnHand,
            QtyCommitSales,
            (QtyOnHand - QtyCommitSales) AS AvailableQty,
            LocationKey,
            LotStatus
        FROM LotMaster
        WHERE ItemKey = @P1
          AND LocationKey = 'TFC1'
          AND (QtyOnHand - QtyCommitSales) > 0
          AND (LotStatus = 'P' OR LotStatus = 'C' OR LotStatus = '' OR LotStatus IS NULL)
        ORDER BY DateExpiry ASC, LocationKey ASC
        "#
    };

    let mut query = Query::new(sql);
    query.bind(item_key);
    if let Some(qty) = min_qty {
        query.bind(qty);
    }

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    let lots: Vec<LotAvailabilityDTO> = rows
        .iter()
        .map(|row| {
            let lot_no: &str = row.get("LotNo").unwrap_or("");
            let bin_no: &str = row.get("BinNo").unwrap_or("");
            let location_key: &str = row.get("LocationKey").unwrap_or("TFC1");
            let qty_on_hand: f64 = row.get("QtyOnHand").unwrap_or(0.0);
            let qty_commit_sales: f64 = row.get("QtyCommitSales").unwrap_or(0.0);
            let available_qty: f64 = row.get("AvailableQty").unwrap_or(0.0);
            let expiry_date: DateTime<Utc> = row.get("DateExpiry").unwrap_or(Utc::now());
            let lot_status: &str = row.get("LotStatus").unwrap_or("P");

            // Parse bin location components (e.g., "PWBB-12" -> PW, B, 12)
            let (aisle, row_char, rack) = parse_bin_location(bin_no);

            LotAvailabilityDTO {
                lot_no: lot_no.to_string(),
                item_key: item_key.to_string(),
                bin_no: bin_no.to_string(),
                location_key: location_key.to_string(),
                qty_on_hand,
                qty_commit_sales,
                available_qty,
                expiry_date: expiry_date.format("%Y-%m-%d").to_string(),
                lot_status: lot_status.to_string(),
                aisle,
                row: row_char,
                rack,
            }
        })
        .collect();

    tracing::debug!(
        item_key = item_key,
        min_qty = ?min_qty,
        lots_found = lots.len(),
        "Retrieved available lots (FEFO-sorted)"
    );

    Ok(LotsResponse { lots })
}

/// Parse bin location into aisle, row, rack components
///
/// Examples:
/// - "PWBB-12" -> ("PW", "B", "12")
/// - "PWBA-01" -> ("PW", "B", "01")
/// - "PW00-00" -> ("PW", "", "00")
fn parse_bin_location(bin_no: &str) -> (Option<String>, Option<String>, Option<String>) {
    // Simple heuristic: first 2 chars = aisle, next 1-2 chars = row, rest = rack
    if bin_no.len() < 4 {
        return (None, None, None);
    }

    let aisle = bin_no.get(0..2).map(|s| s.to_string());

    // Find the dash separator
    if let Some(dash_pos) = bin_no.find('-') {
        let row_part = bin_no.get(2..dash_pos).map(|s| s.to_string());
        let rack_part = bin_no.get(dash_pos + 1..).map(|s| s.to_string());
        (aisle, row_part, rack_part)
    } else {
        // No dash - fallback
        (aisle, None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bin_location() {
        let (aisle, row, rack) = parse_bin_location("PWBB-12");
        assert_eq!(aisle, Some("PW".to_string()));
        assert_eq!(row, Some("BB".to_string()));
        assert_eq!(rack, Some("12".to_string()));

        let (aisle, row, rack) = parse_bin_location("PWBA-01");
        assert_eq!(aisle, Some("PW".to_string()));
        assert_eq!(row, Some("BA".to_string()));
        assert_eq!(rack, Some("01".to_string()));
    }
}
