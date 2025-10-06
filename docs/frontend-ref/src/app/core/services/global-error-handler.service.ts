import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from './logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: Error | HttpErrorResponse): void {
    const logger = this.injector.get(LoggerService);

    if (error instanceof HttpErrorResponse) {
      // Server or network error
      if (!navigator.onLine) {
        logger.error('Network error: No internet connection');
        this.showUserMessage('No internet connection. Please check your network.');
      } else {
        logger.error(`HTTP Error: ${error.status}`, {
          url: error.url,
          message: error.message,
          status: error.status
        });

        this.showUserMessage(this.getHttpErrorMessage(error));
      }
    } else {
      // Client-side error
      logger.error('Client Error:', {
        message: error.message,
        stack: error.stack
      });

      this.showUserMessage('An unexpected error occurred. Please try again.');
    }
  }

  private getHttpErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 0:
        return 'Unable to connect to server. Please check if the server is running.';
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Access forbidden. You do not have permission.';
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        return `Server error (${error.status}). Please try again.`;
    }
  }

  private showUserMessage(message: string): void {
    // In production, this could integrate with a toast/notification service
    // For now, using alert for immediate feedback
    if (typeof window !== 'undefined') {
      // Use setTimeout to avoid blocking the error handling
      setTimeout(() => {
        console.error('[User Message]', message);
        // In a real app, replace with a toast notification:
        // this.injector.get(ToastService).error(message);
      }, 0);
    }
  }
}
