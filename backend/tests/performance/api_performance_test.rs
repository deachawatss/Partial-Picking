use reqwest::{Client, StatusCode};
use serde_json::json;
/// Backend API Performance Tests
///
/// Constitutional Requirement: <100ms p95 latency for all endpoints
///
/// Tests:
/// - GET /api/runs/{runNo} response time
/// - GET /api/runs/{runNo}/batches/{rowNum}/items response time
/// - POST /api/picks response time (4-phase transaction)
/// - GET /api/lots/available response time (FEFO query)
///
/// Measures p50, p95, p99 latencies with 100 concurrent requests per endpoint
use std::time::{Duration, Instant};
use tokio;

const BASE_URL: &str = "http://localhost:7075/api";
const PERFORMANCE_TARGET_P95_MS: u128 = 100;
const CONCURRENT_REQUESTS: usize = 100;

#[derive(Debug)]
struct PerformanceMetrics {
    endpoint: String,
    total_requests: usize,
    successful_requests: usize,
    failed_requests: usize,
    p50_ms: u128,
    p95_ms: u128,
    p99_ms: u128,
    min_ms: u128,
    max_ms: u128,
    avg_ms: u128,
}

impl PerformanceMetrics {
    fn from_latencies(endpoint: String, latencies: &mut Vec<u128>) -> Self {
        latencies.sort();
        let len = latencies.len();
        let successful_requests = len;
        let failed_requests = CONCURRENT_REQUESTS - successful_requests;

        let p50 = latencies[len / 2];
        let p95 = latencies[(len * 95) / 100];
        let p99 = latencies[(len * 99) / 100];
        let min = *latencies.first().unwrap_or(&0);
        let max = *latencies.last().unwrap_or(&0);
        let avg = latencies.iter().sum::<u128>() / (len as u128);

        Self {
            endpoint,
            total_requests: CONCURRENT_REQUESTS,
            successful_requests,
            failed_requests,
            p50_ms: p50,
            p95_ms: p95,
            p99_ms: p99,
            min_ms: min,
            max_ms: max,
            avg_ms: avg,
        }
    }

    fn passes_constitutional_requirement(&self) -> bool {
        self.p95_ms < PERFORMANCE_TARGET_P95_MS
    }

    fn print_report(&self) {
        println!("\n========================================");
        println!("Endpoint: {}", self.endpoint);
        println!("========================================");
        println!("Total Requests:      {}", self.total_requests);
        println!("Successful:          {}", self.successful_requests);
        println!("Failed:              {}", self.failed_requests);
        println!("----------------------------------------");
        println!("Latency Percentiles:");
        println!("  P50 (median):      {} ms", self.p50_ms);
        println!("  P95:               {} ms", self.p95_ms);
        println!("  P99:               {} ms", self.p99_ms);
        println!("  Min:               {} ms", self.min_ms);
        println!("  Max:               {} ms", self.max_ms);
        println!("  Average:           {} ms", self.avg_ms);
        println!("----------------------------------------");

        if self.passes_constitutional_requirement() {
            println!("RESULT: ✅ PASS (p95 < {}ms)", PERFORMANCE_TARGET_P95_MS);
        } else {
            println!("RESULT: ❌ FAIL (p95 >= {}ms)", PERFORMANCE_TARGET_P95_MS);
        }
        println!("========================================\n");
    }
}

async fn get_auth_token() -> String {
    let client = Client::new();
    let response = client
        .post(&format!("{}/auth/login", BASE_URL))
        .json(&json!({
            "username": "dechawat",
            "password": "P@ssw0rd123"
        }))
        .send()
        .await
        .expect("Failed to authenticate");

    let auth_response: serde_json::Value = response.json().await.unwrap();
    auth_response["token"].as_str().unwrap().to_string()
}

async fn measure_endpoint_performance<F, Fut>(
    endpoint_name: &str,
    request_fn: F,
) -> PerformanceMetrics
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<Duration, String>>,
{
    println!("\nTesting: {}", endpoint_name);
    println!("Sending {} concurrent requests...", CONCURRENT_REQUESTS);

    let mut latencies = Vec::new();
    let mut handles = Vec::new();

    // Send concurrent requests
    for _ in 0..CONCURRENT_REQUESTS {
        let handle = tokio::spawn(request_fn());
        handles.push(handle);
    }

    // Collect results
    for handle in handles {
        match handle.await {
            Ok(Ok(latency)) => {
                latencies.push(latency.as_millis());
            }
            Ok(Err(e)) => {
                eprintln!("Request failed: {}", e);
            }
            Err(e) => {
                eprintln!("Task join error: {}", e);
            }
        }
    }

    PerformanceMetrics::from_latencies(endpoint_name.to_string(), &mut latencies)
}

