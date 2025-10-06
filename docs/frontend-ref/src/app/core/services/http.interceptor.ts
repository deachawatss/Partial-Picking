import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthHttpInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the current token
    const token = this.authService.getToken();

    // Clone the request and add authorization header if token exists
    let authReq = request;
    if (token) {
      authReq = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    // Add custom headers for PK system
    authReq = authReq.clone({
      headers: authReq.headers
        .set('Content-Type', 'application/json')
        .set('X-Workstation-Id', this.getWorkstationId())
        .set('X-Requested-With', 'PK-Frontend')
    });

    // Handle the request and potential errors
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle token expiration (401 Unauthorized)
        if (error.status === 401 && this.authService.isAuthenticatedSync()) {
          // Try to refresh the token
          return this.authService.refreshToken().pipe(
            switchMap(() => {
              // Retry the original request with new token
              const newToken = this.authService.getToken();
              if (newToken) {
                const retryReq = request.clone({
                  headers: request.headers.set('Authorization', `Bearer ${newToken}`)
                });
                return next.handle(retryReq);
              }
              return throwError(() => error);
            }),
            catchError(() => {
              // Refresh failed, logout user
              this.authService.logout();
              return throwError(() => error);
            })
          );
        }

        // Handle other error responses
        this.handleHttpError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get workstation ID for request headers
   */
  private getWorkstationId(): string {
    return this.authService.workstationId() || 'unknown';
  }

  /**
   * Handle HTTP errors and update connection status
   */
  private handleHttpError(error: HttpErrorResponse): void {
    switch (error.status) {
      case 0:
        // Network error or CORS issue
        console.error('Network error - backend may be unavailable');
        break;
      case 403:
        console.error('Access forbidden - insufficient permissions');
        break;
      case 404:
        console.error('Resource not found');
        break;
      case 500:
        console.error('Internal server error');
        break;
      default:
        console.error(`HTTP error ${error.status}: ${error.message}`);
    }
  }
}