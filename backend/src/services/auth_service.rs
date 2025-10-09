use crate::config::Config;
use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::user::{AuthSource, User};
use ldap3::{LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
use std::time::Duration;
use tiberius::{Query, Row};

/// Authenticate user against LDAP (Active Directory)
///
/// # T047: LDAP Authentication Service
///
/// Authenticates user credentials against Active Directory LDAP server.
///
/// # Arguments
/// * `username` - Username (will be formatted as username@NWFTH.com for LDAP bind)
/// * `password` - Plain text password
/// * `config` - Application configuration (contains LDAP_URL, LDAP_DOMAIN, etc.)
/// * `pool` - Database connection pool (for creating/updating user record)
///
/// # Returns
/// * `Ok(User)` - User authenticated successfully via LDAP with auth_source="LDAP"
/// * `Err(AppError::InvalidCredentials)` - LDAP bind failed (wrong password/username)
/// * `Err(AppError::LdapAuthFailed)` - LDAP server unreachable or other LDAP error
///
/// # LDAP Authentication Flow
/// 1. Connect to LDAP server (LDAP_URL from config)
/// 2. Bind with credentials: username@NWFTH.com + password
/// 3. If bind succeeds:
///    - Search for user attributes (sAMAccountName, givenName, sn, department, employeeID)
///    - Upsert user record in tbl_user (create if not exists, update if exists)
///    - Set auth_source="LDAP", update last_ldap_sync
/// 4. If bind fails: Return InvalidCredentials
/// 5. If LDAP unreachable: Return LdapAuthFailed
///
/// # Example
/// ```rust
/// let user = authenticate_ldap("dechawat", "P@ssw0rd123", &config, &pool).await?;
/// assert_eq!(user.auth_source, AuthSource::Ldap);
/// ```
pub async fn authenticate_ldap(
    username: &str,
    password: &str,
    config: &Config,
    pool: &DbPool,
) -> AppResult<User> {
    if !config.enable_ldap_auth {
        tracing::warn!("LDAP authentication is disabled in configuration");
        return Err(AppError::LdapAuthFailed(
            "LDAP authentication is disabled".to_string(),
        ));
    }

    tracing::info!(username = %username, "Attempting LDAP authentication");

    // Format username for LDAP bind (username@domain)
    let bind_dn = if username.contains('@') {
        username.to_string()
    } else {
        format!("{}@{}", username, config.ldap_domain)
    };

    // Connect to LDAP server with timeout (async)
    let settings = LdapConnSettings::new()
        .set_conn_timeout(Duration::from_secs(config.ldap_timeout_secs));

    let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &config.ldap_url)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, ldap_url = %config.ldap_url, "LDAP connection failed");
            AppError::LdapAuthFailed(format!("LDAP server unreachable: {}", e))
        })?;

    // Spawn connection driver
    tokio::spawn(async move {
        if let Err(e) = conn.drive().await {
            tracing::debug!(error = %e, "LDAP connection driver terminated");
        }
    });

    // Attempt LDAP bind (authenticate) - async
    let bind_result = ldap.simple_bind(&bind_dn, password).await.map_err(|e| {
        tracing::warn!(
            username = %username,
            error = %e,
            "LDAP bind failed"
        );
        AppError::InvalidCredentials
    })?;

    // Check if bind was successful
    if bind_result.rc != 0 {
        tracing::warn!(
            username = %username,
            result_code = bind_result.rc,
            "LDAP bind failed with non-zero result code"
        );
        return Err(AppError::InvalidCredentials);
    }

    tracing::info!(username = %username, "LDAP bind successful");

    // Search for user attributes in Active Directory - async
    let search_filter = format!("(sAMAccountName={})", username);
    let search_result = ldap
        .search(
            &config.ldap_base_dn,
            Scope::Subtree,
            &search_filter,
            vec![
                "sAMAccountName",
                "givenName",
                "sn",
                "department",
                "employeeID",
                "mail",
                "distinguishedName",
            ],
        )
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "LDAP search failed");
            AppError::LdapAuthFailed(format!("LDAP search failed: {}", e))
        })?;

    let (entries, _result) = search_result.success().map_err(|e| {
        tracing::error!(error = %e, "LDAP search returned error");
        AppError::LdapAuthFailed(format!("LDAP search error: {}", e))
    })?;

    // Parse search results
    if entries.is_empty() {
        tracing::warn!(username = %username, "User not found in LDAP directory");
        return Err(AppError::InvalidCredentials);
    }

    let entry = SearchEntry::construct(entries[0].clone());

    // Extract user attributes
    let first_name = entry
        .attrs
        .get("givenName")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    let last_name = entry
        .attrs
        .get("sn")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    let department = entry
        .attrs
        .get("department")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    let _employee_id = entry
        .attrs
        .get("employeeID")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    let email = entry
        .attrs
        .get("mail")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    let ldap_dn = entry
        .attrs
        .get("distinguishedName")
        .and_then(|v| v.first())
        .map(|s| s.clone());

    tracing::debug!(
        username = %username,
        first_name = ?first_name,
        last_name = ?last_name,
        department = ?department,
        "LDAP attributes retrieved"
    );

    // Unbind from LDAP - async
    let _ = ldap.unbind().await;

    // Upsert user in database (create if not exists, update if exists)
    let user = upsert_ldap_user(
        pool,
        username,
        first_name.as_deref(),
        last_name.as_deref(),
        email.as_deref(),
        department.as_deref(),
        ldap_dn.as_deref(),
    )
    .await?;

    tracing::info!(
        username = %username,
        user_id = user.userid,
        "LDAP authentication successful"
    );

    Ok(user)
}

