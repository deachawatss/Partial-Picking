# Frontend Contract Tests

**Purpose**: Contract-first tests validating API integration and component behavior

**Framework**: Vitest + React Testing Library + MSW (Mock Service Worker)

## Test Organization

```
frontend/tests/contract/
├── README.md                       # This file
├── api/
│   ├── auth.contract.test.ts       # Authentication API integration
│   ├── runs.contract.test.ts       # Production runs API integration
│   ├── picking.contract.test.ts    # Picking operations API integration
│   ├── lots.contract.test.ts       # Lot management API integration
│   └── workstations.contract.test.ts # Workstation config API integration
├── websocket/
│   └── weight-scale.contract.test.ts # WebSocket weight stream integration
├── components/
│   ├── LoginPage.contract.test.tsx    # Login page component contract
│   └── PartialPickingPage.contract.test.tsx # Picking page contract
└── setup/
    ├── test-utils.ts               # Testing utilities
    ├── mock-handlers.ts            # MSW API mock handlers
    └── websocket-mock.ts           # WebSocket mock server

```

## Contract Test Principles

1. **API Contract Validation**: Tests verify API responses match OpenAPI schema
2. **Type Safety**: All API responses validated against TypeScript types
3. **Mock Service Worker**: HTTP mocks using MSW (not axios mocks)
4. **WebSocket Mocks**: Real WebSocket server mock for weight integration
5. **Component Contracts**: High-level user flows, not implementation details

## Running Tests

```bash
# Run all contract tests
cd frontend
npm test -- contract

# Run specific test file
npm test -- auth.contract.test.ts

# Run with coverage
npm test -- --coverage contract

# Run in watch mode
npm test -- --watch contract

# Run in UI mode (Vitest UI)
npm test -- --ui contract
```

## Test Structure

### API Contract Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { apiClient } from '@/services/api';

describe('Authentication API Contract', () => {
  const server = setupServer();

  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('POST /api/auth/login returns LoginResponse schema', async () => {
    // Arrange: Mock API response
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            userid: 42,
            username: 'dechawat',
            firstName: 'Dechawat',
            lastName: 'Wongsirasawat',
            authSource: 'LDAP',
            permissions: ['partial-picking']
          }
        });
      })
    );

    // Act
    const response = await apiClient.login('dechawat', 'password');

    // Assert: Validate response matches LoginResponse type
    expect(response.token).toBeTruthy();
    expect(response.user.username).toBe('dechawat');
    expect(response.user.authSource).toBe('LDAP');
  });
});
```

### WebSocket Contract Tests

```typescript
import { describe, it, expect } from 'vitest';
import { WS } from 'vitest-websocket-mock';
import { useWeightScale } from '@/hooks/useWeightScale';
import { renderHook, waitFor } from '@testing-library/react';

describe('Weight Scale WebSocket Contract', () => {
  it('receives weightUpdate messages with correct schema', async () => {
    // Arrange: Mock WebSocket server
    const server = new WS('ws://localhost:5000/ws/scale/WS-001/small');

    const { result } = renderHook(() => useWeightScale('WS-001', 'small'));

    await server.connected;

    // Act: Send weight update
    server.send(JSON.stringify({
      type: 'weightUpdate',
      weight: 20.025,
      unit: 'KG',
      stable: true,
      scaleId: 'SCALE-SMALL-01',
      scaleType: 'SMALL',
      timestamp: new Date().toISOString()
    }));

    // Assert: Hook state updated
    await waitFor(() => {
      expect(result.current.weight).toBe(20.025);
      expect(result.current.stable).toBe(true);
      expect(result.current.online).toBe(true);
    });

    server.close();
  });
});
```

## Expected Test Results (Initial State)

All tests should **FAIL** initially:

```
 FAIL  tests/contract/api/auth.contract.test.ts
  ● Authentication API Contract › POST /api/auth/login returns LoginResponse schema
    TypeError: Cannot read property 'login' of undefined
      apiClient is not implemented yet

 FAIL  tests/contract/websocket/weight-scale.contract.test.ts
  ● Weight Scale WebSocket Contract › receives weightUpdate messages
    Error: useWeightScale hook not implemented

Total: 18 failed, 0 passed
```

This is **expected** - tests drive implementation.

## Test Coverage Goals

### API Contracts (12 tests)
- Authentication: 3 tests (login LDAP, login SQL, refresh token)
- Runs: 2 tests (get run details, get batch items)
- Picking: 4 tests (save pick, unpick, validation errors)
- Lots: 2 tests (get available lots FEFO sorted)
- Workstations: 1 test (get workstation config)

### WebSocket Contracts (3 tests)
- Weight updates: continuous stream
- Scale offline/online: connection lifecycle
- Error handling: reconnection

### Component Contracts (3 tests)
- LoginPage: LDAP/SQL authentication flow
- PartialPickingPage: End-to-end picking flow
- WeightProgressBar: Real-time weight display

**Total**: ~18 frontend contract tests

## Mock Service Worker Setup

```typescript
// setup/mock-handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();

    // Simulate LDAP authentication
    if (body.username === 'dechawat' && body.password === 'TestPassword123') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        user: {
          userid: 42,
          username: 'dechawat',
          firstName: 'Dechawat',
          lastName: 'Wongsirasawat',
          authSource: 'LDAP',
          permissions: ['partial-picking']
        }
      });
    }

    // Invalid credentials
    return HttpResponse.json(
      {
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid credentials',
          correlationId: 'test-correlation-id'
        }
      },
      { status: 401 }
    );
  }),

  http.get('/api/runs/:runNo', ({ params }) => {
    return HttpResponse.json({
      runNo: parseInt(params.runNo),
      fgItemKey: 'TSM2285A',
      fgDescription: 'Marinade, Savory',
      batches: [1, 2],
      productionDate: '2025-10-06',
      status: 'NEW',
      noOfBatches: 2
    });
  }),

  // ... more handlers
];
```

## Type Safety

All API responses validated against TypeScript types from `contracts/openapi.yaml`:

```typescript
// src/types/api.ts (generated from OpenAPI spec)

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

export interface UserDTO {
  userid: number;
  username: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  authSource: 'LOCAL' | 'LDAP';
  permissions: string[];
}

// Test validation
it('validates LoginResponse schema', async () => {
  const response: LoginResponse = await apiClient.login('user', 'pass');

  // TypeScript ensures response matches interface
  expect(response.token).toBeTypeOf('string');
  expect(response.user.authSource).toMatch(/LOCAL|LDAP/);
});
```

## Next Steps

1. Setup MSW handlers for all API endpoints
2. Create WebSocket mock server
3. Write failing API contract tests
4. Write failing WebSocket contract tests
5. Write failing component contract tests
6. Implement API client to make tests pass
7. Implement hooks and components to make tests pass