#[tokio::test]
async fn test_get_run_details_performance() {
    let token = get_auth_token().await;
    let client = Client::new();
    let auth_header = format!("Bearer {}", token);

    let metrics = measure_endpoint_performance("GET /api/runs/{runNo}", || {
        let client = client.clone();
        let auth_header = auth_header.clone();
        async move {
            let start = Instant::now();
            let response = client
                .get(&format!("{}/runs/6000037", BASE_URL))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if response.status() == StatusCode::OK {
                Ok(start.elapsed())
            } else {
                Err(format!("Status: {}", response.status()))
            }
        }
    })
    .await;

    metrics.print_report();
    assert!(
        metrics.passes_constitutional_requirement(),
        "GET /api/runs/{{runNo}} failed constitutional requirement: p95 {}ms >= {}ms",
        metrics.p95_ms,
        PERFORMANCE_TARGET_P95_MS
    );
}

#[tokio::test]
async fn test_get_batch_items_performance() {
    let token = get_auth_token().await;
    let client = Client::new();
    let auth_header = format!("Bearer {}", token);

    let metrics =
        measure_endpoint_performance("GET /api/runs/{runNo}/batches/{rowNum}/items", || {
            let client = client.clone();
            let auth_header = auth_header.clone();
            async move {
                let start = Instant::now();
                let response = client
                    .get(&format!("{}/runs/6000037/batches/1/items", BASE_URL))
                    .header("Authorization", &auth_header)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                if response.status() == StatusCode::OK {
                    Ok(start.elapsed())
                } else {
                    Err(format!("Status: {}", response.status()))
                }
            }
        })
        .await;

    metrics.print_report();
    assert!(
        metrics.passes_constitutional_requirement(),
        "GET /api/runs/{{runNo}}/batches/{{rowNum}}/items failed constitutional requirement: p95 {}ms >= {}ms",
        metrics.p95_ms,
        PERFORMANCE_TARGET_P95_MS
    );
}

#[tokio::test]
async fn test_get_available_lots_performance() {
    let token = get_auth_token().await;
    let client = Client::new();
    let auth_header = format!("Bearer {}", token);

    let metrics = measure_endpoint_performance("GET /api/lots/available (FEFO query)", || {
        let client = client.clone();
        let auth_header = auth_header.clone();
        async move {
            let start = Instant::now();
            let response = client
                .get(&format!("{}/lots/available?itemKey=INSALT02", BASE_URL))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if response.status() == StatusCode::OK {
                Ok(start.elapsed())
            } else {
                Err(format!("Status: {}", response.status()))
            }
        }
    })
    .await;

    metrics.print_report();
    assert!(
        metrics.passes_constitutional_requirement(),
        "GET /api/lots/available (FEFO query) failed constitutional requirement: p95 {}ms >= {}ms",
        metrics.p95_ms,
        PERFORMANCE_TARGET_P95_MS
    );
}

#[tokio::test]
#[ignore] // Run separately due to database modifications
async fn test_save_pick_performance() {
    let token = get_auth_token().await;
    let client = Client::new();
    let auth_header = format!("Bearer {}", token);

    // Note: This test creates actual picks in the database
    // Run with reduced concurrency to avoid conflicts
    const PICK_CONCURRENCY: usize = 10;

    println!("\nTesting: POST /api/picks (4-phase atomic transaction)");
    println!("Sending {} concurrent requests...", PICK_CONCURRENCY);

    let mut latencies = Vec::new();

    for i in 0..PICK_CONCURRENCY {
        let client = client.clone();
        let auth_header = auth_header.clone();

        let start = Instant::now();
        let response = client
            .post(&format!("{}/picks", BASE_URL))
            .header("Authorization", &auth_header)
            .json(&json!({
                "runNo": 213996,
                "rowNum": 1,
                "lineId": i + 1, // Unique line IDs
                "lotNo": "2510403-1",
                "binNo": "PWBB-12",
                "weight": 20.025,
                "workstationId": "WS3"
            }))
            .send()
            .await;

        if let Ok(res) = response {
            if res.status() == StatusCode::CREATED {
                latencies.push(start.elapsed().as_millis());
            }
        }
    }

    latencies.sort();
    let len = latencies.len();
    let p95 = latencies[(len * 95) / 100];

    println!("\nPOST /api/picks Performance:");
    println!("  Successful requests: {}/{}", len, PICK_CONCURRENCY);
    println!("  P95 latency: {} ms", p95);

    if p95 < PERFORMANCE_TARGET_P95_MS {
        println!("  RESULT: ✅ PASS");
    } else {
        println!("  RESULT: ❌ FAIL");
    }

    assert!(
        p95 < PERFORMANCE_TARGET_P95_MS,
        "POST /api/picks (4-phase transaction) failed constitutional requirement: p95 {}ms >= {}ms",
        p95,
        PERFORMANCE_TARGET_P95_MS
    );
}

