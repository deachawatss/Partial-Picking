import { ApplicationConfig, importProvidersFrom, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthHttpInterceptor } from './core/services/http.interceptor';
import { GlobalErrorHandler } from './core/services/global-error-handler.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Router configuration
    provideRouter(routes),

    // HTTP client with interceptors
    provideHttpClient(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthHttpInterceptor,
      multi: true
    },

    // Global error handler
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },

    // Animations
    provideAnimations(),

    // Additional providers can be added here
  ]
};