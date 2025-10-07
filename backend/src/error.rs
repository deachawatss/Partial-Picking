use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Application error types
#[derive(Debug, Error)]
pub enum AppError {
    // Authentication errors (401)
    #[error("Invalid or expired JWT token")]
    InvalidToken,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("LDAP authentication failed: {0}")]
    LdapAuthFailed(String),

    // Database errors (500)
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Record not found: {0}")]
    RecordNotFound(String),

    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    // Validation errors (400)
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Weight {weight} is outside acceptable range ({low} - {high} KG)")]
    WeightOutOfTolerance { weight: f64, low: f64, high: f64 },

    // Business logic errors (400)
    #[error("Item already picked: {0}")]
    ItemAlreadyPicked(String),

    #[error("Run not complete: {0}")]
    RunNotComplete(String),

    #[error("Insufficient quantity available")]
    InsufficientQuantity,

    // Hardware errors (500)
    #[error("Scale communication error: {0}")]
    ScaleError(String),

    // Generic errors
    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Bad request: {0}")]
    BadRequest(String),
}

/// Error response structure matching OpenAPI spec
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    /// Error code (AUTH_*, DB_*, VALIDATION_*, BUSINESS_*, HARDWARE_*)
    pub code: String,
    /// User-friendly error message
    pub message: String,
    /// Correlation ID for troubleshooting
    #[serde(rename = "correlationId")]
    pub correlation_id: String,
    /// Additional error context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl AppError {
    /// Convert AppError to (StatusCode, ErrorCode, Option<Details>)
    fn to_parts(&self) -> (StatusCode, String, Option<serde_json::Value>) {
        match self {
            // Authentication errors (401)
            AppError::InvalidToken => (
                StatusCode::UNAUTHORIZED,
                "AUTH_INVALID_TOKEN".to_string(),
                None,
            ),
            AppError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "AUTH_INVALID_CREDENTIALS".to_string(),
                None,
            ),
            AppError::LdapAuthFailed(_) => (
                StatusCode::UNAUTHORIZED,
                "AUTH_LDAP_FAILED".to_string(),
                None,
            ),

            // Database errors (500 or 404)
            AppError::DatabaseError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_QUERY_FAILED".to_string(),
                None,
            ),
            AppError::RecordNotFound(entity) => (
                StatusCode::NOT_FOUND,
                "DB_RECORD_NOT_FOUND".to_string(),
                Some(serde_json::json!({ "entity": entity })),
            ),
            AppError::TransactionFailed(phase) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "DB_TRANSACTION_FAILED".to_string(),
                Some(serde_json::json!({ "failedPhase": phase })),
            ),

            // Validation errors (400)
            AppError::ValidationError(_) => (
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR".to_string(),
                None,
            ),
            AppError::WeightOutOfTolerance { weight, low, high } => (
                StatusCode::BAD_REQUEST,
                "VALIDATION_WEIGHT_OUT_OF_TOLERANCE".to_string(),
                Some(serde_json::json!({
                    "weight": weight,
                    "weightRangeLow": low,
                    "weightRangeHigh": high
                })),
            ),

            // Business logic errors (400)
            AppError::ItemAlreadyPicked(item_key) => (
                StatusCode::BAD_REQUEST,
                "BUSINESS_ITEM_ALREADY_PICKED".to_string(),
                Some(serde_json::json!({ "itemKey": item_key })),
            ),
            AppError::RunNotComplete(_) => (
                StatusCode::BAD_REQUEST,
                "BUSINESS_RUN_NOT_COMPLETE".to_string(),
                None,
            ),
            AppError::InsufficientQuantity => (
                StatusCode::BAD_REQUEST,
                "BUSINESS_INSUFFICIENT_QUANTITY".to_string(),
                None,
            ),

            // Hardware errors (500)
            AppError::ScaleError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "HARDWARE_SCALE_ERROR".to_string(),
                None,
            ),

            // Generic errors
            AppError::InternalError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR".to_string(),
                None,
            ),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "BAD_REQUEST".to_string(), None),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let correlation_id = Uuid::new_v4().to_string();
        let message = self.to_string();
        let (status, code, details) = self.to_parts();

        // Log the error with correlation ID
        tracing::error!(
            correlation_id = %correlation_id,
            error_code = %code,
            error = %message,
            "Request failed"
        );

        let error_response = ErrorResponse {
            error: ErrorDetail {
                code,
                message,
                correlation_id,
                details,
            },
        };

        (status, Json(error_response)).into_response()
    }
}

// Conversion from common error types
impl From<tiberius::error::Error> for AppError {
    fn from(err: tiberius::error::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<bb8::RunError<tiberius::error::Error>> for AppError {
    fn from(err: bb8::RunError<tiberius::error::Error>) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<bb8::RunError<bb8_tiberius::Error>> for AppError {
    fn from(err: bb8::RunError<bb8_tiberius::Error>) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(_err: jsonwebtoken::errors::Error) -> Self {
        AppError::InvalidToken
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(err: bcrypt::BcryptError) -> Self {
        AppError::InternalError(format!("Bcrypt error: {}", err))
    }
}

/// Result type alias for application errors
pub type AppResult<T> = Result<T, AppError>;
