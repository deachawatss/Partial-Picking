use axum::{
    http::{header, HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
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
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "partial_picking_backend=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = config::Config::from_env().expect("Failed to load configuration");

    // Create database connection pool
    let db_pool = db::create_pool(&config.database_connection_string())
        .await
        .expect("Failed to create database connection pool");

    tracing::info!("Database connection pool created successfully");

    // Configure CORS - use explicit origins and headers (required when credentials enabled)
    let allowed_origins = config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
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
        .route("/runs/:runNo", get(api::runs::get_run_details_endpoint))
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
            "/lots/available",
            get(api::lots::get_available_lots_endpoint),
        )
        .route("/bins", get(api::bins::list_bins_endpoint))
        .route(
            "/workstations",
            get(api::workstations::list_workstations_endpoint),
        )
        .with_state(db_pool.clone());

    // Build application routes with middleware
    let app = Router::new()
        .route("/", get(health_check))
        .route("/api/health", get(health_check))
        .nest("/api/auth", auth_routes)
        .nest("/api", protected_routes)
        .layer(add_config)
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app).await.expect("Server error");
}

async fn health_check() -> &'static str {
    "OK"
}
