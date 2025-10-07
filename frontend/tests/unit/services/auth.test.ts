/**
 * Authentication Service Tests
 *
 * Unit tests for authentication API client and service methods
 * Tests against specs/001-i-have-an/contracts/openapi.yaml
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authApi } from '@/services/api/auth';
import { apiClient } from '@/services/api/client';
import type { LoginResponse, UserDTO } from '@/types/api';

// Mock axios client
vi.mock('@/services/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
}));

describe('Authentication API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login()', () => {
    it('should authenticate user and return JWT token with user details', async () => {
      // Arrange
      const mockResponse: LoginResponse = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          userid: 42,
          username: 'dechawat',
          firstName: 'Dechawat',
          lastName: 'Wongsirasawat',
          department: 'Warehouse',
          authSource: 'LDAP',
          permissions: ['putaway', 'picking', 'partial-picking'],
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      // Act
      const result = await authApi.login('dechawat', 'P@ssw0rd123');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        username: 'dechawat',
        password: 'P@ssw0rd123',
      });
      expect(result).toEqual(mockResponse);
      expect(result.token).toBeTruthy();
      expect(result.user.username).toBe('dechawat');
      expect(result.user.authSource).toBe('LDAP');
    });

    it('should trim username but not password', async () => {
      // Arrange
      const mockResponse: LoginResponse = {
        token: 'mock_token',
        user: {
          userid: 1,
          username: 'testuser',
          authSource: 'LOCAL',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      // Act
      await authApi.login('  testuser  ', ' password ');

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: ' password ', // Password NOT trimmed
      });
    });

    it('should handle authentication failure', async () => {
      // Arrange
      const mockError = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
          correlationId: 'test-correlation-id',
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      // Act & Assert
      await expect(authApi.login('invalid', 'wrong')).rejects.toEqual(mockError);
    });
  });

  describe('refreshToken()', () => {
    it('should refresh JWT token', async () => {
      // Arrange
      const mockResponse = {
        token: 'new_jwt_token_here',
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      // Act
      const result = await authApi.refreshToken();

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh');
      expect(result).toEqual(mockResponse);
      expect(result.token).toBeTruthy();
    });

    it('should handle token refresh failure', async () => {
      // Arrange
      const mockError = {
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token expired or invalid',
          correlationId: 'test-correlation-id',
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      // Act & Assert
      await expect(authApi.refreshToken()).rejects.toEqual(mockError);
    });
  });

  describe('getCurrentUser()', () => {
    it('should retrieve current user details', async () => {
      // Arrange
      const mockUser: UserDTO = {
        userid: 42,
        username: 'dechawat',
        firstName: 'Dechawat',
        lastName: 'Wongsirasawat',
        department: 'Warehouse',
        authSource: 'LDAP',
        permissions: ['putaway', 'picking', 'partial-picking'],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockUser });

      // Act
      const result = await authApi.getCurrentUser();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
      expect(result.username).toBe('dechawat');
    });

    it('should handle unauthorized error', async () => {
      // Arrange
      const mockError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          correlationId: 'test-correlation-id',
        },
      };

      vi.mocked(apiClient.get).mockRejectedValue(mockError);

      // Act & Assert
      await expect(authApi.getCurrentUser()).rejects.toEqual(mockError);
    });
  });
});