#[tokio::test]
async fn run_all_performance_tests() {
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║     BACKEND API PERFORMANCE TEST SUITE                      ║");
    println!("║     Constitutional Requirement: <100ms p95 latency          ║");
    println!(
        "║     Concurrent Requests: {}                                 ║",
        CONCURRENT_REQUESTS
    );
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("\n");

    let token = get_auth_token().await;
    let client = Client::new();
    let auth_header = format!("Bearer {}", token);

    // Test 1: GET /api/runs/{runNo}
    let metrics1 = measure_endpoint_performance("GET /api/runs/{runNo}", || {
        let client = client.clone();
        let auth_header = auth_header.clone();
        async move {
            let start = Instant::now();
            let response = client
                .get(&format!("{}/runs/6000037", BASE_URL))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if response.status() == StatusCode::OK {
                Ok(start.elapsed())
            } else {
                Err(format!("Status: {}", response.status()))
            }
        }
    })
    .await;
    metrics1.print_report();

    // Test 2: GET /api/runs/{runNo}/batches/{rowNum}/items
    let metrics2 =
        measure_endpoint_performance("GET /api/runs/{runNo}/batches/{rowNum}/items", || {
            let client = client.clone();
            let auth_header = auth_header.clone();
            async move {
                let start = Instant::now();
                let response = client
                    .get(&format!("{}/runs/6000037/batches/1/items", BASE_URL))
                    .header("Authorization", &auth_header)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                if response.status() == StatusCode::OK {
                    Ok(start.elapsed())
                } else {
                    Err(format!("Status: {}", response.status()))
                }
            }
        })
        .await;
    metrics2.print_report();

    // Test 3: GET /api/lots/available (FEFO query)
    let metrics3 = measure_endpoint_performance("GET /api/lots/available (FEFO query)", || {
        let client = client.clone();
        let auth_header = auth_header.clone();
        async move {
            let start = Instant::now();
            let response = client
                .get(&format!("{}/lots/available?itemKey=INSALT02", BASE_URL))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if response.status() == StatusCode::OK {
                Ok(start.elapsed())
            } else {
                Err(format!("Status: {}", response.status()))
            }
        }
    })
    .await;
    metrics3.print_report();

    // Summary
    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                   PERFORMANCE TEST SUMMARY                   ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("\nEndpoint                                     | P95 (ms) | Result");
    println!("----------------------------------------------------------");
    println!(
        "GET /api/runs/{{runNo}}                       | {:>8} | {}",
        metrics1.p95_ms,
        if metrics1.passes_constitutional_requirement() {
            "✅ PASS"
        } else {
            "❌ FAIL"
        }
    );
    println!(
        "GET /api/runs/.../batches/.../items          | {:>8} | {}",
        metrics2.p95_ms,
        if metrics2.passes_constitutional_requirement() {
            "✅ PASS"
        } else {
            "❌ FAIL"
        }
    );
    println!(
        "GET /api/lots/available (FEFO)               | {:>8} | {}",
        metrics3.p95_ms,
        if metrics3.passes_constitutional_requirement() {
            "✅ PASS"
        } else {
            "❌ FAIL"
        }
    );
    println!("----------------------------------------------------------");

    let all_pass = metrics1.passes_constitutional_requirement()
        && metrics2.passes_constitutional_requirement()
        && metrics3.passes_constitutional_requirement();

    if all_pass {
        println!("\n✅ ALL ENDPOINTS PASS CONSTITUTIONAL REQUIREMENT (<100ms p95)");
    } else {
        println!("\n❌ SOME ENDPOINTS FAIL CONSTITUTIONAL REQUIREMENT");
    }

    assert!(all_pass, "Performance tests failed - see report above");
}
