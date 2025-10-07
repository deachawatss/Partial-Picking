// Picking Contract Tests
// Tests validate 4-phase atomic transaction implementation

use axum::http::StatusCode;
use serde_json::json;

mod test_helpers;
use test_helpers::*;

// =============================================================================
// POST /api/picks - 4-Phase Atomic Picking Transaction
// =============================================================================

#[tokio::test]
async fn test_save_pick_success_4_phase_atomic() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Setup: Verify initial state before picking
    let initial_lot = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    let initial_commit_sales = initial_lot.qty_commit_sales;

    let payload = json!({
        "runNo": 213996,
        "rowNum": 1,
        "lineId": 1,
        "lotNo": "2510403-1",
        "binNo": "PWBB-12",
        "weight": 20.025,
        "workstationId": "WS3"
    });

    // Act
    let response = app
        .post("/api/picks")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await;

    // Assert: Response matches PickResponse schema
    assert_eq!(response.status(), StatusCode::CREATED);

    let body: PickResponse = response.json().await;
    assert_eq!(body.run_no, 213996);
    assert_eq!(body.item_key, "INSALT02");
    assert_eq!(body.picked_qty, 20.025);
    assert_eq!(body.status, "Allocated");
    assert!(body.lot_tran_no > 0, "LotTransaction should be created");

    // Verify 4-phase transaction results:

    // Phase 1: Cust_PartialLotPicked record created
    let lot_picked = get_partial_lot_picked(&app, 213996, 1, 1).await;
    assert_eq!(lot_picked.lot_no, "2510403-1");
    assert_eq!(lot_picked.bin_no, "PWBB-12");

    // Phase 2: PickedPartialQty updated in cust_PartialPicked
    let pick_item = get_partial_picked(&app, 213996, 1, 1).await;
    assert_eq!(pick_item.picked_partial_qty, 20.025);
    assert_eq!(pick_item.item_batch_status, Some("Allocated".to_string()));
    assert!(pick_item.picking_date.is_some());
    assert_eq!(pick_item.modified_by, Some("WS3".to_string()));

    // Phase 3: LotTransaction record created with TransactionType=5
    let lot_txn = get_lot_transaction(&app, body.lot_tran_no).await;
    assert_eq!(lot_txn.transaction_type, 5);
    assert_eq!(lot_txn.qty_issued, 20.025);
    assert_eq!(lot_txn.rec_userid, Some("WS3".to_string()));
    assert_eq!(lot_txn.processed, "N");
    assert_eq!(lot_txn.user5, Some("Picking Customization".to_string()));

    // Phase 4: LotMaster.QtyCommitSales incremented
    let updated_lot = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    assert_eq!(
        updated_lot.qty_commit_sales,
        initial_commit_sales + 20.025,
        "QtyCommitSales should increment by picked weight"
    );
}

#[tokio::test]
async fn test_save_pick_weight_out_of_tolerance() {
    // Arrange
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Target: 20.00 KG, Tolerance: ±0.025 KG
    // Valid range: 19.975 - 20.025 KG
    // Test weight: 20.5 KG (OUT OF RANGE)

    let payload = json!({
        "runNo": 213996,
        "rowNum": 1,
        "lineId": 1,
        "lotNo": "2510403-1",
        "binNo": "PWBB-12",
        "weight": 20.5,  // Out of tolerance
        "workstationId": "WS3"
    });

    // Act
    let response = app
        .post("/api/picks")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await;

    // Assert: Validation error
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "VALIDATION_WEIGHT_OUT_OF_TOLERANCE");
    assert!(body.error.message.contains("outside acceptable range"));

    // Verify details include weight range
    let details = body.error.details.unwrap();
    assert_eq!(details["weight"], 20.5);
    assert_eq!(details["weightRangeLow"], 19.975);
    assert_eq!(details["weightRangeHigh"], 20.025);
}

#[tokio::test]
async fn test_save_pick_item_already_picked() {
    // Arrange: Pick item first time
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    let payload = json!({
        "runNo": 213996,
        "rowNum": 1,
        "lineId": 1,
        "lotNo": "2510403-1",
        "binNo": "PWBB-12",
        "weight": 20.025,
        "workstationId": "WS3"
    });

    app.post("/api/picks")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await;

    // Act: Try to pick same item again
    let response = app
        .post("/api/picks")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await;

    // Assert: Business rule violation
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "BUSINESS_ITEM_ALREADY_PICKED");
    assert!(body.error.message.contains("already picked"));
}