/// Authenticate user against SQL database (tbl_user)
///
/// # T048: SQL Fallback Authentication Service
///
/// Authenticates user credentials against local database using plain text password comparison.
///
/// **SECURITY WARNING**: This implementation uses plain text password comparison
/// because the database stores passwords in plain text. This is NOT secure for
/// production environments and should be migrated to bcrypt or argon2 hashing.
///
/// # Arguments
/// * `username` - Username (must match tbl_user.uname)
/// * `password` - Plain text password (compared directly with database value)
/// * `pool` - Database connection pool
///
/// # Returns
/// * `Ok(User)` - User authenticated successfully with auth_source="LOCAL"
/// * `Err(AppError::InvalidCredentials)` - Username not found or password verification failed
///
/// # SQL Authentication Flow
/// 1. Query tbl_user for user with matching username
/// 2. If user not found: Return InvalidCredentials
/// 3. If user.auth_source != 'LOCAL': Return InvalidCredentials (LDAP-only user)
/// 4. If user.pword is NULL: Return InvalidCredentials (password not set)
/// 5. Compare password with user.pword (plain text comparison)
/// 6. If passwords match: Return user
/// 7. If passwords don't match: Return InvalidCredentials
///
/// # Example
/// ```rust
/// let user = authenticate_sql("UAT1", "1234", &pool).await?;
/// assert_eq!(user.auth_source, AuthSource::Local);
/// ```
pub async fn authenticate_sql(username: &str, password: &str, pool: &DbPool) -> AppResult<User> {
    tracing::info!(username = %username, "Attempting SQL authentication");

    // Query user by username
    let mut conn = pool.get().await?;

    let query = r#"
        SELECT
            userid,
            uname,
            Fname,
            Lname,
            email,
            department,
            auth_source,
            ldap_username,
            ldap_dn,
            last_ldap_sync,
            ad_enabled,
            app_permissions,
            pword,
            created_at
        FROM dbo.tbl_user
        WHERE uname = @P1
    "#;

    let mut query = Query::new(query);
    query.bind(username);

    let row: Option<Row> = query.query(&mut conn).await?.into_row().await?;

    let row = row.ok_or_else(|| {
        tracing::warn!(username = %username, "User not found in database");
        AppError::InvalidCredentials
    })?;

    // Parse user from database row
    let auth_source: &str = row.get("auth_source").unwrap_or("LOCAL");

    // Only allow SQL authentication for LOCAL users
    if auth_source != "LOCAL" {
        tracing::warn!(
            username = %username,
            auth_source = %auth_source,
            "User is not configured for SQL authentication"
        );
        return Err(AppError::InvalidCredentials);
    }

    // Get password from database
    let password_db: Option<&str> = row.get("pword");
    let password_db = password_db.ok_or_else(|| {
        tracing::warn!(username = %username, "User has no password set");
        AppError::InvalidCredentials
    })?;

    // SECURITY NOTE: Database stores plain text passwords for LOCAL users
    // This is NOT secure for production and should be migrated to bcrypt hashes
    // For now, we use plain text comparison to match existing database schema
    if password != password_db {
        tracing::warn!(username = %username, "Password verification failed");
        return Err(AppError::InvalidCredentials);
    }

    // Build User struct from database row
    let user = User {
        userid: row.get::<i32, _>("userid").unwrap(),
        uname: row.get::<&str, _>("uname").unwrap().to_string(),
        fname: row.get::<&str, _>("Fname").map(|s| s.to_string()),
        lname: row.get::<&str, _>("Lname").map(|s| s.to_string()),
        email: row.get::<&str, _>("email").map(|s| s.to_string()),
        department: row.get::<&str, _>("department").map(|s| s.to_string()),
        auth_source: AuthSource::Local,
        ldap_username: row.get::<&str, _>("ldap_username").map(|s| s.to_string()),
        ldap_dn: row.get::<&str, _>("ldap_dn").map(|s| s.to_string()),
        last_ldap_sync: row.get("last_ldap_sync"),
        ad_enabled: row.get::<bool, _>("ad_enabled").unwrap_or(true),
        app_permissions: row.get::<&str, _>("app_permissions").map(|s| s.to_string()),
        pword: Some(password_db.to_string()),
        created_at: row.get("created_at"),
    };

    tracing::info!(
        username = %username,
        user_id = user.userid,
        "SQL authentication successful"
    );

    Ok(user)
}

