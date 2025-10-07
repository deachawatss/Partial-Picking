use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use tiberius::Config;

pub type DbPool = Pool<ConnectionManager>;

pub async fn create_pool(connection_string: &str) -> Result<DbPool, Box<dyn std::error::Error>> {
    // Parse connection string into Config
    let config = Config::from_ado_string(connection_string)?;

    // Create connection manager
    let manager = ConnectionManager::new(config);

    // Build connection pool
    let pool = Pool::builder().max_size(10).build(manager).await?;

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
