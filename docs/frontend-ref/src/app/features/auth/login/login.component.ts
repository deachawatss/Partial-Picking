import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;

  // Angular 20 Signals for reactive state management
  private _isLoading = signal<boolean>(false);
  private _loginError = signal<string>('');
  private _connectionStatus = signal<'unknown' | 'connected' | 'disconnected'>('unknown');

  // Public readonly signals
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly loginError = this._loginError.asReadonly();
  public readonly connectionStatus = this._connectionStatus.asReadonly();

  // Computed signals
  public readonly hasError = computed(() => this._loginError().length > 0);
  public readonly isConnected = computed(() => this._connectionStatus() === 'connected');
  public readonly canSubmit = computed(() => {
    const form = this.loginForm;
    if (!form) return false;

    const username = form.get('username');
    const password = form.get('password');

    const isUsernameValid = username?.value?.trim().length >= 2;
    const isPasswordValid = password?.value?.trim().length >= 1;
    const isNotLoading = !this._isLoading();

    return isUsernameValid && isPasswordValid && isNotLoading;
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(100)
      ]]
    });
  }

  ngOnInit(): void {
    // Check if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/partial-picking']);
      return;
    }

    // Test backend connection on component initialization
    this.testConnection();

    // Auto-retry connection every 10 seconds if disconnected
    const connectionRetryInterval = setInterval(() => {
      if (this._connectionStatus() === 'disconnected') {
        this.testConnection();
      }
    }, 10000);

    // Monitor authentication state changes using effect (Angular 20)
    // Note: In real implementation, use effect() from @angular/core for signal-based reactivity
    // For now, check authentication state periodically or use a different approach
    const authCheckInterval = setInterval(() => {
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/partial-picking']);
        clearInterval(authCheckInterval);
        clearInterval(connectionRetryInterval);
      }
    }, 1000);

    // Auto-focus username field for better UX
    setTimeout(() => {
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    }, 100);
  }

  /**
   * Test connection to backend with retry logic
   */
  testConnection(attempt: number = 1, maxAttempts: number = 3): void {
    this._connectionStatus.set('unknown');

    // If this is a retry attempt, show more specific messaging
    if (attempt > 1) {
      this._loginError.set(`Connecting to backend... (attempt ${attempt}/${maxAttempts})`);
    }

    this.authService.testConnection().subscribe({
      next: (isConnected) => {
        this._connectionStatus.set(isConnected ? 'connected' : 'disconnected');
        if (!isConnected) {
          this._loginError.set('Backend server is not reachable. Start all services with `npm run dev:all` or verify the Rust backend on port 7070.');
        } else {
          this._loginError.set('');
        }
      },
      error: () => {
        // If we haven't reached max attempts, retry with exponential backoff
        if (attempt < maxAttempts) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s, max 5s
          this._loginError.set(`Connection failed. Retrying in ${Math.ceil(retryDelay / 1000)}s... (${attempt}/${maxAttempts})`);

          setTimeout(() => {
            this.testConnection(attempt + 1, maxAttempts);
          }, retryDelay);
        } else {
          // All retry attempts exhausted
          this._connectionStatus.set('disconnected');
          this._loginError.set(`Backend server is not reachable after ${maxAttempts} attempts.

💡 **Solution**: Run \`npm run dev:all\` to start all services with automatic cleanup.

🔧 **Technical**: This prevents port conflicts by automatically running \`npm run dev:clean\` first, then starting the Rust backend on port 7070, Angular frontend on 6060, and C# bridge service on 5000.`);
        }
      }
    });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (!this.canSubmit()) {
      this.markAllFieldsAsTouched();
      return;
    }

    this._isLoading.set(true);
    this._loginError.set('');
    this.loginForm.disable();

    const { username, password } = this.loginForm.value;

    this.authService.login(username.trim(), password).subscribe({
      next: (response) => {
        this._isLoading.set(false);
        this.loginForm.enable();

        if (response.success) {
          // Success - navigation will be handled by the auth state subscription
          console.log('Login successful');
        } else {
          this._loginError.set(response.message || 'Login failed');
          if (this._connectionStatus() === 'disconnected') {
            setTimeout(() => this.testConnection(), 1000);
          }
        }
      },
      error: (error) => {
        this._isLoading.set(false);
        this.loginForm.enable();

        const errorMessage = error.message || 'Login failed. Please try again.';
        this._loginError.set(errorMessage);

        // Re-test connection on error
        setTimeout(() => this.testConnection(), 1000);
      }
    });
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  /**
   * Get connection status text for display
   */
  getConnectionStatusText(): string {
    switch (this._connectionStatus()) {
      case 'connected':
        return 'Backend Connected';
      case 'disconnected':
        return 'Backend Disconnected';
      default:
        return 'Checking Connection...';
    }
  }

  /**
   * Get connection status icon class
   */
  getConnectionStatusIconClass(): string {
    switch (this._connectionStatus()) {
      case 'connected':
        return 'nwfth-indicator-connected';
      case 'disconnected':
        return 'nwfth-indicator-disconnected';
      default:
        return 'nwfth-indicator-connecting';
    }
  }

  /**
   * Get connection status container class
   */
  getConnectionStatusClass(): string {
    switch (this._connectionStatus()) {
      case 'connected':
        return 'nwfth-status-connected';
      case 'disconnected':
        return 'nwfth-status-disconnected';
      default:
        return 'nwfth-status-connecting';
    }
  }

  /**
   * Get ARIA label for connection status
   */
  getConnectionStatusAriaLabel(): string {
    switch (this._connectionStatus()) {
      case 'connected':
        return 'System connected successfully';
      case 'disconnected':
        return 'System connection failed';
      default:
        return 'Checking system connection';
    }
  }

  /**
   * Check if a form field has a specific error
   */
  hasFieldError(fieldName: string, errorType: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.hasError(errorType) && field.touched);
  }

  /**
   * Get error message for a specific field
   */
  getFieldErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.touched || !field.errors) {
      return '';
    }

    if (field.errors['required']) {
      return `${this.getFieldDisplayName(fieldName)} is required`;
    }

    if (field.errors['minlength']) {
      const requiredLength = field.errors['minlength'].requiredLength;
      return `${this.getFieldDisplayName(fieldName)} must be at least ${requiredLength} characters`;
    }

    if (field.errors['maxlength']) {
      const requiredLength = field.errors['maxlength'].requiredLength;
      return `${this.getFieldDisplayName(fieldName)} must not exceed ${requiredLength} characters`;
    }

    return 'Invalid input';
  }

  /**
   * Get display name for form field
   */
  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      username: 'Username',
      password: 'Password'
    };
    return displayNames[fieldName] || fieldName;
  }


  /**
   * Clear login error
   */
  clearError(): void {
    this._loginError.set('');
  }

  /**
   * Handle Enter key press on form fields
   */
  onFieldKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.canSubmit()) {
      this.onSubmit();
    }
  }
}
