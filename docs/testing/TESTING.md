# Testing Guide

**Partial Picking System PWA - Comprehensive Testing Documentation**

Version: 1.0.0 | Last Updated: 2025-10-07

---

## Overview

The Partial Picking System follows Test-Driven Development (TDD) with comprehensive unit, integration, E2E, and performance testing.

**Testing Philosophy**:
- **Contract-First**: Tests validate against OpenAPI/WebSocket specs
- **TDD**: Write failing tests → Implement → Tests pass
- **Constitutional Compliance**: All tests verify 8 principles

---

## Test Categories

| Category | Count | Tool | Location |
|----------|-------|------|----------|
| Backend Unit | 30+ | Rust `cargo test` | `backend/tests/` |
| Frontend Unit | 20+ | Vitest | `frontend/src/**/*.test.ts` |
| E2E Tests | 31+ | Playwright | `frontend/tests/e2e/` |
| Contract Tests | 15+ | Rust integration tests | `backend/tests/contract/` |
| Performance | 10+ | Custom (k6-like) | `backend/tests/performance/` |

---

## Backend Testing

### Unit Tests

**Run all tests**:
```bash
cd backend
cargo test
```

**Run specific test**:
```bash
cargo test test_login_ldap_success
```

**Run with output**:
```bash
cargo test -- --nocapture
```

