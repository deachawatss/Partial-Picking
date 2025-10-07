/**
 * Authentication API Service
 *
 * Service methods for authentication endpoints:
 * - login: POST /api/auth/login
 * - refreshToken: POST /api/auth/refresh
 * - getCurrentUser: GET /api/auth/me
 *
 * Constitutional Requirement: Contract-first development
 * Matches specs/001-i-have-an/contracts/openapi.yaml authentication endpoints
 */

import { apiClient } from './client'
import { LoginRequest, LoginResponse, UserDTO } from '@/types/api'

/**
 * Authenticate user with LDAP or SQL credentials
 *
 * OpenAPI Operation: POST /api/auth/login
 * Authentication Flow:
 * 1. Attempt LDAP authentication against LDAP_URL
 * 2. If LDAP fails/unreachable, fallback to SQL authentication
 * 3. Return JWT token with user details
 *
 * @param username - User's username (LDAP or SQL)
 * @param password - User's password (LDAP or SQL)
 * @returns Promise<LoginResponse> - JWT token and user details
 * @throws ErrorResponse - On authentication failure or network error
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const request: LoginRequest = {
    username: username.trim(),
    password, // Don't trim password - may have intentional whitespace
  }

  const response = await apiClient.post<LoginResponse>('/auth/login', request)
  return response.data
}

/**
 * Refresh JWT token before expiration
 *
 * OpenAPI Operation: POST /api/auth/refresh
 * Uses existing token from Authorization header (added by interceptor)
 *
 * @returns Promise<{ token: string }> - New JWT token
 * @throws ErrorResponse - On token refresh failure or invalid token
 */
export async function refreshToken(): Promise<{ token: string }> {
  const response = await apiClient.post<{ token: string }>('/auth/refresh')
  return response.data
}

/**
 * Get current user details from JWT token
 *
 * OpenAPI Operation: GET /api/auth/me
 * Uses existing token from Authorization header (added by interceptor)
 *
 * @returns Promise<UserDTO> - Current user details
 * @throws ErrorResponse - On authentication failure or invalid token
 */
export async function getCurrentUser(): Promise<UserDTO> {
  const response = await apiClient.get<UserDTO>('/auth/me')
  return response.data
}

/**
 * Auth API Service Object
 * Provides all authentication-related API methods
 */
export const authApi = {
  login,
  refreshToken,
  getCurrentUser,
}

export default authApi
