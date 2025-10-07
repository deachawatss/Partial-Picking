# Backend Contract Tests

**Purpose**: Contract-first TDD tests that validate API implementation against OpenAPI specification

**Framework**: Rust + `axum-test` + `serde_json`

## Test Organization

```
backend/tests/contract/
├── README.md                       # This file
├── auth_contract_test.rs           # Authentication endpoints
├── runs_contract_test.rs           # Production run endpoints
├── picking_contract_test.rs        # Picking operations (4-phase atomic)
├── lots_contract_test.rs           # Lot management (FEFO)
├── bins_contract_test.rs           # Bin operations (TFC1 PARTIAL)
├── sequences_contract_test.rs      # Sequence number generation
├── workstations_contract_test.rs   # Workstation configuration
└── test_helpers.rs                 # Shared test utilities

```

## Contract Test Principles

1. **Contract-First**: Tests written against `contracts/openapi.yaml` specification
2. **Fail First**: All tests initially fail (no implementation exists)
3. **Type Safety**: Response schemas validated against TypeScript-equivalent Rust types
4. **Happy Path + Edge Cases**: Cover success scenarios and error conditions
5. **Atomic Transactions**: Validate 4-phase picking transaction rollback

## Running Tests

```bash
# Run all contract tests
cd backend
cargo test --test '*_contract_test'

# Run specific contract test file
cargo test --test auth_contract_test

# Run with output
cargo test --test picking_contract_test -- --nocapture

# Run in watch mode (requires cargo-watch)
cargo watch -x "test --test '*_contract_test'"
```

## Test Structure

Each contract test file follows this pattern:

```rust
use axum::http::StatusCode;
use serde_json::json;

mod test_helpers;
use test_helpers::*;

#[tokio::test]
async fn test_endpoint_success_case() {
    // Arrange: Setup test data
    let app = create_test_app().await;
    let payload = json!({ "field": "value" });

    // Act: Make request
    let response = app
        .post("/api/endpoint")
        .json(&payload)
        .await;

    // Assert: Validate response matches OpenAPI spec
    assert_eq!(response.status(), StatusCode::OK);

    let body: ResponseDTO = response.json().await;
    assert_eq!(body.field, "expected_value");
}

#[tokio::test]
async fn test_endpoint_error_case() {
    // Test error response matches ErrorResponse schema
    // Validate error code, message, correlationId
}
```

## Expected Test Results (Initial State)

All tests should **FAIL** initially with messages like:

```
running 25 tests
test auth_contract_test::test_login_ldap_success ... FAILED
test auth_contract_test::test_login_sql_success ... FAILED
test picking_contract_test::test_save_pick_4_phase ... FAILED
...

failures:
    auth_contract_test::test_login_ldap_success
        thread panicked at 'not yet implemented: POST /api/auth/login'

    picking_contract_test::test_save_pick_4_phase
        thread panicked at 'not yet implemented: 4-phase atomic transaction'
```

This is **expected and correct** - tests drive implementation via TDD.

## Test Data

Test fixtures located in `backend/tests/fixtures/`:
- `test_users.sql` - Test user accounts (LDAP + SQL)
- `test_runs.sql` - Production run test data (runs 213972, 213989, 6000037)
- `test_lots.sql` - Lot master data with FEFO scenarios
- `test_bins.sql` - TFC1 PARTIAL bin data (511 bins)

## Coverage Goals

- **Authentication**: 8 tests (LDAP success/fail, SQL success/fail, token refresh, etc.)
- **Runs**: 6 tests (get run details, batch items, run completion)
- **Picking**: 12 tests (4-phase save, unpick, validation, tolerance checks)
- **Lots**: 6 tests (FEFO sorting, available qty calculation, TFC1 filter)
- **Bins**: 4 tests (list bins, bin contents, TFC1 filter)
- **Sequences**: 2 tests (get next PT sequence, atomic increment)
- **Workstations**: 4 tests (list workstations, get config, scale assignments)

**Total**: ~42 contract tests

## Next Steps

1. Implement `test_helpers.rs` with test database setup
2. Write failing tests for each endpoint
3. Implement endpoints to make tests pass (TDD cycle)
4. Validate against OpenAPI spec using `openapi-validator`
