import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { retryWhen, delay, takeUntil, tap, catchError, filter, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// WebSocket message interfaces
export interface ScaleWeight {
  scaleId: string;
  weight: number;
  unit: string;
  stable: boolean;
  timestamp: number;
}

export interface ScaleStatus {
  connected: boolean;
  scaleId: string;
  port?: string;
  error?: string;
}

export interface ScaleCommand {
  type: 'tare' | 'calibrate' | 'reset';
  scaleId: string;
}

// Scale type for dual-scale support
export type ScaleType = 'small' | 'big';

// Connection states
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

@Injectable({
  providedIn: 'root'
})
export class WeightScaleService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private wsSmall$?: WebSocketSubject<any>;
  private wsBig$?: WebSocketSubject<any>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 1000; // Start with 1 second

  // Angular 20 signals for reactive state management
  private _activeScaleType = signal<ScaleType>('small'); // Default to SMALL scale
  private _connectionState = signal<ConnectionState>(ConnectionState.DISCONNECTED);
  private _currentWeight = signal<ScaleWeight | null>(null);
  private _smallScaleWeight = signal<ScaleWeight | null>(null);
  private _bigScaleWeight = signal<ScaleWeight | null>(null);
  private _scaleStatus = signal<ScaleStatus[]>([]);
  private _lastError = signal<string>('');

  // Public readonly signals
  public readonly activeScaleType = this._activeScaleType.asReadonly();
  public readonly connectionState = this._connectionState.asReadonly();
  public readonly currentWeight = this._currentWeight.asReadonly();
  public readonly scaleStatus = this._scaleStatus.asReadonly();
  public readonly lastError = this._lastError.asReadonly();

  // Computed signals
  public readonly isConnected = computed(() =>
    this._connectionState() === ConnectionState.CONNECTED
  );

  public readonly hasError = computed(() =>
    this._lastError().length > 0
  );

  public readonly primaryScale = computed(() =>
    this._scaleStatus().find(scale => scale.connected) || null
  );

  constructor() {
    this.connect();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  /**
   * Connect to WebSocket bridge service (dual scale support)
   */
  private connect(): void {
    if (this._connectionState() === ConnectionState.CONNECTING ||
        this._connectionState() === ConnectionState.CONNECTED) {
      return;
    }

    this._connectionState.set(ConnectionState.CONNECTING);
    this._lastError.set('');

    // Connect to both SMALL and BIG scale endpoints
    this.connectToScale('small');
    this.connectToScale('big');
  }

  /**
   * Connect to a specific scale WebSocket endpoint
   */
  private connectToScale(scaleType: ScaleType): void {
    const wsUrl = this.buildWebSocketUrl(scaleType);
    console.log(`Connecting to ${scaleType.toUpperCase()} scale WebSocket: ${wsUrl}`);

    const ws$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          console.log(`[WeightScaleService] ✅ ${scaleType.toUpperCase()} scale WebSocket connected to:`, wsUrl);
          this._connectionState.set(ConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000;
        }
      },
      closeObserver: {
        next: () => {
          console.log(`[WeightScaleService] ❌ ${scaleType.toUpperCase()} scale WebSocket disconnected from:`, wsUrl);
          if (scaleType === 'small') {
            this._smallScaleWeight.set(null);
          } else {
            this._bigScaleWeight.set(null);
          }
        }
      }
    });

    // Store WebSocket reference
    if (scaleType === 'small') {
      this.wsSmall$ = ws$;
    } else {
      this.wsBig$ = ws$;
    }

    // Subscribe to messages
    ws$.pipe(
      takeUntil(this.destroy$),
      retryWhen(errors => errors.pipe(
        tap(error => {
          console.error(`${scaleType.toUpperCase()} scale WebSocket error:`, error);
          this._lastError.set(`${scaleType.toUpperCase()} scale error: ${error.message || 'Unknown error'}`);
          this._connectionState.set(ConnectionState.RECONNECTING);
        }),
        delay(this.getReconnectDelay()),
        filter(() => this.reconnectAttempts < this.maxReconnectAttempts),
        tap(() => {
          this.reconnectAttempts++;
          console.log(`${scaleType.toUpperCase()} scale reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        })
      )),
      catchError(error => {
        console.error(`${scaleType.toUpperCase()} scale WebSocket unrecoverable error:`, error);
        this._connectionState.set(ConnectionState.ERROR);
        this._lastError.set(`${scaleType.toUpperCase()} scale failed to connect after ${this.maxReconnectAttempts} attempts`);
        throw error;
      })
    ).subscribe({
      next: (message) => this.handleMessage(message, scaleType),
      error: (error) => {
        console.error(`${scaleType.toUpperCase()} scale WebSocket stream error:`, error);
        this._connectionState.set(ConnectionState.ERROR);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  private disconnect(): void {
    if (this.wsSmall$) {
      this.wsSmall$.complete();
      this.wsSmall$ = undefined;
    }
    if (this.wsBig$) {
      this.wsBig$.complete();
      this.wsBig$ = undefined;
    }
    this._connectionState.set(ConnectionState.DISCONNECTED);
    this._currentWeight.set(null);
    this._smallScaleWeight.set(null);
    this._bigScaleWeight.set(null);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any, scaleType: ScaleType): void {
    console.log(`[WeightScaleService] ${scaleType.toUpperCase()} scale WebSocket message received:`, JSON.stringify(message, null, 2));

    try {
      switch (message.type) {
        case 'weight':
          console.log(`[WeightScaleService] Processing ${scaleType.toUpperCase()} weight message:`, message.data);
          this.handleWeightMessage(message.data as ScaleWeight, scaleType);
          break;
        case 'status':
          console.log(`[WeightScaleService] Processing ${scaleType.toUpperCase()} status message:`, message.data);
          this.handleStatusMessage(message.data as ScaleStatus);
          break;
        case 'error':
          console.error(`[WeightScaleService] ${scaleType.toUpperCase()} error message received:`, message.data);
          this._lastError.set(message.data.message || 'Unknown error');
          break;
        default:
          console.warn(`[WeightScaleService] Unknown ${scaleType.toUpperCase()} message type:`, message.type, message);
      }
    } catch (error) {
      console.error(`[WeightScaleService] Error handling ${scaleType.toUpperCase()} WebSocket message:`, error, message);
    }
  }

  /**
   * Handle weight data messages
   */
  private handleWeightMessage(weight: ScaleWeight, scaleType: ScaleType): void {
    console.log(`[WeightScaleService] handleWeightMessage called with ${scaleType.toUpperCase()} scale:`, weight);

    // Validate weight data
    if (!weight.scaleId || typeof weight.weight !== 'number') {
      console.warn(`[WeightScaleService] Invalid ${scaleType.toUpperCase()} weight data:`, weight);
      return;
    }

    // Update weight data with timestamp
    const weightData = {
      ...weight,
      timestamp: Date.now()
    };

    // Update scale-specific weight signal
    if (scaleType === 'small') {
      console.log('[WeightScaleService] Setting SMALL scale weight signal:', weightData);
      this._smallScaleWeight.set(weightData);
    } else {
      console.log('[WeightScaleService] Setting BIG scale weight signal:', weightData);
      this._bigScaleWeight.set(weightData);
    }

    // Update current weight if this is the active scale
    if (this._activeScaleType() === scaleType) {
      console.log('[WeightScaleService] Updating current weight from active scale:', scaleType.toUpperCase());
      this._currentWeight.set(weightData);
    }

    // Clear any previous errors
    this._lastError.set('');

    console.log('[WeightScaleService] Weight updated successfully. Active scale:', this._activeScaleType(), 'Current weight:', this._currentWeight());
  }

  /**
   * Handle scale status messages
   */
  private handleStatusMessage(status: ScaleStatus): void {
    const currentStatus = this._scaleStatus();
    const existingIndex = currentStatus.findIndex(s => s.scaleId === status.scaleId);

    if (existingIndex >= 0) {
      // Update existing scale status
      const updatedStatus = [...currentStatus];
      updatedStatus[existingIndex] = status;
      this._scaleStatus.set(updatedStatus);
    } else {
      // Add new scale status
      this._scaleStatus.set([...currentStatus, status]);
    }
  }

  /**
   * Get reconnect delay with exponential backoff
   */
  private getReconnectDelay(): number {
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 30000);
    return delay;
  }

  /**
   * Switch active scale (SMALL or BIG)
   */
  public switchScale(scaleType: ScaleType): void {
    console.log(`[WeightScaleService] Switching to ${scaleType.toUpperCase()} scale`);
    this._activeScaleType.set(scaleType);

    // Update current weight from the newly selected scale
    const newWeight = scaleType === 'small' ? this._smallScaleWeight() : this._bigScaleWeight();
    if (newWeight) {
      this._currentWeight.set(newWeight);
      console.log(`[WeightScaleService] Current weight updated to ${scaleType.toUpperCase()} scale:`, newWeight);
    } else {
      console.log(`[WeightScaleService] No weight data available for ${scaleType.toUpperCase()} scale yet`);
    }
  }

  /**
   * Send command to scale
   */
  public sendCommand(command: ScaleCommand): void {
    const activeScale = this._activeScaleType();
    const ws$ = activeScale === 'small' ? this.wsSmall$ : this.wsBig$;

    if (!this.isConnected() || !ws$) {
      console.warn(`Cannot send command: ${activeScale.toUpperCase()} scale WebSocket not connected`);
      return;
    }

    try {
      ws$.next({
        type: 'command',
        data: command
      });
      console.log(`[WeightScaleService] Command sent to ${activeScale.toUpperCase()} scale:`, command);
    } catch (error) {
      console.error(`Error sending command to ${activeScale.toUpperCase()} scale:`, error);
      this._lastError.set(`Command failed: ${error}`);
    }
  }

  /**
   * Tare the specified scale
   */
  public tare(scaleId: string = 'primary'): void {
    this.sendCommand({ type: 'tare', scaleId });
  }

  /**
   * Calibrate the specified scale
   */
  public calibrate(scaleId: string = 'primary'): void {
    this.sendCommand({ type: 'calibrate', scaleId });
  }

  /**
   * Reset the specified scale
   */
  public reset(scaleId: string = 'primary'): void {
    this.sendCommand({ type: 'reset', scaleId });
  }

  /**
   * Manually reconnect
   */
  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 100);
  }

  /**
   * Get weight stream as Observable for reactive programming
   */
  public getWeightStream(): Observable<ScaleWeight> {
    return new Observable<ScaleWeight>(subscriber => {
      const subscription = timer(0, 50).subscribe(() => {
        const weight = this._currentWeight();
        if (weight) {
          subscriber.next(weight);
        }
      });

      return () => subscription.unsubscribe();
    }).pipe(
      filter((weight): weight is ScaleWeight => weight !== null),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Check if weight is stable for the specified duration (ms)
   */
  public isWeightStable(toleranceKg: number = 0.001, durationMs: number = 2000): boolean {
    const weight = this._currentWeight();
    if (!weight || !weight.stable) {
      return false;
    }

    // For now, trust the scale's stability flag
    // In a real implementation, we might track weight history
    return weight.stable;
  }

  /**
   * Build the WebSocket endpoint using the configured bridge service URL
   *
   * Auto-detects environment to support:
   * - WSL2 Development: Uses Windows host IP (10.255.255.254:5000)
   * - Windows Production: Uses localhost (localhost:5000)
   * - Dual-Scale Support: /ws/scale/small and /ws/scale/big endpoints
   */
  private buildWebSocketUrl(scaleType: ScaleType): string {
    // Detect if we're in WSL2 by checking if browser accessed via WSL2 IP
    const isWsl2 = window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1' &&
                   window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

    // In WSL2, bridge service runs on Windows host
    const bridgeHost = isWsl2 ? '10.255.255.254' : 'localhost';
    const bridgePort = environment.bridgeServicePort || 5000;

    const wsUrl = `ws://${bridgeHost}:${bridgePort}/ws/scale/${scaleType}`;

    console.log(`[WeightScaleService] Building ${scaleType.toUpperCase()} scale WebSocket URL:`, {
      hostname: window.location.hostname,
      isWsl2,
      bridgeHost,
      bridgePort,
      scaleType,
      wsUrl
    });

    return wsUrl;
  }

  /**
   * Ensure the provided URL has a protocol so the URL constructor can parse it
   */
  private ensureAbsoluteUrl(candidate: string | undefined, fallbackOrigin: string): string {
    const trimmed = candidate?.trim();
    if (!trimmed) {
      return fallbackOrigin;
    }

    if (trimmed.startsWith('/') || trimmed.startsWith('.')) {
      return trimmed;
    }

    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
    if (hasProtocol) {
      return trimmed;
    }

    return `http://${trimmed}`;
  }
}