#[tokio::test]
async fn test_save_pick_transaction_rollback_on_phase_failure() {
    // Arrange: Simulate database failure during Phase 3 (LotTransaction)
    let app = create_test_app_with_txn_failure_at_phase(3).await;
    let token = get_test_auth_token(&app).await;

    let payload = json!({
        "runNo": 213996,
        "rowNum": 1,
        "lineId": 1,
        "lotNo": "2510403-1",
        "binNo": "PWBB-12",
        "weight": 20.025,
        "workstationId": "WS3"
    });

    // Get initial state
    let initial_lot = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    let initial_commit_sales = initial_lot.qty_commit_sales;

    // Act
    let response = app
        .post("/api/picks")
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await;

    // Assert: Transaction failed
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "DB_TRANSACTION_FAILED");

    // Verify rollback: All phases should be rolled back
    // Phase 1 rollback: No Cust_PartialLotPicked record
    assert!(get_partial_lot_picked_optional(&app, 213996, 1, 1)
        .await
        .is_none());

    // Phase 2 rollback: PickedPartialQty still 0
    let pick_item = get_partial_picked(&app, 213996, 1, 1).await;
    assert_eq!(pick_item.picked_partial_qty, 0.0);
    assert!(pick_item.item_batch_status.is_none());

    // Phase 4 rollback: QtyCommitSales unchanged
    let final_lot = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    assert_eq!(
        final_lot.qty_commit_sales, initial_commit_sales,
        "QtyCommitSales should be rolled back"
    );
}

// =============================================================================
// DELETE /api/picks/{runNo}/{rowNum}/{lineId} - Unpick/Delete
// =============================================================================

#[tokio::test]
async fn test_unpick_item_success() {
    // Arrange: Pick item first
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    pick_item(&app, &token, 213996, 1, 1, "2510403-1", "PWBB-12", 20.025).await;

    // Get state after picking
    let lot_before_unpick = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    let commit_sales_before = lot_before_unpick.qty_commit_sales;

    // Act: Unpick
    let response = app
        .delete("/api/picks/213996/1/1")
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "workstationId": "WS3" }))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    // Verify unpick results:

    // PickedPartialQty reset to 0
    let pick_item = get_partial_picked(&app, 213996, 1, 1).await;
    assert_eq!(pick_item.picked_partial_qty, 0.0);

    // Audit trail preserved
    assert_eq!(pick_item.item_batch_status, Some("Allocated".to_string()));
    assert!(pick_item.picking_date.is_some());
    assert_eq!(pick_item.modified_by, Some("WS3".to_string()));

    // Cust_PartialLotPicked records deleted
    assert!(get_partial_lot_picked_optional(&app, 213996, 1, 1)
        .await
        .is_none());

    // LotTransaction records deleted
    // (Implementation detail: may soft-delete with Processed='D' instead)

    // QtyCommitSales decremented
    let lot_after_unpick = get_lot_master(&app, "2510403-1", "INSALT02", "TFC1", "PWBB-12").await;
    assert_eq!(
        lot_after_unpick.qty_commit_sales,
        commit_sales_before - 20.025,
        "QtyCommitSales should decrement by unpicked weight"
    );
}

#[tokio::test]
async fn test_unpick_item_not_picked() {
    // Arrange: Item never picked
    let app = create_test_app().await;
    let token = get_test_auth_token(&app).await;

    // Act: Try to unpick unpicked item
    let response = app
        .delete("/api/picks/213996/1/2")
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "workstationId": "WS3" }))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "BUSINESS_ITEM_NOT_PICKED");
}

// =============================================================================
// Type Definitions
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct PickResponse {
    #[serde(rename = "runNo")]
    run_no: i32,
    #[serde(rename = "rowNum")]
    row_num: i32,
    #[serde(rename = "lineId")]
    line_id: i32,
    #[serde(rename = "itemKey")]
    item_key: String,
    #[serde(rename = "lotNo")]
    lot_no: String,
    #[serde(rename = "binNo")]
    bin_no: String,
    #[serde(rename = "pickedQty")]
    picked_qty: f64,
    #[serde(rename = "targetQty")]
    target_qty: f64,
    status: String,
    #[serde(rename = "pickingDate")]
    picking_date: String,
    #[serde(rename = "lotTranNo")]
    lot_tran_no: i32,
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

// Database entity types for verification
#[derive(Debug)]
struct LotMaster {
    qty_commit_sales: f64,
}

#[derive(Debug)]
struct PartialPicked {
    picked_partial_qty: f64,
    item_batch_status: Option<String>,
    picking_date: Option<String>,
    modified_by: Option<String>,
}

#[derive(Debug)]
struct PartialLotPicked {
    lot_no: String,
    bin_no: String,
}

#[derive(Debug)]
struct LotTransaction {
    transaction_type: i32,
    qty_issued: f64,
    rec_userid: Option<String>,
    processed: String,
    user5: Option<String>,
}
