use axum::{
    extract::Extension,
    http::{header, Method},
    middleware as axum_middleware,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod config;
mod db;
mod error;
mod middleware;
mod models;
mod services;
mod utils;

#[tokio::main]
async fn main() {
    // Load configuration first (needed for log_level)
    let config = config::Config::from_env().expect("Failed to load configuration");

    // Initialize tracing with log_level from config
    let log_filter = format!(
        "partial_picking_backend={},tower_http=info",
        config.log_level
    );
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| log_filter.into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Create database connection pool with configuration
    let db_pool = db::create_pool(
        &config.database_connection_string(),
        config.database_max_connections,
        config.database_min_connections,
        config.database_connection_timeout_secs,
    )
    .await
    .expect("Failed to create database connection pool");

    tracing::info!("Database connection pool created successfully");

    // Configure CORS with allowed origins from config
    // Note: Cannot use Any (wildcard) for headers when credentials are enabled
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_allowed_origins
                .iter()
                .map(|origin| origin.parse().expect("Invalid CORS origin"))
                .collect::<Vec<_>>(),
        )
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
        ])
        .allow_credentials(true);

    // Create middleware layer to inject Config into request extensions
    let config_clone = config.clone();
    let add_config = axum_middleware::from_fn(
        move |mut req: axum::http::Request<axum::body::Body>, next: axum::middleware::Next| {
            let config = config_clone.clone();
            async move {
                req.extensions_mut().insert(config);
                next.run(req).await
            }
        },
    );

    // Build authentication routes (NO JWT required)
    let auth_routes = Router::new()
        .route("/login", post(api::auth::login_endpoint))
        .route("/refresh", post(api::auth::refresh_token_endpoint))
        .route("/me", get(api::auth::get_current_user_endpoint))
        .with_state(db_pool.clone());

    // Build protected API routes (require JWT authentication)
    let protected_routes = Router::new()
        .route("/runs", get(api::runs::list_runs_endpoint))
        .route("/runs/:runNo", get(api::runs::get_run_details_endpoint))
        .route("/runs/:runNo/items", get(api::runs::get_all_run_items_endpoint))
        .route(
            "/runs/:runNo/summary",
            get(api::runs::get_batch_summary_endpoint),
        )
        .route(
            "/runs/:runNo/batches/:rowNum/items",
            get(api::runs::get_batch_items_endpoint),
        )
        .route(
            "/runs/:runNo/complete",
            post(api::pallets::complete_run_endpoint),
        )
        .route("/picks", post(api::picks::save_pick_endpoint))
        .route(
            "/picks/:runNo/:rowNum/:lineId",
            axum::routing::delete(api::picks::unpick_item_endpoint),
        )
        .route(
            "/picks/run/:runNo/lots",
            get(api::picks::get_picked_lots_endpoint),
        )
        .route(
            "/picks/run/:runNo/pending",
            get(api::picks::get_pending_items_endpoint),
        )
        .route(
            "/lots/available",
            get(api::lots::get_available_lots_endpoint),
        )
        .route("/lots/:lotNo", get(api::lots::get_lot_by_number_endpoint))
        .route("/bins", get(api::bins::list_bins_endpoint))
        .route(
            "/bins/lot/:lotNo/:itemKey",
            get(api::bins::get_bins_for_lot_endpoint),
        )
        .route("/bins/:binNo", get(api::bins::get_bin_by_number_endpoint))
        .route(
            "/workstations",
            get(api::workstations::list_workstations_endpoint),
        )
        .with_state(db_pool.clone());

    // Build application routes with middleware
    let mut app = Router::new()
        .route("/", get(health_check))
        .route("/api/health", get(health_check))
        .nest("/api/auth", auth_routes)
        .nest("/api", protected_routes)
        .layer(add_config);

    // Conditionally add request logging based on config
    if config.enable_request_logging {
        app = app.layer(TraceLayer::new_for_http());
    }

    app = app.layer(cors);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app).await.expect("Server error");
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    app_name: String,
    version: String,
    company: String,
}

async fn health_check(Extension(config): Extension<config::Config>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "OK",
        app_name: config.app_name,
        version: config.app_version,
        company: config.company_name,
    })
}
