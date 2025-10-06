import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// Progress bar configuration interface
export interface WeightProgressConfig {
  itemName: string;
  itemDescription: string;
  targetWeight: number;
  toleranceMin: number;
  toleranceMax: number;
  unit: string;
  showPercentage: boolean;
  showToleranceBands: boolean;
  animateProgress: boolean;
}

// Weight status enumeration
export enum WeightStatus {
  NONE = 'none',
  UNDER = 'under',
  APPROACHING = 'approaching',
  IN_RANGE = 'in-range',
  OVER = 'over'
}

@Component({
  selector: 'app-weight-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weight-progress-bar.component.html',
  styleUrls: ['./weight-progress-bar.component.css']
})
export class WeightProgressBarComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Input properties as signals
  private _currentWeight = signal<number>(0);
  private _config = signal<WeightProgressConfig>({
    itemName: 'Unknown Item',
    itemDescription: '',
    targetWeight: 100,
    toleranceMin: 95,
    toleranceMax: 105,
    unit: 'KG',
    showPercentage: true,
    showToleranceBands: true,
    animateProgress: true
  });
  private _isConnected = signal<boolean>(false);
  private _isStable = signal<boolean>(false);

  // Input setters
  @Input() set currentWeight(value: number) {
    this._currentWeight.set(value);
  }

  @Input() set config(value: WeightProgressConfig) {
    this._config.set(value);
  }

  @Input() set isConnected(value: boolean) {
    this._isConnected.set(value);
  }

  @Input() set isStable(value: boolean) {
    this._isStable.set(value);
  }

  // Output events for parent component
  @Output() tareScale = new EventEmitter<void>();
  @Output() reconnectScale = new EventEmitter<void>();
  @Output() fetchWeight = new EventEmitter<void>();

  // Getters for template access
  get currentWeight() { return this._currentWeight(); }
  get config() { return this._config(); }
  get isConnected() { return this._isConnected(); }
  get isStable() { return this._isStable(); }

  // Internal signals for animations
  private _pulseAnimation = signal<boolean>(false);
  private _successAnimation = signal<boolean>(false);

  // Computed properties for display
  public readonly progressPercentage = computed(() => {
    const weight = this.currentWeight;
    const target = this.config.targetWeight;
    if (target === 0) return 0;
    return Math.min((weight / target) * 100, 120); // Cap at 120% for visual overflow
  });

  // Progress bar width calculation with appropriate scale maximum
  public readonly getProgressWidth = computed(() => {
    const weight = this.currentWeight;
    const config = this.config;

    if (config.toleranceMax === 0) return 0;

    // Use scale maximum that's 1.5x the tolerance max to provide visual range
    const scaleMax = config.toleranceMax * 1.5;

    // Progress width calculation: 646 * currentWeight / scaleMax
    const progressWidth = Math.round((weight * 646) / scaleMax);

    // Cap at container width - 4px (2px padding on each side)
    return Math.min(progressWidth, 646);
  });

  public readonly weightStatus = computed((): WeightStatus => {
    const weight = this.currentWeight;
    const config = this.config;

    if (weight === 0) return WeightStatus.NONE;
    if (weight < config.toleranceMin) {
      return weight < (config.toleranceMin * 0.9) ? WeightStatus.UNDER : WeightStatus.APPROACHING;
    }
    if (weight > config.toleranceMax) return WeightStatus.OVER;
    return WeightStatus.IN_RANGE;
  });

  public readonly displayWeight = computed(() => {
    return this.formatWeight(this.currentWeight);
  });

  public readonly displayTarget = computed(() => {
    return this.formatWeight(this.config.targetWeight);
  });

  public readonly displayTolerance = computed(() => {
    const config = this.config;
    return `${this.formatWeight(config.toleranceMin)} - ${this.formatWeight(config.toleranceMax)}`;
  });

  public readonly isInRange = computed(() => {
    return this.weightStatus() === WeightStatus.IN_RANGE;
  });

  public readonly shouldPulse = computed(() => {
    return this._pulseAnimation() && this.isInRange() && this.isStable;
  });

  public readonly showSuccess = computed(() => {
    return this._successAnimation();
  });

  // Validation for fetch weight button
  public readonly canFetchWeight = computed(() => {
    const weight = this.currentWeight;
    const config = this.config;
    return weight >= config.toleranceMin && weight <= config.toleranceMax && weight > 0;
  });

  // CSS classes for weight display (clickable when in range)
  public readonly weightDisplayClasses = computed(() => {
    const classes = ['weight-info'];

    if (this.canFetchWeight()) {
      classes.push('clickable');
    } else {
      classes.push('disabled');
    }

    return classes.join(' ');
  });

  // Tolerance marker positions using consistent scale calculation
  public readonly getToleranceMinPosition = computed(() => {
    const config = this.config;

    if (config.toleranceMax === 0) return 0;

    // Use same scale maximum as progress width calculation
    const scaleMax = config.toleranceMax * 1.5;

    // Min tolerance marker position: 646 * toleranceMin / scaleMax
    const position = Math.round((646.0 * config.toleranceMin) / scaleMax);

    return Math.min(position, 646);
  });

  public readonly getToleranceMaxPosition = computed(() => {
    const config = this.config;

    if (config.toleranceMax === 0) return 646;

    // Use same scale maximum as progress width calculation
    const scaleMax = config.toleranceMax * 1.5;

    // Max tolerance marker position: 646 * toleranceMax / scaleMax
    const position = Math.round((646.0 * config.toleranceMax) / scaleMax);

    return Math.min(position, 646);
  });

  // CSS classes for styling
  public readonly progressBarClasses = computed(() => {
    const status = this.weightStatus();
    const classes = ['progress-fill'];

    classes.push(`status-${status}`);

    if (this.shouldPulse()) classes.push('pulse');
    if (this.showSuccess()) classes.push('success');
    if (!this.isConnected) classes.push('disconnected');

    return classes.join(' ');
  });

  public readonly containerClasses = computed(() => {
    const classes = ['weight-progress-container'];

    if (!this.isConnected) classes.push('offline');
    if (this.isInRange()) classes.push('in-range');

    return classes.join(' ');
  });

  ngOnInit(): void {
    // Signals are reactive by default, no need to subscribe
    // The pulse animation will automatically update when isInRange changes
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Trigger success animation when weight is captured
   */
  public triggerSuccessAnimation(): void {
    this._successAnimation.set(true);
    setTimeout(() => {
      this._successAnimation.set(false);
    }, 2000); // 2 second animation
  }

  /**
   * Format weight for display with proper decimal places and null safety
   */
  private formatWeight(weight: number | undefined | null): string {
    if (weight == null || weight === 0 || isNaN(weight)) return '0.0000';
    return weight.toFixed(4);
  }

  /**
   * Get status message for display
   */
  public getStatusMessage(): string {
    if (!this.isConnected) {
      return 'Scale Disconnected';
    }

    const status = this.weightStatus();
    switch (status) {
      case WeightStatus.NONE:
        return 'Place item on scale';
      case WeightStatus.UNDER:
        return 'Add more material';
      case WeightStatus.APPROACHING:
        return 'Getting close...';
      case WeightStatus.IN_RANGE:
        return this.isStable ? 'Weight captured!' : 'In range - stabilizing...';
      case WeightStatus.OVER:
        return 'Remove excess material';
      default:
        return '';
    }
  }

  /**
   * Get connection status icon
   */
  public getConnectionIcon(): string {
    return this.isConnected ? '🟢' : '🔴';
  }

  /**
   * Get progress icon based on status
   */
  public getProgressIcon(): string {
    const status = this.weightStatus();
    switch (status) {
      case WeightStatus.NONE:
        return '⚖️';
      case WeightStatus.UNDER:
        return '⬆️';
      case WeightStatus.APPROACHING:
        return '🎯';
      case WeightStatus.IN_RANGE:
        return this.isStable ? '✅' : '⏳';
      case WeightStatus.OVER:
        return '⬇️';
      default:
        return '⚖️';
    }
  }

  /**
   * Handle tare scale button click
   */
  public onTareScale(): void {
    this.tareScale.emit();
  }

  /**
   * Handle reconnect scale button click
   */
  public onReconnectScale(): void {
    this.reconnectScale.emit();
  }

  /**
   * Handle fetch weight button click (from clickable KG display)
   */
  public onFetchWeight(): void {
    if (this.canFetchWeight()) {
      this.fetchWeight.emit();
    }
  }
}