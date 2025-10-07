// Authentication API Contract Tests
// Validates API integration against contracts/openapi.yaml

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// API client (not yet implemented - tests will fail)
import { apiClient } from '@/services/api';
import type { LoginResponse, UserDTO, ErrorResponse } from '@/types/api';

// =============================================================================
// MSW Mock Server Setup
// =============================================================================

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// =============================================================================
// POST /api/auth/login - LDAP Authentication
// =============================================================================

describe('POST /api/auth/login - LDAP', () => {
  it('returns LoginResponse schema on successful LDAP authentication', async () => {
    // Arrange: Mock successful LDAP authentication
    server.use(
      http.post('http://localhost:7075/api/auth/login', async ({ request }) => {
        const body = await request.json() as any;

        if (body.username === 'dechawat' && body.password === 'TestPassword123') {
          return HttpResponse.json<LoginResponse>({
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyaWQiOjQyLCJ1c2VybmFtZSI6ImRlY2hhd2F0In0.abc123',
            user: {
              userid: 42,
              username: 'dechawat',
              firstName: 'Dechawat',
              lastName: 'Wongsirasawat',
              department: 'Warehouse',
              authSource: 'LDAP',
              permissions: ['putaway', 'picking', 'partial-picking']
            }
          });
        }

        return HttpResponse.json(
          { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials', correlationId: 'test' } },
          { status: 401 }
        );
      })
    );

    // Act
    const response = await apiClient.login('dechawat', 'TestPassword123');

    // Assert: Validate LoginResponse schema
    expect(response).toBeDefined();
    expect(response.token).toMatch(/^eyJ/); // JWT starts with eyJ
    expect(response.user).toBeDefined();
    expect(response.user.userid).toBe(42);
    expect(response.user.username).toBe('dechawat');
    expect(response.user.authSource).toBe('LDAP');
    expect(response.user.permissions).toContain('partial-picking');
  });

  it('returns ErrorResponse schema on invalid LDAP credentials', async () => {
    // Arrange: Mock failed authentication
    server.use(
      http.post('http://localhost:7075/api/auth/login', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'AUTH_INVALID_CREDENTIALS',
              message: 'Invalid credentials',
              correlationId: 'test-correlation-id',
              details: null
            }
          },
          { status: 401 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.login('dechawat', 'WrongPassword')
    ).rejects.toMatchObject({
      status: 401,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: expect.stringContaining('Invalid credentials')
      }
    });
  });

  it('handles LDAP server unreachable with fallback error', async () => {
    // Arrange: Mock LDAP server unavailable
    server.use(
      http.post('http://localhost:7075/api/auth/login', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'AUTH_LDAP_UNAVAILABLE',
              message: 'LDAP server unreachable - authentication failed',
              correlationId: 'test-correlation-id',
              details: {
                ldapUrl: 'ldap://192.168.0.1',
                fallbackAttempted: true
              }
            }
          },
          { status: 503 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.login('dechawat', 'TestPassword123')
    ).rejects.toMatchObject({
      status: 503,
      error: {
        code: 'AUTH_LDAP_UNAVAILABLE'
      }
    });
  });
});

// =============================================================================
// POST /api/auth/login - SQL Authentication
// =============================================================================

describe('POST /api/auth/login - SQL', () => {
  it('returns LoginResponse schema on successful SQL authentication', async () => {
    // Arrange: Mock SQL authentication
    server.use(
      http.post('http://localhost:7075/api/auth/login', async ({ request }) => {
        const body = await request.json() as any;

        if (body.username === 'warehouse_user' && body.password === 'SqlPassword456') {
          return HttpResponse.json<LoginResponse>({
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sql-auth-token',
            user: {
              userid: 50,
              username: 'warehouse_user',
              firstName: 'Warehouse',
              lastName: 'User',
              department: 'Operations',
              authSource: 'LOCAL',
              permissions: ['partial-picking']
            }
          });
        }

        return HttpResponse.json(
          { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials', correlationId: 'test' } },
          { status: 401 }
        );
      })
    );

    // Act
    const response = await apiClient.login('warehouse_user', 'SqlPassword456');

    // Assert
    expect(response.user.authSource).toBe('LOCAL');
    expect(response.user.username).toBe('warehouse_user');
  });
});

// =============================================================================
// POST /api/auth/refresh - Token Refresh
// =============================================================================

describe('POST /api/auth/refresh', () => {
  it('returns new JWT token on successful refresh', async () => {
    // Arrange: Mock token refresh
    const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.old-token';

    server.use(
      http.post('http://localhost:7075/api/auth/refresh', ({ request }) => {
        const authHeader = request.headers.get('Authorization');

        if (authHeader === `Bearer ${oldToken}`) {
          return HttpResponse.json({
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-token'
          });
        }

        return HttpResponse.json(
          { error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid token', correlationId: 'test' } },
          { status: 401 }
        );
      })
    );

    // Act
    const response = await apiClient.refreshToken(oldToken);

    // Assert
    expect(response.token).toBeDefined();
    expect(response.token).not.toBe(oldToken);
    expect(response.token).toMatch(/^eyJ/);
  });

  it('returns error on expired token', async () => {
    // Arrange: Mock expired token
    server.use(
      http.post('http://localhost:7075/api/auth/refresh', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'AUTH_INVALID_TOKEN',
              message: 'Token expired',
              correlationId: 'test-correlation-id',
              details: null
            }
          },
          { status: 401 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.refreshToken('expired-token')
    ).rejects.toMatchObject({
      status: 401,
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: expect.stringContaining('expired')
      }
    });
  });
});

// =============================================================================
// GET /api/auth/me - Current User
// =============================================================================

describe('GET /api/auth/me', () => {
  it('returns UserDTO schema for authenticated user', async () => {
    // Arrange: Mock authenticated request
    const token = 'valid-jwt-token';

    server.use(
      http.get('http://localhost:7075/api/auth/me', ({ request }) => {
        const authHeader = request.headers.get('Authorization');

        if (authHeader === `Bearer ${token}`) {
          return HttpResponse.json<UserDTO>({
            userid: 42,
            username: 'dechawat',
            firstName: 'Dechawat',
            lastName: 'Wongsirasawat',
            department: 'Warehouse',
            authSource: 'LDAP',
            permissions: ['partial-picking']
          });
        }

        return HttpResponse.json(
          { error: { code: 'AUTH_INVALID_TOKEN', message: 'Unauthorized', correlationId: 'test' } },
          { status: 401 }
        );
      })
    );

    // Act
    const user = await apiClient.getCurrentUser(token);

    // Assert
    expect(user.userid).toBe(42);
    expect(user.username).toBe('dechawat');
    expect(user.firstName).toBe('Dechawat');
    expect(user.authSource).toBe('LDAP');
  });

  it('returns error when no token provided', async () => {
    // Arrange: Mock unauthorized request
    server.use(
      http.get('http://localhost:7075/api/auth/me', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'AUTH_INVALID_TOKEN',
              message: 'No authorization token provided',
              correlationId: 'test-correlation-id',
              details: null
            }
          },
          { status: 401 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.getCurrentUser('')
    ).rejects.toMatchObject({
      status: 401,
      error: {
        code: 'AUTH_INVALID_TOKEN'
      }
    });
  });
});
