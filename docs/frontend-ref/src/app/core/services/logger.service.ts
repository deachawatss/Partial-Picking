import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private currentLogLevel: LogLevel = environment.production ? LogLevel.WARN : LogLevel.DEBUG;
  private readonly prefix = '[PK]';

  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.DEBUG) {
      console.debug(`${this.prefix} [DEBUG]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      console.info(`${this.prefix} [INFO]`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.WARN) {
      console.warn(`${this.prefix} [WARN]`, message, ...args);
    }
  }

  error(message: string, error?: any): void {
    if (this.currentLogLevel <= LogLevel.ERROR) {
      console.error(`${this.prefix} [ERROR]`, message, error);
    }
  }

  // Convenience method for component lifecycle logging
  lifecycle(component: string, event: string, data?: any): void {
    this.debug(`[${component}] ${event}`, data);
  }

  // Convenience method for API call logging
  api(method: string, url: string, data?: any): void {
    this.debug(`[API] ${method} ${url}`, data);
  }

  // Convenience method for WebSocket logging
  websocket(event: string, data?: any): void {
    this.debug(`[WebSocket] ${event}`, data);
  }
}
