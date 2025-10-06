import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {

    // Check if user is authenticated synchronously first
    if (this.authService.isAuthenticatedSync()) {

      // Check if session is still valid (token not expired)
      if (this.authService.isValidSession()) {
        // User is authenticated with valid token
        this.authService.updateLastActivity();
        return true;
      } else {
        // Token expired, logout and redirect to login
        console.log('Token expired, redirecting to login');
        this.authService.logout();
        this.redirectToLogin(state.url);
        return false;
      }
    }

    // User is not authenticated, redirect to login
    this.redirectToLogin(state.url);
    return false;
  }

  /**
   * Redirect to login page with return URL
   */
  private redirectToLogin(returnUrl: string): void {
    if (returnUrl && returnUrl !== '/') {
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
    } else {
      this.router.navigate(['/login']);
    }
  }
}

/**
 * Guest guard - prevents authenticated users from accessing login page
 */
@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authService.isAuthenticatedSync()) {
      // User is already authenticated, redirect to partial picking
      this.router.navigate(['/partial-picking']);
      return false;
    }

    return true;
  }
}