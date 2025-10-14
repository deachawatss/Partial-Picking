use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // Server configuration
    pub server_port: u16,
    pub cors_allowed_origins: Vec<String>,

    // Database configuration
    pub database_server: String,
    pub database_port: u16,
    pub database_name: String,
    pub database_user: String,
    pub database_password: String,
    pub database_max_connections: u32,
    pub database_min_connections: u32,
    pub database_connection_timeout_secs: u64,

    // LDAP configuration
    pub ldap_url: String,
    pub ldap_base_dn: String,
    pub ldap_domain: String,
    pub ldap_timeout_secs: u64,

    // JWT configuration
    pub jwt_secret: String,
    pub jwt_duration_hours: i64,
    pub jwt_issuer: String,

    // Authentication feature flags
    pub enable_ldap_auth: bool,
    pub enable_sql_auth: bool,

    // Logging
    pub enable_request_logging: bool,
    pub log_level: String,

    // Application info
    pub app_name: String,
    pub app_version: String,
    pub company_name: String,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        // Load .env file if present
        dotenvy::dotenv().ok();

        Ok(Self {
            // Server configuration
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "7075".to_string())
                .parse()
                .expect("SERVER_PORT must be a valid port number"),
            cors_allowed_origins: env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:6060,http://localhost:6061".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),

            // Database configuration
            database_server: env::var("DATABASE_SERVER")?,
            database_port: env::var("DATABASE_PORT")
                .unwrap_or_else(|_| "49381".to_string())
                .parse()
                .expect("DATABASE_PORT must be a valid port number"),
            database_name: env::var("DATABASE_NAME")?,
            database_user: env::var("DATABASE_USER")?,
            database_password: env::var("DATABASE_PASSWORD")?,
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .expect("DATABASE_MAX_CONNECTIONS must be a valid number"),
            database_min_connections: env::var("DATABASE_MIN_CONNECTIONS")
                .unwrap_or_else(|_| "2".to_string())
                .parse()
                .expect("DATABASE_MIN_CONNECTIONS must be a valid number"),
            database_connection_timeout_secs: env::var("DATABASE_CONNECTION_TIMEOUT_SECS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .expect("DATABASE_CONNECTION_TIMEOUT_SECS must be a valid number"),

            // LDAP configuration
            ldap_url: env::var("LDAP_URL")?,
            ldap_base_dn: env::var("LDAP_BASE_DN")
                .unwrap_or_else(|_| "DC=NWFTH,DC=com".to_string()),
            ldap_domain: env::var("LDAP_DOMAIN").unwrap_or_else(|_| "NWFTH.com".to_string()),
            ldap_timeout_secs: env::var("LDAP_TIMEOUT_SECS")
                .unwrap_or_else(|_| "5".to_string())
                .parse()
                .expect("LDAP_TIMEOUT_SECS must be a valid number"),

            // JWT configuration
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_duration_hours: env::var("JWT_DURATION_HOURS")
                .unwrap_or_else(|_| "168".to_string())
                .parse()
                .expect("JWT_DURATION_HOURS must be a valid number"),
            jwt_issuer: env::var("JWT_ISSUER")
                .unwrap_or_else(|_| "NWFTH-PartialPicking".to_string()),

            // Authentication feature flags
            enable_ldap_auth: env::var("ENABLE_LDAP_AUTH")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            enable_sql_auth: env::var("ENABLE_SQL_AUTH")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),

            // Logging
            enable_request_logging: env::var("ENABLE_REQUEST_LOGGING")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),

            // Application info
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "Partial Picking System".to_string()),
            app_version: env::var("APP_VERSION").unwrap_or_else(|_| "1.0.0".to_string()),
            company_name: env::var("COMPANY_NAME")
                .unwrap_or_else(|_| "Newly Weds Foods Thailand".to_string()),
        })
    }

    pub fn database_connection_string(&self) -> String {
        format!(
            "server=tcp:{},{};database={};user={};password={};TrustServerCertificate=true",
            self.database_server,
            self.database_port,
            self.database_name,
            self.database_user,
            self.database_password
        )
    }
}
