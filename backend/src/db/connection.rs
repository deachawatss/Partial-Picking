use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use std::time::Duration;
use tiberius::Config;

pub type DbPool = Pool<ConnectionManager>;

pub async fn create_pool(
    connection_string: &str,
    max_connections: u32,
    min_connections: u32,
    connection_timeout_secs: u64,
) -> Result<DbPool, Box<dyn std::error::Error>> {
    // Parse connection string into Config
    let config = Config::from_ado_string(connection_string)?;

    // Create connection manager
    let manager = ConnectionManager::new(config);

    // Build connection pool with configuration
    let pool = Pool::builder()
        .max_size(max_connections)
        .min_idle(Some(min_connections))
        .connection_timeout(Duration::from_secs(connection_timeout_secs))
        .build(manager)
        .await?;

    // Test connection
    {
        let mut conn = pool.get().await?;
        let row = conn
            .query("SELECT @@VERSION as version", &[])
            .await?
            .into_row()
            .await?
            .ok_or("No version returned")?;

        let version: &str = row.get("version").ok_or("Version column not found")?;
        tracing::info!(
            "Connected to SQL Server: {}",
            version.lines().next().unwrap_or(version)
        );
    }

    Ok(pool)
}
