use crate::config::Config;
use crate::error::{AppError, AppResult};
use crate::models::user::User;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT Claims structure matching OpenAPI spec
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Subject (user ID)
    pub sub: String,

    /// Username
    pub username: String,

    /// First name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,

    /// Last name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,

    /// Department
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    /// Authentication source (LOCAL or LDAP)
    pub auth_source: String,

    /// Permissions array
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,

    /// Issued at (UNIX timestamp)
    pub iat: i64,

    /// Expiration (UNIX timestamp)
    pub exp: i64,

    /// Issuer
    pub iss: String,
}

/// Generate JWT token for authenticated user
///
/// # Arguments
/// * `user` - Authenticated user from database
/// * `config` - Application configuration (contains JWT secret and duration)
///
/// # Returns
/// * JWT token string valid for JWT_DURATION_HOURS (default: 168 hours / 7 days)
///
/// # Example
/// ```rust
/// let token = generate_token(&user, &config)?;
/// // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
/// ```
pub fn generate_token(user: &User, config: &Config) -> AppResult<String> {
    let now = Utc::now();
    let expiration = now + Duration::hours(config.jwt_duration_hours);

    // Parse permissions from comma-separated string
    let permissions = user.app_permissions.as_ref().map(|perms| {
        perms
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let claims = JwtClaims {
        sub: user.userid.to_string(),
        username: user.uname.clone(),
        first_name: user.fname.clone(),
        last_name: user.lname.clone(),
        department: user.department.clone(),
        auth_source: format!("{:?}", user.auth_source).to_uppercase(),
        permissions,
        iat: now.timestamp(),
        exp: expiration.timestamp(),
        iss: config.jwt_issuer.clone(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalError(format!("Failed to generate token: {}", e)))?;

    tracing::debug!(
        user_id = user.userid,
        username = %user.uname,
        auth_source = %user.auth_source,
        expires_at = %expiration,
        "Generated JWT token"
    );

    Ok(token)
}

/// Validate JWT token and extract claims
///
/// # Arguments
/// * `token` - JWT token string (without "Bearer " prefix)
/// * `config` - Application configuration (contains JWT secret for validation)
///
/// # Returns
/// * Validated JwtClaims if token is valid and not expired
/// * AppError::InvalidToken if token is invalid, expired, or malformed
///
/// # Example
/// ```rust
/// let claims = validate_token("eyJhbGci...", &config)?;
/// println!("User: {}", claims.username);
/// ```
pub fn validate_token(token: &str, config: &Config) -> AppResult<JwtClaims> {
    let mut validation = Validation::default();
    validation.set_issuer(&[&config.jwt_issuer]);

    let token_data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|e| {
        tracing::warn!(error = %e, "Token validation failed");
        AppError::InvalidToken
    })?;

    tracing::debug!(
        user_id = %token_data.claims.sub,
        username = %token_data.claims.username,
        "Token validated successfully"
    );

    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::user::AuthSource;

    fn create_test_config() -> Config {
        Config {
            server_port: 7075,
            cors_allowed_origins: vec![],
            database_server: "localhost".to_string(),
            database_port: 1433,
            database_name: "test".to_string(),
            database_user: "test".to_string(),
            database_password: "test".to_string(),
            database_max_connections: 10,
            database_min_connections: 2,
            database_connection_timeout_secs: 30,
            ldap_url: "ldap://localhost".to_string(),
            ldap_base_dn: "DC=test,DC=com".to_string(),
            ldap_domain: "test.com".to_string(),
            ldap_timeout_secs: 5,
            jwt_secret: "test-secret-key".to_string(),
            jwt_duration_hours: 168,
            jwt_issuer: "test-issuer".to_string(),
            enable_ldap_auth: true,
            enable_sql_auth: true,
            enable_request_logging: true,
            log_level: "info".to_string(),
            app_name: "Test".to_string(),
            app_version: "1.0.0".to_string(),
            company_name: "Test".to_string(),
        }
    }

    fn create_test_user() -> User {
        User {
            userid: 42,
            uname: "test_user".to_string(),
            fname: Some("Test".to_string()),
            lname: Some("User".to_string()),
            email: Some("test@example.com".to_string()),
            department: Some("Warehouse".to_string()),
            auth_source: AuthSource::Ldap,
            ldap_username: Some("test_user".to_string()),
            ldap_dn: Some("CN=Test User,OU=Users,DC=test,DC=com".to_string()),
            last_ldap_sync: None,
            ad_enabled: true,
            app_permissions: Some("putaway,picking,partial-picking".to_string()),
            pword: None,
            created_at: None,
        }
    }

    #[test]
    fn test_generate_and_validate_token() {
        let config = create_test_config();
        let user = create_test_user();

        // Generate token
        let token = generate_token(&user, &config).expect("Failed to generate token");
        assert!(!token.is_empty());

        // Validate token
        let claims = validate_token(&token, &config).expect("Failed to validate token");
        assert_eq!(claims.username, user.uname);
        assert_eq!(claims.sub, user.userid.to_string());
        assert_eq!(claims.auth_source, "LDAP");
        assert_eq!(claims.iss, config.jwt_issuer);

        // Check permissions parsing
        let permissions = claims.permissions.expect("Permissions should be present");
        assert_eq!(permissions.len(), 3);
        assert!(permissions.contains(&"putaway".to_string()));
        assert!(permissions.contains(&"picking".to_string()));
        assert!(permissions.contains(&"partial-picking".to_string()));
    }

    #[test]
    fn test_invalid_token() {
        let config = create_test_config();
        let result = validate_token("invalid.token.here", &config);
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_secret() {
        let mut config1 = create_test_config();
        config1.jwt_secret = "secret1".to_string();

        let mut config2 = create_test_config();
        config2.jwt_secret = "secret2".to_string();

        let user = create_test_user();
        let token = generate_token(&user, &config1).expect("Failed to generate token");

        // Validation with different secret should fail
        let result = validate_token(&token, &config2);
        assert!(result.is_err());
    }
}
