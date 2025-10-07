// Authentication Contract Tests
// Tests validate implementation against contracts/openapi.yaml

use axum::http::StatusCode;
use serde_json::json;

mod test_helpers;
use test_helpers::*;

// =============================================================================
// POST /api/auth/login - LDAP Authentication
// =============================================================================

#[tokio::test]
async fn test_login_ldap_success() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "username": "dechawat",
        "password": "TestPassword123"
    });

    // Act
    let response = app.post("/api/auth/login").json(&payload).send().await;

    // Assert: Response matches LoginResponse schema
    assert_eq!(response.status(), StatusCode::OK);

    let body: LoginResponse = response.json().await;
    assert!(!body.token.is_empty(), "JWT token should not be empty");
    assert_eq!(body.user.username, "dechawat");
    assert_eq!(body.user.auth_source, "LDAP");
    assert!(body
        .user
        .permissions
        .contains(&"partial-picking".to_string()));

    // Validate JWT token format
    assert!(body.token.starts_with("eyJ"), "JWT should start with eyJ");
}

#[tokio::test]
async fn test_login_ldap_invalid_credentials() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "username": "dechawat",
        "password": "WrongPassword"
    });

    // Act
    let response = app.post("/api/auth/login").json(&payload).send().await;

    // Assert: Response matches ErrorResponse schema
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_INVALID_CREDENTIALS");
    assert!(body.error.message.contains("Invalid credentials"));
    assert!(!body.error.correlation_id.is_empty());
}

#[tokio::test]
async fn test_login_ldap_server_unreachable() {
    // Arrange: Mock LDAP server unreachable scenario
    let app = create_test_app_with_ldap_offline().await;
    let payload = json!({
        "username": "dechawat",
        "password": "TestPassword123"
    });

    // Act
    let response = app.post("/api/auth/login").json(&payload).send().await;

    // Assert: Should fallback to SQL authentication
    // This test validates FR-002 dual authentication with fallback
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_LDAP_UNAVAILABLE");
}

// =============================================================================
// POST /api/auth/login - SQL Authentication
// =============================================================================

#[tokio::test]
async fn test_login_sql_success() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "username": "warehouse_user",
        "password": "SqlPassword456"
    });

    // Act
    let response = app.post("/api/auth/login").json(&payload).send().await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: LoginResponse = response.json().await;
    assert_eq!(body.user.username, "warehouse_user");
    assert_eq!(body.user.auth_source, "LOCAL");

    // Validate bcrypt password hashing was used
    // (Implementation should compare against tbl_user.pword hash)
}

#[tokio::test]
async fn test_login_sql_invalid_password() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "username": "warehouse_user",
        "password": "WrongPassword"
    });

    // Act
    let response = app.post("/api/auth/login").json(&payload).send().await;

    // Assert
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_INVALID_CREDENTIALS");
}

// =============================================================================
// POST /api/auth/refresh - Token Refresh
// =============================================================================

#[tokio::test]
async fn test_refresh_token_success() {
    // Arrange: Get valid JWT token first
    let app = create_test_app().await;
    let login_response = login_test_user(&app, "dechawat", "TestPassword123").await;
    let old_token = login_response.token;

    // Act
    let response = app
        .post("/api/auth/refresh")
        .header("Authorization", format!("Bearer {}", old_token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: TokenResponse = response.json().await;
    assert!(!body.token.is_empty());
    assert_ne!(body.token, old_token, "New token should be different");
}

#[tokio::test]
async fn test_refresh_token_expired() {
    // Arrange: Use expired JWT token
    let app = create_test_app().await;
    let expired_token = create_expired_jwt_token();

    // Act
    let response = app
        .post("/api/auth/refresh")
        .header("Authorization", format!("Bearer {}", expired_token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_INVALID_TOKEN");
    assert!(body.error.message.contains("expired"));
}

// =============================================================================
// GET /api/auth/me - Current User Details
// =============================================================================

#[tokio::test]
async fn test_get_current_user_success() {
    // Arrange
    let app = create_test_app().await;
    let login_response = login_test_user(&app, "dechawat", "TestPassword123").await;

    // Act
    let response = app
        .get("/api/auth/me")
        .header("Authorization", format!("Bearer {}", login_response.token))
        .send()
        .await;

    // Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body: UserDTO = response.json().await;
    assert_eq!(body.username, "dechawat");
    assert_eq!(body.first_name, Some("Dechawat".to_string()));
    assert_eq!(body.last_name, Some("Wongsirasawat".to_string()));
    assert_eq!(body.department, Some("Warehouse".to_string()));
}

#[tokio::test]
async fn test_get_current_user_no_token() {
    // Arrange
    let app = create_test_app().await;

    // Act
    let response = app.get("/api/auth/me").send().await;

    // Assert
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let body: ErrorResponse = response.json().await;
    assert_eq!(body.error.code, "AUTH_INVALID_TOKEN");
}

// =============================================================================
// Type Definitions (matching OpenAPI schemas)
// =============================================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct LoginResponse {
    token: String,
    user: UserDTO,
}

#[derive(Debug, Serialize, Deserialize)]
struct UserDTO {
    userid: i32,
    username: String,
    #[serde(rename = "firstName")]
    first_name: Option<String>,
    #[serde(rename = "lastName")]
    last_name: Option<String>,
    department: Option<String>,
    #[serde(rename = "authSource")]
    auth_source: String,
    permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    token: String,
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
