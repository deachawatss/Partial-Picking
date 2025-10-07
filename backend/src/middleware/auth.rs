use crate::config::Config;
use crate::error::{AppError, AppResult};
use crate::utils::jwt::{validate_token, JwtClaims};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts},
};

/// JWT authentication extractor
///
/// Use this in endpoint handlers to enforce JWT authentication:
///
/// ```rust
/// async fn protected_endpoint(
///     AuthUser(claims): AuthUser,
/// ) -> Result<Json<Response>, AppError> {
///     println!("Authenticated user: {}", claims.username);
///     Ok(Json(response))
/// }
/// ```
///
/// The extractor will:
/// 1. Extract the "Authorization: Bearer <token>" header
/// 2. Validate the JWT token
/// 3. Return 401 if token is missing, invalid, or expired
/// 4. Inject JwtClaims into the handler if valid
#[derive(Debug, Clone)]
pub struct AuthUser(pub JwtClaims);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> AppResult<Self> {
        // Extract Authorization header
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| {
                tracing::warn!("Missing Authorization header");
                AppError::InvalidToken
            })?;

        // Extract token from "Bearer <token>" format
        let token = auth_header.strip_prefix("Bearer ").ok_or_else(|| {
            tracing::warn!("Invalid Authorization header format (expected 'Bearer <token>')");
            AppError::InvalidToken
        })?;

        // Get config from request extensions
        // Note: Config must be added to router state or request extensions
        let config = parts.extensions.get::<Config>().ok_or_else(|| {
            tracing::error!("Config not found in request extensions");
            AppError::InternalError("Server configuration error".to_string())
        })?;

        // Validate JWT token
        let claims = validate_token(token, config)?;

        tracing::debug!(
            user_id = %claims.sub,
            username = %claims.username,
            auth_source = %claims.auth_source,
            "Request authenticated"
        );

        Ok(AuthUser(claims))
    }
}

/// Extract Config from router state
///
/// This extractor allows endpoints to access configuration without AuthUser.
/// Used for non-authenticated endpoints like login.
#[derive(Clone)]
pub struct AppConfig(pub Config);

#[async_trait]
impl<S> FromRequestParts<S> for AppConfig
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> AppResult<Self> {
        let config = parts
            .extensions
            .get::<Config>()
            .ok_or_else(|| {
                tracing::error!("Config not found in request extensions");
                AppError::InternalError("Server configuration error".to_string())
            })?
            .clone();

        Ok(AppConfig(config))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::user::{AuthSource, User};
    use crate::utils::jwt::generate_token;
    use axum::http::{HeaderMap, Request};

    fn create_test_config() -> Config {
        Config {
            server_host: "localhost".to_string(),
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
            ldap_enabled: true,
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
            workstation_id: None,
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
            ldap_dn: None,
            last_ldap_sync: None,
            ad_enabled: true,
            app_permissions: Some("putaway,picking,partial-picking".to_string()),
            pword: None,
            created_at: None,
        }
    }

    #[tokio::test]
    async fn test_auth_user_extractor_valid_token() {
        let config = create_test_config();
        let user = create_test_user();
        let token = generate_token(&user, &config).expect("Failed to generate token");

        let mut parts = Parts::default();
        parts.headers.insert(
            header::AUTHORIZATION,
            format!("Bearer {}", token).parse().unwrap(),
        );
        parts.extensions.insert(config);

        let result = AuthUser::from_request_parts(&mut parts, &()).await;
        assert!(result.is_ok());

        let AuthUser(claims) = result.unwrap();
        assert_eq!(claims.username, "test_user");
        assert_eq!(claims.sub, "42");
    }

    #[tokio::test]
    async fn test_auth_user_extractor_missing_header() {
        let config = create_test_config();
        let mut parts = Parts::default();
        parts.extensions.insert(config);

        let result = AuthUser::from_request_parts(&mut parts, &()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_auth_user_extractor_invalid_format() {
        let config = create_test_config();
        let mut parts = Parts::default();
        parts.headers.insert(
            header::AUTHORIZATION,
            "InvalidFormat token123".parse().unwrap(),
        );
        parts.extensions.insert(config);

        let result = AuthUser::from_request_parts(&mut parts, &()).await;
        assert!(result.is_err());
    }
}