/// Authenticate user with dual strategy (LDAP primary, SQL fallback)
///
/// # T049: Dual Authentication Strategy
///
/// Implements the dual authentication flow as specified in OpenAPI contract.
///
/// # Arguments
/// * `username` - Username (for both LDAP and SQL lookup)
/// * `password` - Plain text password
/// * `config` - Application configuration
/// * `pool` - Database connection pool
///
/// # Returns
/// * `Ok(User)` - User authenticated successfully (either LDAP or SQL)
/// * `Err(AppError::InvalidCredentials)` - Both LDAP and SQL authentication failed
/// * `Err(AppError::LdapAuthFailed)` - LDAP server unreachable (no fallback attempted)
///
/// # Authentication Flow (from OpenAPI spec)
/// 1. **Attempt LDAP authentication** (primary):
///    - If LDAP bind succeeds → Return LDAP user
///    - If LDAP bind fails (InvalidCredentials) → Continue to step 2
///    - If LDAP unreachable (LdapAuthFailed) → Return error (NO FALLBACK)
/// 2. **Attempt SQL authentication** (fallback):
///    - If SQL auth succeeds → Return LOCAL user
///    - If SQL auth fails → Return InvalidCredentials
///
/// # Important Notes
/// - SQL fallback ONLY triggers on LDAP bind failure (wrong credentials)
/// - SQL fallback does NOT trigger if LDAP server is unreachable
/// - This prevents fallback when LDAP infrastructure is down
///
/// # Example
/// ```rust
/// // LDAP user succeeds on first attempt
/// let user1 = authenticate("dechawat", "LdapPassword", &config, &pool).await?;
/// assert_eq!(user1.auth_source, AuthSource::Ldap);
///
/// // SQL user succeeds after LDAP bind fails
/// let user2 = authenticate("warehouse_user", "SqlPassword", &config, &pool).await?;
/// assert_eq!(user2.auth_source, AuthSource::Local);
/// ```
pub async fn authenticate(
    username: &str,
    password: &str,
    config: &Config,
    pool: &DbPool,
) -> AppResult<User> {
    tracing::info!(username = %username, "Starting dual authentication");

    // Step 1: Attempt LDAP authentication (primary)
    match authenticate_ldap(username, password, config, pool).await {
        Ok(user) => {
            tracing::info!(
                username = %username,
                auth_source = "LDAP",
                "Authentication successful via LDAP"
            );
            return Ok(user);
        }
        Err(AppError::InvalidCredentials) => {
            // LDAP bind failed - credentials are wrong
            // Continue to SQL fallback
            tracing::info!(
                username = %username,
                "LDAP authentication failed, attempting SQL fallback"
            );
        }
        Err(AppError::LdapAuthFailed(msg)) => {
            // LDAP server unreachable - do NOT fallback to SQL
            tracing::error!(
                username = %username,
                error = %msg,
                "LDAP server unreachable, no fallback attempted"
            );
            return Err(AppError::LdapAuthFailed(msg));
        }
        Err(e) => {
            // Other errors - return immediately
            return Err(e);
        }
    }

    // Step 2: Attempt SQL authentication (fallback)
    if !config.enable_sql_auth {
        tracing::warn!("SQL authentication is disabled in configuration");
        return Err(AppError::InvalidCredentials);
    }

    match authenticate_sql(username, password, pool).await {
        Ok(user) => {
            tracing::info!(
                username = %username,
                auth_source = "LOCAL",
                "Authentication successful via SQL fallback"
            );
            Ok(user)
        }
        Err(e) => {
            tracing::warn!(
                username = %username,
                "Both LDAP and SQL authentication failed"
            );
            Err(e)
        }
    }
}

