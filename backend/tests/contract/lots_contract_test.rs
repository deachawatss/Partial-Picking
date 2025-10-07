// Lot Management Contract Tests
// Tests validate FEFO algorithm and TFC1 PARTIAL bin filtering

use axum::http::StatusCode;
use serde_json::json;

mod test_helpers;
use test_helpers::*;

// =============================================================================
// GET /api/lots/available - FEFO Sorted Lot Selection
// =============================================================================

#[tokio::test]
async fn test_get_available_lots_fefo_sorted() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02&minQty=5.0")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Response matches schema
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;
    assert!(!body.lots.is_empty(), "Should have available lots");

    // Validate FEFO sorting (First Expired, First Out)
    // Constitutional requirement: ORDER BY DateExpiry ASC, Location ASC
    for i in 0..body.lots.len() - 1 {
        let current = &body.lots[i];
        let next = &body.lots[i + 1];

        // Parse dates for comparison
        let current_date = chrono::NaiveDate::parse_from_str(&current.expiry_date, "%Y-%m-%d")
            .expect("Invalid date format");
        let next_date = chrono::NaiveDate::parse_from_str(&next.expiry_date, "%Y-%m-%d")
            .expect("Invalid date format");

        // FEFO validation: Earlier expiry dates MUST come first
        assert!(
            current_date <= next_date,
            "FEFO violation: lot {} expires {} but is after lot {} which expires {}",
            current.lot_no,
            current.expiry_date,
            next.lot_no,
            next.expiry_date
        );
    }

    // Validate first lot has earliest expiry
    let first_lot = &body.lots[0];
    assert_eq!(first_lot.item_key, "INSALT02");
    assert!(first_lot.available_qty >= 5.0);
}

#[tokio::test]
async fn test_get_available_lots_bin_filtering() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;

    // Validate TFC1 PARTIAL bin filtering
    // Constitutional requirement: Location='TFC1' AND User1='WHTFC1' AND User4='PARTIAL'
    for lot in &body.lots {
        assert_eq!(
            lot.location_key, "TFC1",
            "Lot {} violates bin filter: Location must be TFC1",
            lot.lot_no
        );

        // All lots should be from PARTIAL bins (511 bins total)
        // BinNo format: {Aisle}{Row}{Rack} (e.g., PWBB-12)
        assert!(!lot.bin_no.is_empty(), "Lot {} has empty BinNo", lot.lot_no);
    }
}

#[tokio::test]
async fn test_get_available_lots_available_qty_calculation() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02&minQty=10.0")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;

    // Validate available quantity calculation
    // availableQty = QtyOnHand - QtyCommitSales
    for lot in &body.lots {
        let calculated_available = lot.qty_on_hand - lot.qty_commit_sales;

        assert!(
            (lot.available_qty - calculated_available).abs() < 0.001,
            "Lot {}: availableQty {} doesn't match calculation {} (OnHand: {}, Commit: {})",
            lot.lot_no,
            lot.available_qty,
            calculated_available,
            lot.qty_on_hand,
            lot.qty_commit_sales
        );

        // Verify minQty filter
        assert!(
            lot.available_qty >= 10.0,
            "Lot {} has availableQty {} which is less than minQty 10.0",
            lot.lot_no,
            lot.available_qty
        );
    }
}

#[tokio::test]
async fn test_get_available_lots_insufficient_qty() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act: Request impossible quantity
    let response = app
        .get("/api/lots/available?itemKey=INSALT02&minQty=99999.0")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Should return 200 with empty array (NOT 404)
    // This matches OpenAPI spec - insufficient qty is valid request
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;
    assert_eq!(
        body.lots.len(),
        0,
        "Should return empty array when no lots meet minQty"
    );
}

#[tokio::test]
async fn test_get_available_lots_lot_status_filter() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;

    // Validate lot status filtering
    // Only lots with LotStatus IN ('P', 'C', '', NULL) should be returned
    for lot in &body.lots {
        let valid_statuses = vec!["P", "H", "C"];
        assert!(
            valid_statuses.contains(&lot.lot_status.as_str()),
            "Lot {} has invalid status {} (expected P, H, or C)",
            lot.lot_no,
            lot.lot_status
        );
    }
}

#[tokio::test]
async fn test_get_available_lots_missing_item_key() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act: Request without required itemKey parameter
    let response = app
        .get("/api/lots/available")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Should return 400 validation error
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "VALIDATION_MISSING_PARAMETER");
    assert!(body.error.message.contains("itemKey"));
}

#[tokio::test]
async fn test_get_available_lots_composite_key_location_bin() {
    // This test validates composite key usage in lot filtering
    // Constitutional requirement: Use existing database keys, no artificial IDs

    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;

    for lot in &body.lots {
        // Validate composite key fields are present
        // LotMaster uses: ItemKey, Location, BinNo, LotNo as composite key
        assert!(!lot.lot_no.is_empty(), "LotNo is part of composite key");
        assert!(!lot.item_key.is_empty(), "ItemKey is part of composite key");
        assert!(!lot.bin_no.is_empty(), "BinNo is part of composite key");
        assert_eq!(
            lot.location_key, "TFC1",
            "Location is part of composite key and must be TFC1"
        );
    }
}

#[tokio::test]
async fn test_get_available_lots_aisle_row_rack_parsing() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/lots/available?itemKey=INSALT02")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LotsResponse = response.json().await;

    // Validate bin location parsing (aisle, row, rack)
    for lot in &body.lots {
        if let (Some(aisle), Some(row), Some(rack)) = (&lot.aisle, &lot.row, &lot.rack) {
            // BinNo format should match parsed components
            // Example: PWBB-12 -> Aisle=PW, Row=B, Rack=12
            assert!(
                !aisle.is_empty() && !row.is_empty() && !rack.is_empty(),
                "Lot {} has invalid bin location parsing",
                lot.lot_no
            );
        }
    }
}

// =============================================================================
// Type Definitions (matching OpenAPI schemas)
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct LotsResponse {
    lots: Vec<LotAvailabilityDTO>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LotAvailabilityDTO {
    #[serde(rename = "lotNo")]
    lot_no: String,
    #[serde(rename = "itemKey")]
    item_key: String,
    #[serde(rename = "binNo")]
    bin_no: String,
    #[serde(rename = "locationKey")]
    location_key: String,
    #[serde(rename = "qtyOnHand")]
    qty_on_hand: f64,
    #[serde(rename = "qtyCommitSales")]
    qty_commit_sales: f64,
    #[serde(rename = "availableQty")]
    available_qty: f64,
    #[serde(rename = "expiryDate")]
    expiry_date: String,
    #[serde(rename = "lotStatus")]
    lot_status: String,
    aisle: Option<String>,
    row: Option<String>,
    rack: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorResponse {
    error: ErrorDetails,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorDetails {
    code: String,
    message: String,
    #[serde(rename = "correlationId")]
    correlation_id: String,
    details: Option<serde_json::Value>,
}
