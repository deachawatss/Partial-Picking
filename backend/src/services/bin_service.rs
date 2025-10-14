use crate::db::DbPool;
use crate::error::AppResult;
use chrono::NaiveDateTime;
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

/// Bin-Lot DTO with inventory details for a specific lot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinLotDTO {
    #[serde(rename = "binNo")]
    pub bin_no: String,

    #[serde(rename = "expiryDate")]
    pub expiry_date: String, // YYYY-MM-DD format

    #[serde(rename = "qtyOnHand")]
    pub qty_on_hand: f64,

    #[serde(rename = "qtyCommitSales")]
    pub qty_commit_sales: f64,

    #[serde(rename = "availableQty")]
    pub available_qty: f64,

    #[serde(rename = "packSize")]
    pub pack_size: f64,
}

/// Get bins for a specific lot and item
///
/// Used for bin override workflow: when user selects a lot, they can choose
/// a different bin that contains inventory for the same lot.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `lot_no` - Lot number
/// * `item_key` - Item SKU
///
/// # Returns
/// * Vector of bins with inventory details for the specified lot
///
/// # Constitutional Compliance
/// * ✅ Location = 'TFC1'
/// * ✅ Includes PackSize from cust_PartialPicked JOIN
/// * ✅ Returns inventory details (QtyOnHand, QtyCommitSales, AvailableQty)
pub async fn get_bins_for_lot(
    pool: &DbPool,
    lot_no: &str,
    item_key: &str,
) -> AppResult<Vec<BinLotDTO>> {
    let mut conn = pool.get().await?;

    // Query bins that contain inventory for this specific lot and item
    // JOIN with cust_PartialPicked to get PackSize
    // INNER JOIN with BINMaster to enforce PARTIAL bin filtering (DB-Flow.md requirement)
    let sql = r#"
        SELECT DISTINCT
            l.BinNo,
            l.DateExpiry,
            l.QtyOnHand,
            l.QtyCommitSales,
            (l.QtyOnHand - l.QtyCommitSales) AS AvailableQty,
            ISNULL(p.PackSize, 0) AS PackSize
        FROM LotMaster l
        LEFT JOIN cust_PartialPicked p ON l.ItemKey = p.ItemKey
        INNER JOIN BINMaster b ON l.BinNo = b.BinNo AND l.LocationKey = b.Location
        WHERE l.LotNo = @P1
          AND l.ItemKey = @P2
          AND l.LocationKey = 'TFC1'
          AND b.User1 = 'WHTFC1'
          AND b.User4 = 'PARTIAL'
        ORDER BY l.BinNo ASC
    "#;

    let mut query = Query::new(sql);
    query.bind(lot_no);
    query.bind(item_key);

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    let bins: Vec<BinLotDTO> = rows
        .iter()
        .map(|row| {
            let bin_no: &str = row.get("BinNo").unwrap_or("");
            let qty_on_hand: f64 = row.get("QtyOnHand").unwrap_or(0.0);
            let qty_commit_sales: f64 = row.get("QtyCommitSales").unwrap_or(0.0);
            let available_qty: f64 = row.get("AvailableQty").unwrap_or(0.0);
            let pack_size: f64 = row.try_get::<f32, _>("PackSize")
                .ok()
                .flatten()
                .unwrap_or(0.0) as f64;

            // SQL Server DATETIME fields are returned as NaiveDateTime
            let expiry_date: NaiveDateTime = row
                .try_get::<NaiveDateTime, _>("DateExpiry")
                .ok()
                .flatten()
                .unwrap_or_default();

            BinLotDTO {
                bin_no: bin_no.to_string(),
                expiry_date: expiry_date.format("%d/%m/%Y").to_string(),
                qty_on_hand,
                qty_commit_sales,
                available_qty,
                pack_size,
            }
        })
        .collect();

    tracing::debug!(
        lot_no = lot_no,
        item_key = item_key,
        bins_count = bins.len(),
        "Retrieved bins for lot"
    );

    Ok(bins)
}

/// Get specific bin by bin number
///
/// Used for manual bin number input (scan or type bin number, press Enter)
/// Queries BINMaster for specific bin with TFC1 PARTIAL validation
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `bin_no` - Bin number to look up
///
/// # Returns
/// * BinDTO if bin exists in TFC1 PARTIAL area
/// * Error if bin not found or not in PARTIAL area
///
/// # Constitutional Compliance
/// * ✅ Validates bin exists in TFC1 PARTIAL area only
/// * ✅ Location = 'TFC1'
/// * ✅ User1 = 'WHTFC1' (warehouse identifier)
/// * ✅ User4 = 'PARTIAL' (bin type)
pub async fn get_bin_by_number(
    pool: &DbPool,
    bin_no: &str,
) -> AppResult<BinDTO> {
    let mut conn = pool.get().await?;

    // Query specific bin by BinNo + Location='TFC1' + PARTIAL filters
    let sql = r#"
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
        WHERE BinNo = @P1
          AND Location = 'TFC1'
          AND User1 = 'WHTFC1'
          AND User4 = 'PARTIAL'
    "#;

    let mut query = Query::new(sql);
    query.bind(bin_no);

    let rows = query.query(&mut *conn).await?;
    let rows: Vec<Row> = rows.into_first_result().await?;

    if rows.is_empty() {
        return Err(crate::error::AppError::RecordNotFound(format!(
            "Bin '{}' not found in TFC1 PARTIAL area",
            bin_no
        )));
    }

    let row = &rows[0];
    let location: &str = row.get("Location").unwrap_or("TFC1");
    let description: Option<&str> = row.get("Description");
    let aisle: Option<&str> = row.get("aisle");
    let row_val: Option<&str> = row.get("row");
    let rack: Option<&str> = row.get("rack");
    let user1: &str = row.get("User1").unwrap_or("WHTFC1");
    let user4: &str = row.get("User4").unwrap_or("PARTIAL");

    tracing::info!(
        bin_no = bin_no,
        location = location,
        aisle = ?aisle,
        row = ?row_val,
        rack = ?rack,
        "Retrieved bin by number"
    );

    Ok(BinDTO {
        location: location.to_string(),
        bin_no: bin_no.to_string(),
        description: description.map(|s| s.to_string()),
        aisle: aisle.map(|s| s.to_string()),
        row: row_val.map(|s| s.to_string()),
        rack: rack.map(|s| s.to_string()),
        user1: user1.to_string(),
        user4: user4.to_string(),
    })
}
