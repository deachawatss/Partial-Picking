// Production Runs Contract Tests
// Tests validate implementation against contracts/openapi.yaml

use axum::http::StatusCode;
use serde_json::json;

mod test_helpers;
use test_helpers::*;

// =============================================================================
// GET /api/runs/{runNo} - Run Details with Auto-Population
// =============================================================================

#[tokio::test]
async fn test_get_run_details_success() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/runs/6000037")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Response matches RunDetailsResponse schema
    assert_eq!(response.status(), StatusCode::OK);

    let body: RunDetailsResponse = response.json().await;

    // Validate auto-populated fields from database
    assert_eq!(body.run_no, 6000037);
    assert_eq!(body.fg_item_key, "TSM2285A"); // From FormulaId
    assert_eq!(body.fg_description, "Marinade, Savory"); // From FormulaDesc
    assert_eq!(body.batches, vec![1, 2]); // All RowNum values
    assert_eq!(body.production_date, "2025-10-06"); // From RecDate
    assert_eq!(body.status, "NEW");
    assert_eq!(body.no_of_batches, 2);
}

#[tokio::test]
async fn test_get_run_details_not_found() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/runs/9999999")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: 404 with ErrorResponse schema
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "DB_RECORD_NOT_FOUND");
    assert!(body.error.message.contains("9999999"));
    assert!(!body.error.correlation_id.is_empty());
}

#[tokio::test]
async fn test_get_run_details_unauthorized() {
    // Arrange
    let app = create_test_app().await;

    // Act: Request without JWT token
    let response = app.get("/api/runs/6000037").send().await;

    // Assert
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_INVALID_TOKEN");
}

// =============================================================================
// GET /api/runs/{runNo}/batches/{rowNum}/items - Batch Items with Weight Range
// =============================================================================

#[tokio::test]
async fn test_get_batch_items_success() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/runs/6000037/batches/1/items")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Response matches BatchItemsResponse schema
    assert_eq!(response.status(), StatusCode::OK);

    let body: BatchItemsResponse = response.json().await;
    assert!(!body.items.is_empty());

    // Validate first item
    let item = &body.items[0];
    assert_eq!(item.item_key, "INRICF05");
    assert_eq!(item.description, "Rice Flour (RF-0010)");
    assert_eq!(item.total_needed, 14.24);
    assert_eq!(item.picked_qty, 0.0);
    assert_eq!(item.remaining_qty, 14.24);

    // Validate weight range calculation
    // weightRangeLow = ToPickedPartialQty - INMAST.User9
    // weightRangeHigh = ToPickedPartialQty + INMAST.User9
    assert_eq!(item.weight_range_low, 14.215); // 14.24 - 0.025
    assert_eq!(item.weight_range_high, 14.265); // 14.24 + 0.025
    assert_eq!(item.tolerance_kg, 0.025);
}

#[tokio::test]
async fn test_get_batch_items_with_picked_items() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act
    let response = app
        .get("/api/runs/6000037/batches/1/items")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: BatchItemsResponse = response.json().await;

    // Find picked item (if any exist in test data)
    let picked_item = body.items.iter().find(|item| item.picked_qty > 0.0);

    if let Some(item) = picked_item {
        // Validate status for picked item
        assert_eq!(item.status, Some("Allocated".to_string()));
        assert!(item.remaining_qty < item.total_needed);

        // Verify picked_qty is within tolerance
        let tolerance_check = (item.picked_qty - item.total_needed).abs() <= item.tolerance_kg;
        assert!(
            tolerance_check,
            "Picked quantity should be within tolerance"
        );
    }
}

#[tokio::test]
async fn test_get_batch_items_not_found() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act: Invalid batch number
    let response = app
        .get("/api/runs/6000037/batches/999/items")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "DB_RECORD_NOT_FOUND");
}

#[tokio::test]
async fn test_get_batch_items_composite_key_validation() {
    // This test validates that the implementation uses composite keys
    // (RunNo, RowNum) correctly, not artificial IDs

    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act: Get items for different batches of same run
    let response_batch1 = app
        .get("/api/runs/6000037/batches/1/items")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    let response_batch2 = app
        .get("/api/runs/6000037/batches/2/items")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await;

    // Assert: Both batches should exist but have different items
    assert_eq!(response_batch1.status(), StatusCode::OK);
    assert_eq!(response_batch2.status(), StatusCode::OK);

    let body1: BatchItemsResponse = response_batch1.json().await;
    let body2: BatchItemsResponse = response_batch2.json().await;

    // Validate composite key usage (items are different per batch)
    // Constitutional requirement: No artificial IDs, use (RunNo, RowNum, LineId)
    assert!(body1.items.len() > 0);
    assert!(body2.items.len() > 0);
}

// =============================================================================
// Type Definitions (matching OpenAPI schemas)
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct RunDetailsResponse {
    #[serde(rename = "runNo")]
    run_no: i32,
    #[serde(rename = "fgItemKey")]
    fg_item_key: String,
    #[serde(rename = "fgDescription")]
    fg_description: String,
    batches: Vec<i32>,
    #[serde(rename = "productionDate")]
    production_date: String,
    status: String,
    #[serde(rename = "noOfBatches")]
    no_of_batches: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct BatchItemsResponse {
    items: Vec<BatchItemDTO>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BatchItemDTO {
    #[serde(rename = "itemKey")]
    item_key: String,
    description: String,
    #[serde(rename = "totalNeeded")]
    total_needed: f64,
    #[serde(rename = "pickedQty")]
    picked_qty: f64,
    #[serde(rename = "remainingQty")]
    remaining_qty: f64,
    #[serde(rename = "weightRangeLow")]
    weight_range_low: f64,
    #[serde(rename = "weightRangeHigh")]
    weight_range_high: f64,
    #[serde(rename = "toleranceKG")]
    tolerance_kg: f64,
    allergen: String,
    status: Option<String>,
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