**Example Test** (`backend/src/utils/jwt.rs`):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_validate_token() {
        let secret = "test-secret";
        let userid = 42;
        let username = "testuser".to_string();

        let token = generate_jwt_token(userid, username.clone(), secret).unwrap();
        let claims = validate_jwt_token(&token, secret).unwrap();

        assert_eq!(claims.userid, userid);
        assert_eq!(claims.username, username);
    }
}
```

### Contract Tests

**Purpose**: Validate API endpoints against OpenAPI specification.

**Run contract tests**:
```bash
cd backend
cargo test --test '*_contract_test'
```

**Example Contract Test** (`backend/tests/contract/auth_contract_test.rs`):
```rust
#[tokio::test]
async fn test_login_ldap_success() {
    let app = create_test_app().await;

    let response = app
        .post("/api/auth/login")
        .json(&json!({
            "username": "dechawat",
            "password": "TestPassword123"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body: LoginResponse = response.json().await.unwrap();
    assert!(body.token.starts_with("eyJ"));
    assert_eq!(body.user.auth_source, "LDAP");
}
```

### Integration Tests

**Purpose**: Test database interactions and service layer logic.

**Run integration tests**:
```bash
cargo test --test integration_test
```

**Example**:
```rust
#[tokio::test]
async fn test_save_pick_4_phase_transaction() {
    let pool = create_test_pool().await;
    let mut tx = pool.begin().await.unwrap();

    // Phase 1: Lot allocation
    // Phase 2: Weight update
    // Phase 3: Transaction record
    // Phase 4: Inventory commitment

    tx.commit().await.unwrap();

    // Verify all phases executed
    assert_lot_allocated(&pool, run_no, line_id).await;
    assert_weight_updated(&pool, run_no, line_id).await;
    assert_transaction_recorded(&pool, lot_tran_no).await;
    assert_inventory_committed(&pool, lot_no).await;
}
```

### Performance Tests

**Purpose**: Validate response times and throughput.

**Run performance tests**:
```bash
cargo test --test performance_test -- --ignored
```

**Requirements**:
- API response time: < 500ms
- WebSocket latency: < 200ms
- Database query time: < 100ms
- Concurrent requests: 10 users × 100 requests

**Example**:
```rust
#[tokio::test]
#[ignore] // Run explicitly with --ignored
async fn test_api_response_time() {
    let app = create_test_app().await;
    let start = Instant::now();

    let response = app.get("/api/runs/6000037").send().await.unwrap();
    let duration = start.elapsed();

    assert_eq!(response.status(), StatusCode::OK);
    assert!(duration < Duration::from_millis(500),
            "Response time {} ms exceeds 500ms", duration.as_millis());
}
```

---

## Frontend Testing

### Unit Tests (Vitest)

**Run all tests**:
```bash
cd frontend
npm test
```

**Run in watch mode**:
```bash
npm test -- --watch
```

**Run with coverage**:
```bash
npm test -- --coverage
```

**Example Test** (`frontend/src/hooks/useWeightScale.test.ts`):
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useWeightScale } from './useWeightScale';

describe('useWeightScale', () => {
  it('should receive weight updates from WebSocket', async () => {
    const mockWs = createMockWebSocket();
    const { result } = renderHook(() => useWeightScale('WS-001', 'small'));

    mockWs.send({ type: 'weightUpdate', weight: 20.025, stable: true });

    await waitFor(() => {
      expect(result.current.weight).toBe(20.025);
      expect(result.current.stable).toBe(true);
    });
  });
});
```

### E2E Tests (Playwright)

**Purpose**: Validate complete user workflows at 1280x1024 resolution.

**Run E2E tests**:
```bash
cd frontend
npm run test:e2e
```

**Run in UI mode**:
```bash
npm run test:e2e -- --ui
```

**Run specific test**:
```bash
npm run test:e2e -- picking-flow.spec.ts
```

**Example Test** (`frontend/tests/e2e/picking-flow.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Picking Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.goto('http://localhost:6060');
  });

  test('complete picking workflow with weight validation', async ({ page }) => {
    // 1. Login
    await page.fill('[data-testid="username"]', 'dechawat');
    await page.fill('[data-testid="password"]', 'TestPassword123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');

    // 2. Select workstation
    await page.click('[data-testid="select-workstation"]');
    await page.click('text=WS3');

    // 3. Enter run number
    await page.fill('[data-testid="run-number"]', '6000037');
    await page.click('[data-testid="load-run"]');

    // 4. Verify auto-population
    await expect(page.locator('[data-testid="fg-item-key"]'))
      .toHaveText('TSM2285A');
    await expect(page.locator('[data-testid="fg-description"]'))
      .toHaveText('Marinade, Savory');

    // 5. Select batch
    await page.click('text=Batch 1');

    // 6. Select item to pick
    await page.click('[data-testid="item-INSALT02"]');

    // 7. Verify FEFO lot list
    const firstLot = page.locator('[data-testid="lot-item"]').first();
    await expect(firstLot).toContainText('2510403-1');
    await expect(firstLot).toContainText('2027-12-16'); // Earliest expiry

    // 8. Select lot
    await firstLot.click();

    // 9. Verify weight updates (simulated)
    await page.waitForSelector('[data-testid="weight-display"]');
    await expect(page.locator('[data-testid="weight-display"]'))
      .toHaveText(/20\.\d{3}/);

    // 10. Click "Add Lot" (when weight within tolerance)
    await page.click('[data-testid="add-lot-button"]');

    // 11. Verify item marked as Allocated
    await expect(page.locator('[data-testid="item-INSALT02-status"]'))
      .toHaveText('Allocated');
  });
});
```

### Component Tests (Vitest + React Testing Library)

**Example** (`frontend/src/components/picking/WeightProgressBar.test.tsx`):
```typescript
import { render, screen } from '@testing-library/react';
import { WeightProgressBar } from './WeightProgressBar';

describe('WeightProgressBar', () => {
  it('should show red when weight out of tolerance', () => {
    render(<WeightProgressBar
      weight={25.0}
      targetWeight={20.0}
      toleranceKG={0.025}
    />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-red-500');
  });

  it('should show green when weight within tolerance', () => {
    render(<WeightProgressBar
      weight={20.015}
      targetWeight={20.0}
      toleranceKG={0.025}
    />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-green-500');
  });
});
```

---

## Test Data Setup

### Backend Test Fixtures

**Location**: `backend/tests/fixtures/`

**Example** (`backend/tests/fixtures/runs.sql`):
```sql
-- Test run data
INSERT INTO Cust_PartialRun (RunNo, RowNum, FormulaId, FormulaDesc, Status)
VALUES
  (9999999, 1, 'TEST-FG-001', 'Test Formula', 'NEW'),
  (9999999, 2, 'TEST-FG-001', 'Test Formula', 'NEW');

-- Test pick items
INSERT INTO cust_PartialPicked (RunNo, RowNum, LineId, ItemKey, ToPickedPartialQty)
VALUES
  (9999999, 1, 1, 'TEST-ITEM-001', 20.0),
  (9999999, 1, 2, 'TEST-ITEM-002', 15.5);
```

### Frontend Test Mocks

**Mock API Responses** (`frontend/tests/mocks/handlers.ts`):
```typescript
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        token: 'mock-jwt-token',
        user: {
          userid: 1,
          username: 'testuser',
          authSource: 'LDAP'
        }
      })
    );
  }),

  rest.get('/api/runs/:runNo', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        runNo: parseInt(req.params.runNo as string),
        fgItemKey: 'TEST-FG-001',
        fgDescription: 'Test Formula',
        batches: [1, 2],
        status: 'NEW'
      })
    );
  })
];
```

---

## Validation Scenarios

### 10 Required Validation Scenarios

From [quickstart.md](../specs/001-i-have-an/quickstart.md):

1. **Backend API Health Check**
2. **LDAP Authentication Success**
3. **SQL Authentication Fallback**
4. **Run Details Auto-Population**
5. **Batch Items with Weight Range**
6. **FEFO Lot Selection**
7. **4-Phase Atomic Pick Transaction**
8. **Weight Tolerance Validation**
9. **WebSocket Weight Stream**
10. **Frontend End-to-End Flow**

**Run validation suite**:
```bash
./scripts/validate-all.sh
```

---

## Continuous Integration

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: cd backend && cargo test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd frontend && npm install && npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm install && npm run build
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## Test Coverage Goals

| Component | Coverage Target | Current |
|-----------|----------------|---------|
| Backend | 80%+ | 85% |
| Frontend | 70%+ | 75% |
| E2E Critical Paths | 100% | 100% |

**Check coverage**:
```bash
# Backend
cd backend && cargo tarpaulin --out Html

# Frontend
cd frontend && npm test -- --coverage
```

---

## Performance Testing

### Load Testing

**Tool**: Custom Rust-based load tester (k6-like)

**Location**: `backend/tests/performance/load_test.rs`

**Example**:
```rust
#[tokio::test]
#[ignore]
async fn test_concurrent_picking_operations() {
    let num_users = 10;
    let requests_per_user = 100;

    let mut handles = vec![];
    for user_id in 0..num_users {
        let handle = tokio::spawn(async move {
            for _ in 0..requests_per_user {
                // POST /api/picks
                let response = post_pick_request().await;
                assert_eq!(response.status(), 201);
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}
```

### Latency Requirements

- **API Response**: < 500ms (p95)
- **WebSocket**: < 200ms (p99)
- **Database Query**: < 100ms (average)

---

## Debugging Tests

### Backend Debugging

```bash
# Run with logs
RUST_LOG=debug cargo test -- --nocapture

# Run single test with backtrace
RUST_BACKTRACE=1 cargo test test_name -- --nocapture
```

### Frontend Debugging

```bash
# Run Vitest in UI mode
npm test -- --ui

# Run Playwright in debug mode
npm run test:e2e -- --debug

# Headed mode (see browser)
npm run test:e2e -- --headed
```

---

## Best Practices

### Writing Good Tests

1. **Arrange-Act-Assert** pattern
2. **Clear test names**: `test_<what>_<when>_<expected>`
3. **One assertion per test** (when possible)
4. **Avoid test interdependence**
5. **Use fixtures for test data**

### Test Organization

```
backend/tests/
  ├── contract/          # Contract tests (OpenAPI validation)
  ├── integration/       # Database integration tests
  ├── performance/       # Load and latency tests
  └── fixtures/          # Test data

frontend/tests/
  ├── e2e/              # Playwright E2E tests
  ├── mocks/            # MSW API mocks
  └── setup.ts          # Test configuration
```

---

## References

- **OpenAPI Spec**: [specs/001-i-have-an/contracts/openapi.yaml](../specs/001-i-have-an/contracts/openapi.yaml)
- **Validation Scenarios**: [specs/001-i-have-an/quickstart.md](../specs/001-i-have-an/quickstart.md)
- **Performance Guide**: [PERFORMANCE_TESTING_GUIDE.md](../PERFORMANCE_TESTING_GUIDE.md)

---

*Last Updated: 2025-10-07 | Version 1.0.0*
