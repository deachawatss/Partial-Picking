use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::middleware::auth::{AppConfig, AuthUser};
use crate::models::user::User;
use crate::services::auth_service;
use crate::utils::jwt::generate_token;
use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

// ============================================================================
// REQUEST/RESPONSE DTOs (matching OpenAPI spec)
// ============================================================================

/// Login request body (OpenAPI: LoginRequest)
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    /// Username (LDAP or SQL)
    #[serde(rename = "username")]
    pub username: String,

    /// Plain text password
    #[serde(rename = "password")]
    pub password: String,
}

/// Login response (OpenAPI: LoginResponse)
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    /// JWT token (168-hour expiration)
    pub token: String,

    /// User details
    pub user: UserDTO,
}

/// User DTO for responses (OpenAPI: UserDTO)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDTO {
    pub userid: i32,
    pub username: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    pub auth_source: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
}

/// Token refresh response
#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    /// New JWT token
    pub token: String,
}

// ============================================================================
// API ENDPOINT HANDLERS (T050)
// ============================================================================

/// POST /api/auth/login - Authenticate user with LDAP or SQL credentials
///
/// # T050.1: Login Endpoint
///
/// Implements dual authentication flow from OpenAPI spec:
/// 1. Call `auth_service::authenticate()` (dual strategy)
/// 2. Generate JWT token with 168-hour expiration
/// 3. Return LoginResponse with token and user details
///
/// # Request Body
/// ```json
/// {
///   "username": "dechawat",
///   "password": "P@ssw0rd123"
/// }
/// ```
///
/// # Response (200 OK)
/// ```json
/// {
///   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
///   "user": {
///     "userid": 42,
///     "username": "dechawat",
///     "firstName": "Dechawat",
///     "lastName": "Wongsirasawat",
///     "department": "Warehouse",
///     "authSource": "LDAP",
///     "permissions": ["putaway", "picking", "partial-picking"]
///   }
/// }
/// ```
///
/// # Error Responses
/// - 401 Unauthorized: Invalid credentials (AUTH_INVALID_CREDENTIALS)
/// - 500 Internal Server Error: LDAP server unreachable, database error
pub async fn login_endpoint(
    State(pool): State<DbPool>,
    AppConfig(config): AppConfig,
    Json(request): Json<LoginRequest>,
) -> AppResult<(StatusCode, Json<LoginResponse>)> {
    tracing::info!(username = %request.username, "Login request received");

    // Validate request
    if request.username.is_empty() {
        tracing::warn!("Login attempt with empty username");
        return Err(AppError::ValidationError(
            "Username is required".to_string(),
        ));
    }

    if request.password.is_empty() {
        tracing::warn!(username = %request.username, "Login attempt with empty password");
        return Err(AppError::ValidationError(
            "Password is required".to_string(),
        ));
    }

    // Authenticate user (dual strategy: LDAP primary, SQL fallback)
    let user = match auth_service::authenticate(&request.username, &request.password, &config, &pool).await {
        Ok(user) => user,
        Err(e) => {
            // Log authentication failure with context
            match &e {
                AppError::InvalidCredentials => {
                    tracing::warn!(
                        username = %request.username,
                        "Login failed: Invalid credentials (both LDAP and SQL authentication failed)"
                    );
                }
                AppError::LdapAuthFailed(msg) => {
                    tracing::error!(
                        username = %request.username,
                        error = %msg,
                        "Login failed: LDAP server unreachable"
                    );
                }
                _ => {
                    tracing::error!(
                        username = %request.username,
                        error = ?e,
                        "Login failed: Unexpected authentication error"
                    );
                }
            }
            return Err(e);
        }
    };

    // Generate JWT token
    let token = generate_token(&user, &config)?;

    // Build response
    let response = LoginResponse {
        token,
        user: user_to_dto(&user),
    };

    tracing::info!(
        username = %request.username,
        user_id = user.userid,
        auth_source = %user.auth_source,
        "Login successful"
    );

    Ok((StatusCode::OK, Json(response)))
}

