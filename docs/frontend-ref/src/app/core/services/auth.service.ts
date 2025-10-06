import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, BehaviorSubject, timer, throwError } from 'rxjs';
import { catchError, map, tap, retry, delay, timeout } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

// Authentication Token Interface
interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user_id: string;
  username: string;
}

// Authentication Response Interface
interface AuthResponse {
  success: boolean;
  message: string;
  token?: AuthToken;
  user?: User;
}

// User Interface
interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  department: string;
  auth_source: string;
  workstation_id?: string;
  app_permissions: string[];
}

// Connection Status Type
type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_BASE = this.getApiBaseUrl();
  private readonly TOKEN_KEY = 'pk_auth_token';
  private readonly TOKEN_DATA_KEY = 'pk_auth_token_data';
  private readonly USER_KEY = 'pk_auth_user';
  private readonly SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 1 week (matches backend)

  // Angular 20 Signals for reactive state management
  private _isAuthenticated = signal<boolean>(false);
  private _currentUser = signal<User | null>(null);
  private _connectionStatus = signal<ConnectionStatus>('unknown');
  private _sessionTimeout = signal<number | null>(null);

  // Computed signals
  public readonly isAuthenticated = this._isAuthenticated.asReadonly();
  public readonly currentUser = this._currentUser.asReadonly();
  public readonly connectionStatus = this._connectionStatus.asReadonly();

  // Computed properties
  public readonly isConnected = computed(() => this._connectionStatus() === 'connected');
  public readonly userDisplayName = computed(() => this._currentUser()?.display_name || '');
  public readonly workstationId = computed(() => this._currentUser()?.workstation_id || '');
  public readonly userDepartment = computed(() => this._currentUser()?.department || '');
  public readonly authSource = computed(() => this._currentUser()?.auth_source || '');
  public readonly hasPermission = computed(() => (permission: string) => {
    const permissions = this._currentUser()?.app_permissions || [];
    return permissions.includes(permission) || permissions.includes('1'); // Admin permission
  });

  // Session management
  private sessionTimer?: ReturnType<typeof setTimeout>;
  private lastActivity = new BehaviorSubject<Date>(new Date());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuth();
    this.startSessionMonitoring();
  }

  /**
   * Initialize authentication state from stored tokens
   */
  private initializeAuth(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const tokenDataJson = localStorage.getItem(this.TOKEN_DATA_KEY);
    const userJson = localStorage.getItem(this.USER_KEY);

    if (token && tokenDataJson && userJson) {
      try {
        const tokenData: AuthToken = JSON.parse(tokenDataJson);
        const user: User = JSON.parse(userJson);

        // Check if token is still valid
        if (this.isTokenValid(tokenData)) {
          this._isAuthenticated.set(true);
          this._currentUser.set(user);
          this.setupSessionTimeout(tokenData);
        } else {
          console.warn('Stored token has expired, clearing auth data');
          this.clearAuthData();
        }
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        this.clearAuthData();
      }
    }
  }

  /**
   * Login with username and password
   */
  login(username: string, password: string): Observable<AuthResponse> {
    const loginData = {
      username: username.trim(),
      password: password,
      workstation_id: this.getWorkstationId()
    };

    return this.http.post<AuthResponse>(`${this.API_BASE}/auth/login`, loginData).pipe(
      timeout(10000), // 10 second timeout for login
      tap(response => {
        if (response.success && response.token && response.user) {
          this.storeAuthData(response.token, response.user);
          this._isAuthenticated.set(true);
          this._currentUser.set(response.user);
          this.setupSessionTimeout(response.token);
          this.updateLastActivity();
        }
      }),
      catchError(this.handleAuthError.bind(this))
    );
  }

  /**
   * Logout and clear authentication data
   */
  logout(): void {
    this.clearAuthData();
    this._isAuthenticated.set(false);
    this._currentUser.set(null);
    this.clearSessionTimeout();
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticatedSync(): boolean {
    return this._isAuthenticated();
  }

  /**
   * Get current authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Test connection to backend with retry logic
   */
  testConnection(): Observable<boolean> {
    return this.http.get(`${this.API_BASE}/health`, { responseType: 'text' }).pipe(
      timeout(5000), // 5 second timeout
      retry({ count: 3, delay: 1000 }), // Retry 3 times with 1 second delay
      map(() => {
        this._connectionStatus.set('connected');
        return true;
      }),
      catchError((error: HttpErrorResponse) => {
        console.warn('🔌 Backend connection test failed:', error.message);
        this._connectionStatus.set('disconnected');
        return of(false);
      })
    );
  }

  /**
   * Refresh authentication token
   */
  refreshToken(): Observable<AuthResponse> {
    const currentToken = this.getToken();

    if (!currentToken) {
      return throwError(() => new Error('No token available for refresh'));
    }

    return this.http.post<AuthResponse>(`${this.API_BASE}/auth/refresh`, {
      token: currentToken,
      workstationId: this.getWorkstationId()
    }).pipe(
      tap(response => {
        if (response.success && response.token && response.user) {
          this.storeAuthData(response.token, response.user);
          this.setupSessionTimeout();
          this.updateLastActivity();
        }
      }),
      catchError(this.handleAuthError.bind(this))
    );
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(): void {
    this.lastActivity.next(new Date());
    // For 1-week tokens, we don't need to reset timeout on activity
    // Token expiry is fixed at issue time
  }

  /**
   * Get API base URL from environment configuration
   */
  private getApiBaseUrl(): string {
    const rawUrl = (environment.apiUrl || '').trim();

    if (rawUrl) {
      return rawUrl;
    }

    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol || 'http:';
      const hostname = window.location.hostname || 'localhost';
      const backendPort = environment.backendPort || parseInt(window.location.port, 10) || 7070;

      const normalizedProtocol = protocol.endsWith(':') ? protocol.slice(0, -1) : protocol;
      const needsPort = backendPort && !((normalizedProtocol === 'http' && backendPort === 80) || (normalizedProtocol === 'https' && backendPort === 443));
      const portSegment = needsPort ? `:${backendPort}` : '';

      return `${normalizedProtocol}://${hostname}${portSegment}/api`;
    }

    // Final fallback: use current host (no hard-coded values)
    return `${window.location.protocol}//${window.location.host}/api`;
  }

  /**
   * Get workstation ID from environment or generate one
   */
  private getWorkstationId(): string {
    // Try to get from environment or browser
    return navigator.userAgent.includes('Chrome') ?
      `WS-${Date.now().toString(36)}` :
      `WS-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store authentication data securely
   */
  private storeAuthData(token: AuthToken, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token.access_token);
    localStorage.setItem(this.TOKEN_DATA_KEY, JSON.stringify(token));
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_DATA_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Setup session timeout monitoring
   */
  private setupSessionTimeout(tokenData?: AuthToken): void {
    this.clearSessionTimeout();

    let expirationTime: number;

    if (tokenData) {
      // Use token expiration time
      expirationTime = tokenData.expires_at * 1000; // Convert to milliseconds
    } else {
      // Fallback to session timeout
      expirationTime = Date.now() + this.SESSION_TIMEOUT;
    }

    const timeUntilExpiry = Math.max(0, expirationTime - Date.now());

    if (timeUntilExpiry > 0) {
      this.sessionTimer = setTimeout(() => {
        console.log('Token expired - logging out');
        this.logout();
      }, timeUntilExpiry);

      this._sessionTimeout.set(expirationTime);
    } else {
      // Token already expired
      this.logout();
    }
  }

  /**
   * Clear session timeout
   */
  private clearSessionTimeout(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = undefined;
    }
    this._sessionTimeout.set(null);
  }

  /**
   * Start monitoring user activity for session management
   */
  private startSessionMonitoring(): void {
    // Monitor user activity events
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        if (this._isAuthenticated()) {
          this.updateLastActivity();
        }
      }, { passive: true });
    });

    // Check for session timeout every minute
    timer(0, 60000).subscribe(() => {
      if (this._isAuthenticated()) {
        const timeout = this._sessionTimeout();
        if (timeout && Date.now() > timeout) {
          console.log('Session expired due to inactivity');
          this.logout();
        }
      }
    });
  }

  /**
   * Handle authentication errors with detailed diagnostics
   */
  private handleAuthError(error: HttpErrorResponse): Observable<AuthResponse> {
    let errorMessage = 'Authentication failed';
    const isNetworkError = error.status === 0 || error.error instanceof ErrorEvent;

    console.error('🔐 Auth error details:', {
      status: error.status,
      message: error.message,
      url: error.url,
      isNetworkError
    });

    if (isNetworkError) {
      // Enhanced network error diagnosis
      const currentApiUrl = environment.apiUrl || this.API_BASE;
      errorMessage = `Unable to connect to backend at ${currentApiUrl}. ` +
        'Please check: (1) Backend server is running, (2) No firewall blocking connections, ' +
        '(3) Correct URL configuration in environment.ts';
      this._connectionStatus.set('disconnected');
    } else if (error.message?.includes('timeout') || error.status === 408) {
      errorMessage = `Connection timeout to backend. Server may be overloaded or unreachable at ${this.API_BASE}`;
      this._connectionStatus.set('disconnected');
    } else {
      this._connectionStatus.set('connected');

      switch (error.status) {
        case 401:
          errorMessage = 'Invalid username or password';
          break;
        case 403:
          errorMessage = 'Access denied - insufficient permissions';
          break;
        case 404:
          errorMessage = 'Authentication endpoint not found - check backend routing';
          break;
        case 500:
          errorMessage = 'Internal server error - check backend logs';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Backend service unavailable - server may be starting up';
          break;
        default:
          errorMessage = `Authentication failed with HTTP ${error.status}: ${error.message}`;
      }
    }

    return of({
      success: false,
      message: errorMessage
    });
  }

  /**
   * Get remaining session time in minutes
   */
  getRemainingSessionTime(): number {
    const timeout = this._sessionTimeout();
    if (!timeout) return 0;

    const remaining = timeout - Date.now();
    return Math.max(0, Math.floor(remaining / (60 * 1000)));
  }

  /**
   * Check if session is about to expire (within 5 minutes)
   */
  isSessionExpiringSoon(): boolean {
    return this.getRemainingSessionTime() <= 5;
  }

  /**
   * Check if token is still valid
   */
  private isTokenValid(tokenData: AuthToken): boolean {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const expiresAt = tokenData.expires_at;
    const timeUntilExpiry = expiresAt - now;

    // Token is expired
    if (timeUntilExpiry <= 0) {
      console.warn('🕐 JWT token has expired');
      return false;
    }

    // Show warning if token expires in less than 1 day
    if (timeUntilExpiry < 86400) { // 24 hours in seconds
      const hoursLeft = Math.floor(timeUntilExpiry / 3600);
      console.warn(`⚠️ Token will expire in ${hoursLeft} hours`);
    }

    return true;
  }

  /**
   * Get stored token data
   */
  getStoredTokenData(): AuthToken | null {
    const tokenDataJson = localStorage.getItem(this.TOKEN_DATA_KEY);
    if (tokenDataJson) {
      try {
        return JSON.parse(tokenDataJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if current session is valid
   */
  isValidSession(): boolean {
    const tokenData = this.getStoredTokenData();
    const user = this._currentUser();
    const token = this.getToken();

    return !!(token && tokenData && user && this.isTokenValid(tokenData));
  }

}