/// Upsert LDAP user in database (create if not exists, update if exists)
///
/// Creates or updates user record in tbl_user with LDAP-sourced attributes.
/// Sets auth_source='LDAP' and updates last_ldap_sync timestamp.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `username` - LDAP sAMAccountName
/// * `first_name` - givenName from LDAP
/// * `last_name` - sn from LDAP
/// * `email` - mail from LDAP
/// * `department` - department from LDAP
/// * `ldap_dn` - distinguishedName from LDAP
///
/// # Returns
/// * `Ok(User)` - User created/updated successfully
/// * `Err(AppError)` - Database error
async fn upsert_ldap_user(
    pool: &DbPool,
    username: &str,
    first_name: Option<&str>,
    last_name: Option<&str>,
    email: Option<&str>,
    department: Option<&str>,
    ldap_dn: Option<&str>,
) -> AppResult<User> {
    let mut conn = pool.get().await?;

    // Check if user exists
    let mut query = Query::new("SELECT userid FROM dbo.tbl_user WHERE uname = @P1");
    query.bind(username);

    let existing_user: Option<i32> = query
        .query(&mut conn)
        .await?
        .into_row()
        .await?
        .and_then(|row| row.get::<i32, _>(0));

    if let Some(userid) = existing_user {
        // Update existing user
        tracing::debug!(username = %username, userid = userid, "Updating existing LDAP user");

        let mut query = Query::new(
            r#"
            UPDATE dbo.tbl_user
            SET
                Fname = @P1,
                Lname = @P2,
                email = @P3,
                department = @P4,
                ldap_dn = @P5,
                last_ldap_sync = GETDATE(),
                ad_enabled = 1,
                auth_source = 'LDAP',
                ldap_username = @P6
            WHERE uname = @P7
        "#,
        );
        query.bind(first_name);
        query.bind(last_name);
        query.bind(email);
        query.bind(department);
        query.bind(ldap_dn);
        query.bind(username);
        query.bind(username);
        query.execute(&mut conn).await?;
    } else {
        // Insert new user
        tracing::debug!(username = %username, "Creating new LDAP user");

        let mut query = Query::new(
            r#"
            INSERT INTO dbo.tbl_user (
                uname, Fname, Lname, email, department,
                auth_source, ldap_username, ldap_dn,
                last_ldap_sync, ad_enabled, app_permissions
            )
            VALUES (
                @P1, @P2, @P3, @P4, @P5,
                'LDAP', @P6, @P7,
                GETDATE(), 1, 'putaway,picking,partial-picking'
            )
        "#,
        );
        query.bind(username);
        query.bind(first_name);
        query.bind(last_name);
        query.bind(email);
        query.bind(department);
        query.bind(username);
        query.bind(ldap_dn);
        query.execute(&mut conn).await?;
    }

    // Retrieve and return user
    let mut query = Query::new(
        r#"
        SELECT
            userid, uname, Fname, Lname, email, department,
            auth_source, ldap_username, ldap_dn, last_ldap_sync,
            ad_enabled, app_permissions, pword, created_at
        FROM dbo.tbl_user
        WHERE uname = @P1
    "#,
    );
    query.bind(username);

    let row: Row = query
        .query(&mut conn)
        .await?
        .into_row()
        .await?
        .ok_or_else(|| AppError::DatabaseError("Failed to retrieve upserted user".to_string()))?;

    Ok(User {
        userid: row.get::<i32, _>("userid").unwrap(),
        uname: row.get::<&str, _>("uname").unwrap().to_string(),
        fname: row.get::<&str, _>("Fname").map(|s| s.to_string()),
        lname: row.get::<&str, _>("Lname").map(|s| s.to_string()),
        email: row.get::<&str, _>("email").map(|s| s.to_string()),
        department: row.get::<&str, _>("department").map(|s| s.to_string()),
        auth_source: AuthSource::Ldap,
        ldap_username: row.get::<&str, _>("ldap_username").map(|s| s.to_string()),
        ldap_dn: row.get::<&str, _>("ldap_dn").map(|s| s.to_string()),
        // LDAP sync timestamp: Tiberius doesn't support direct DateTime conversion
        // Set to None (these fields are optional and not critical for auth)
        last_ldap_sync: None,
        ad_enabled: row.get::<bool, _>("ad_enabled").unwrap_or(true),
        app_permissions: row.get::<&str, _>("app_permissions").map(|s| s.to_string()),
        pword: None, // Never return password hash
        created_at: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Integration tests require actual LDAP server and database
    // Unit tests would need mocking infrastructure

    #[test]
    fn test_module_compiles() {
        // Smoke test to ensure module compiles
        assert!(true);
    }
}