/// POST /api/auth/refresh - Refresh JWT token
///
/// # T050.2: Refresh Token Endpoint
///
/// Validates existing JWT token and generates new token with extended expiration.
///
/// # Request Headers
/// ```
/// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
/// ```
///
/// # Response (200 OK)
/// ```json
/// {
///   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
/// }
/// ```
///
/// # Error Responses
/// - 401 Unauthorized: Invalid or expired token (AUTH_INVALID_TOKEN)
pub async fn refresh_token_endpoint(
    State(pool): State<DbPool>,
    AppConfig(config): AppConfig,
    AuthUser(claims): AuthUser,
) -> AppResult<(StatusCode, Json<RefreshResponse>)> {
    tracing::info!(
        user_id = %claims.sub,
        username = %claims.username,
        "Token refresh request received"
    );

    // AuthUser extractor already validated the token
    // Now we need to fetch fresh user data and generate new token

    let mut conn = pool.get().await?;

    // Fetch user from database to ensure they still exist and are active
    let user_id: i32 = claims.sub.parse().map_err(|_| AppError::InvalidToken)?;

    let mut query = tiberius::Query::new(
        r#"
        SELECT
            userid, uname, Fname, Lname, email, department,
            auth_source, ldap_username, ldap_dn, last_ldap_sync,
            ad_enabled, app_permissions, pword, created_at
        FROM dbo.tbl_user
        WHERE userid = @P1
    "#,
    );
    query.bind(user_id);

    let row: Option<tiberius::Row> = query.query(&mut conn).await?.into_row().await?;

    let row = row.ok_or_else(|| {
        tracing::warn!(user_id = user_id, "User not found during token refresh");
        AppError::InvalidToken
    })?;

    // Parse user from database row
    let user = User {
        userid: row.get::<i32, _>("userid").unwrap(),
        uname: row.get::<&str, _>("uname").unwrap().to_string(),
        fname: row.get::<&str, _>("Fname").map(|s| s.to_string()),
        lname: row.get::<&str, _>("Lname").map(|s| s.to_string()),
        email: row.get::<&str, _>("email").map(|s| s.to_string()),
        department: row.get::<&str, _>("department").map(|s| s.to_string()),
        auth_source: match row.get::<&str, _>("auth_source").unwrap_or("LOCAL") {
            "LDAP" => crate::models::user::AuthSource::Ldap,
            _ => crate::models::user::AuthSource::Local,
        },
        ldap_username: row.get::<&str, _>("ldap_username").map(|s| s.to_string()),
        ldap_dn: row.get::<&str, _>("ldap_dn").map(|s| s.to_string()),
        last_ldap_sync: row.get("last_ldap_sync"),
        ad_enabled: row.get::<bool, _>("ad_enabled").unwrap_or(true),
        app_permissions: row.get::<&str, _>("app_permissions").map(|s| s.to_string()),
        pword: None, // Never return password hash
        created_at: row.get("created_at"),
    };

    // Check if user is still active
    if !user.ad_enabled {
        tracing::warn!(
            user_id = user.userid,
            username = %user.uname,
            "User account is disabled"
        );
        return Err(AppError::InvalidToken);
    }

    // Generate new JWT token
    let token = generate_token(&user, &config)?;

    tracing::info!(
        user_id = user.userid,
        username = %user.uname,
        "Token refreshed successfully"
    );

    Ok((StatusCode::OK, Json(RefreshResponse { token })))
}

/// GET /api/auth/me - Get current user details
///
/// # T050.3: Get Current User Endpoint
///
/// Retrieves authenticated user information from JWT token.
///
/// # Request Headers
/// ```
/// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
/// ```
///
/// # Response (200 OK)
/// ```json
/// {
///   "userid": 42,
///   "username": "dechawat",
///   "firstName": "Dechawat",
///   "lastName": "Wongsirasawat",
///   "department": "Warehouse",
///   "authSource": "LDAP",
///   "permissions": ["putaway", "picking", "partial-picking"]
/// }
/// ```
///
/// # Error Responses
/// - 401 Unauthorized: Invalid or expired token (AUTH_INVALID_TOKEN)
pub async fn get_current_user_endpoint(
    AuthUser(claims): AuthUser,
) -> AppResult<(StatusCode, Json<UserDTO>)> {
    tracing::debug!(
        user_id = %claims.sub,
        username = %claims.username,
        "Get current user request"
    );

    // Build UserDTO from JWT claims
    let user_dto = UserDTO {
        userid: claims.sub.parse().unwrap_or(0),
        username: claims.username,
        first_name: claims.first_name,
        last_name: claims.last_name,
        department: claims.department,
        auth_source: claims.auth_source,
        permissions: claims.permissions,
    };

    Ok((StatusCode::OK, Json(user_dto)))
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Convert User entity to UserDTO for API responses
fn user_to_dto(user: &User) -> UserDTO {
    // Parse permissions from comma-separated string
    let permissions = user.app_permissions.as_ref().map(|perms| {
        perms
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    UserDTO {
        userid: user.userid,
        username: user.uname.clone(),
        first_name: user.fname.clone(),
        last_name: user.lname.clone(),
        department: user.department.clone(),
        auth_source: format!("{}", user.auth_source), // "LOCAL" or "LDAP"
        permissions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::user::AuthSource;

    #[test]
    fn test_user_to_dto_conversion() {
        let user = User {
            userid: 42,
            uname: "test_user".to_string(),
            fname: Some("Test".to_string()),
            lname: Some("User".to_string()),
            email: Some("test@example.com".to_string()),
            department: Some("Warehouse".to_string()),
            auth_source: AuthSource::Ldap,
            ldap_username: Some("test_user".to_string()),
            ldap_dn: None,
            last_ldap_sync: None,
            ad_enabled: true,
            app_permissions: Some("putaway,picking,partial-picking".to_string()),
            pword: None,
            created_at: None,
        };

        let dto = user_to_dto(&user);

        assert_eq!(dto.userid, 42);
        assert_eq!(dto.username, "test_user");
        assert_eq!(dto.first_name, Some("Test".to_string()));
        assert_eq!(dto.last_name, Some("User".to_string()));
        assert_eq!(dto.department, Some("Warehouse".to_string()));
        assert_eq!(dto.auth_source, "LDAP");

        let permissions = dto.permissions.unwrap();
        assert_eq!(permissions.len(), 3);
        assert!(permissions.contains(&"putaway".to_string()));
        assert!(permissions.contains(&"picking".to_string()));
        assert!(permissions.contains(&"partial-picking".to_string()));
    }

    #[test]
    fn test_user_to_dto_no_permissions() {
        let user = User {
            userid: 1,
            uname: "basic_user".to_string(),
            fname: None,
            lname: None,
            email: None,
            department: None,
            auth_source: AuthSource::Local,
            ldap_username: None,
            ldap_dn: None,
            last_ldap_sync: None,
            ad_enabled: true,
            app_permissions: None,
            pword: Some("hashed_password".to_string()),
            created_at: None,
        };

        let dto = user_to_dto(&user);

        assert_eq!(dto.userid, 1);
        assert_eq!(dto.username, "basic_user");
        assert_eq!(dto.auth_source, "LOCAL");
        assert!(dto.permissions.is_none());
    }
}
